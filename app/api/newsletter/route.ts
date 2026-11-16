import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RawFeedArticle {
  id: string;
  url: string;
  sourceName: string;
  sourceRegion: 'KR' | 'GLOBAL';
  originalTitle: string;
  originalSummary: string;
  title: string;
  summary: string;
  image: string;
  category: '패션' | '스니커즈' | '컬처' | '라이프스타일';
  publishedAt: string;
  isTranslated: boolean;
}

interface TranslatedPatch {
  idx: number;
  titleKo: string;
  summaryKo: string;
}

interface CachedArticleDetail {
  titleKo: string;
  highlightsKo: string[];
  paragraphsKo: string[];
  isTranslated: boolean;
  heroImage?: string;
  cachedAt: number;
}

const FEED_SOURCES: {
  url: string;
  sourceName: string;
  region: 'KR' | 'GLOBAL';
}[] = [
  { url: 'https://hypebeast.kr/feed', sourceName: 'HYPEBEAST KR', region: 'KR' },
  { url: 'https://hypebeast.com/feed', sourceName: 'HYPEBEAST', region: 'GLOBAL' },
  { url: 'https://www.gq.com/feed/rss', sourceName: 'GQ GLOBAL', region: 'GLOBAL' },
  { url: 'https://wwd.com/fashion-news/feed/', sourceName: 'WWD', region: 'GLOBAL' },
];

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FEED_TTL_MS = 15 * 60 * 1000;
let cachedArticles: RawFeedArticle[] = [];
let cachedFeedTimestamp = 0;

const itemTranslationCache = new Map<string, { titleKo: string; summaryKo: string }>();
const articleDetailCache = new Map<string, CachedArticleDetail>();

function decodeEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagContent(xmlBlock: string, tagName: string): string {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = re.exec(xmlBlock);
  return m ? decodeEntities(m[1]) : '';
}

function extractImageFromItemXml(itemXml: string): string {
  const patterns: RegExp[] = [
    /<media:content[^>]+url=["'](https?:\/\/[^"']+)["']/i,
    /<media:thumbnail[^>]+url=["'](https?:\/\/[^"']+)["']/i,
    /<enclosure[^>]+url=["'](https?:\/\/[^"']+)["']/i,
    /<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i,
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = patterns[i].exec(itemXml);
    if (m && m[1] && !/1x1|pixel|avatar|logo|icon\.svg/i.test(m[1])) {
      return decodeEntities(m[1]);
    }
  }
  return '';
}

function detectCategory(
  title: string,
  summary: string,
  rawCategory: string
): '패션' | '스니커즈' | '컬처' | '라이프스타일' {
  const joined = `${title} ${summary} ${rawCategory}`.toLowerCase();
  if (
    /sneaker|footwear|shoe|jordan|air max|air force|dunk|new balance|asics|salomon|adidas|yeezy|crocs|vans|converse|스니커|신발|슈즈|부츠|조던|나이키|뉴발란스|아디다스|살로몬|크록스|반스/.test(
      joined
    )
  ) {
    return '스니커즈';
  }
  if (
    /fashion|apparel|runway|collection|collab|capsule|jacket|hoodie|denim|streetwear|luxury|prada|gucci|supreme|stussy|palace|kith|balenciaga|패션|컬렉션|협업|콜라보|아우터|자켓|데님|룩북|런웨이|캠페인/.test(
      joined
    )
  ) {
    return '패션';
  }
  if (
    /music|film|movie|art|exhibition|album|netflix|artist|design|architecture|음악|영화|아트|전시|앨범|넷플릭스|아티스트|디자인/.test(
      joined
    )
  ) {
    return '컬처';
  }
  return '라이프스타일';
}

function hasKoreanText(str: string): boolean {
  return /[가-힣]/.test(str);
}

async function fetchWithTimeout(url: string, timeoutMs = 6500): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept:
          'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!resp.ok) return '';
    return await resp.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function parseRssXml(
  xml: string,
  sourceName: string,
  region: 'KR' | 'GLOBAL'
): RawFeedArticle[] {
  if (!xml) return [];
  const results: RawFeedArticle[] = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    const rawTitle = stripHtml(extractTagContent(block, 'title'));
    let link = stripHtml(extractTagContent(block, 'link'));
    if (!link) {
      const guid = stripHtml(extractTagContent(block, 'guid'));
      if (guid.startsWith('http')) link = guid;
    }
    if (!rawTitle || !link.startsWith('http')) continue;

    const image = extractImageFromItemXml(block);
    if (!image) continue;

    const descRaw =
      extractTagContent(block, 'description') ||
      extractTagContent(block, 'content:encoded');
    const cleanSummary = stripHtml(descRaw).slice(0, 220);
    const rawCat = stripHtml(extractTagContent(block, 'category'));
    const pubRaw = stripHtml(extractTagContent(block, 'pubDate'));
    let isoDate = new Date().toISOString();
    if (pubRaw) {
      const parsedTs = Date.parse(pubRaw);
      if (!Number.isNaN(parsedTs)) {
        isoDate = new Date(parsedTs).toISOString();
      }
    }

    const cachedKo = itemTranslationCache.get(link);
    const alreadyKorean = hasKoreanText(rawTitle);

    results.push({
      id: `${sourceName}_${Buffer.from(link).toString('base64').slice(0, 22)}`,
      url: link,
      sourceName,
      sourceRegion: region,
      originalTitle: rawTitle,
      originalSummary: cleanSummary,
      title: cachedKo ? cachedKo.titleKo : rawTitle,
      summary: cachedKo ? cachedKo.summaryKo : cleanSummary,
      image,
      category: detectCategory(rawTitle, cleanSummary, rawCat),
      publishedAt: isoDate,
      isTranslated: Boolean(cachedKo) || (!alreadyKorean && false),
    });

    if (results.length >= 12) break;
  }

  return results;
}

async function scrapeHypebeastKrHtmlFallback(): Promise<RawFeedArticle[]> {
  const html = await fetchWithTimeout('https://hypebeast.kr/', 6500);
  if (!html) return [];
  const list: RawFeedArticle[] = [];
  const seen = new Set<string>();
  const anchorRe =
    /<a[^>]+href=["'](https:\/\/hypebeast\.kr\/20\d{2}\/\d{1,2}\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = anchorRe.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    const inner = m[2];
    const imgMatch = /<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i.exec(
      inner
    );
    if (!imgMatch) continue;
    const windowAround = html.slice(
      Math.max(0, m.index - 400),
      Math.min(html.length, m.index + 1600)
    );
    const titleMatch =
      /title=["']([^"']{8,140})["']/i.exec(inner) ||
      /<h[234][^>]*>([\s\S]{6,200}?)<\/h[234]>/i.exec(windowAround);
    const title = titleMatch ? stripHtml(titleMatch[1]) : '';
    if (!title || title.length < 6) continue;

    seen.add(url);
    list.push({
      id: `HBKR_${Buffer.from(url).toString('base64').slice(0, 22)}`,
      url,
      sourceName: 'HYPEBEAST KR',
      sourceRegion: 'KR',
      originalTitle: title,
      originalSummary: '하입비스트 코리아 최신 패션 · 컬처 에디토리얼 리포트',
      title,
      summary: '하입비스트 코리아 최신 패션 · 컬처 에디토리얼 리포트',
      image: decodeEntities(imgMatch[1]),
      category: detectCategory(title, '', ''),
      publishedAt: new Date().toISOString(),
      isTranslated: false,
    });
    if (list.length >= 10) break;
  }
  return list;
}

async function translateEnglishFeedItemsWithGemini(
  articles: RawFeedArticle[],
  apiKey: string
): Promise<void> {
  if (!apiKey) return;

  const targets: { idx: number; item: RawFeedArticle }[] = [];
  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    if (hasKoreanText(art.title)) continue;
    const hit = itemTranslationCache.get(art.url);
    if (hit) {
      art.title = hit.titleKo;
      art.summary = hit.summaryKo;
      art.isTranslated = true;
      continue;
    }
    if (targets.length < 14) {
      targets.push({ idx: i, item: art });
    }
  }

  if (targets.length === 0) return;

  const payload = targets.map((t, listIndex) => ({
    idx: listIndex,
    title: t.item.originalTitle.slice(0, 160),
    summary: t.item.originalSummary.slice(0, 240),
  }));

  const prompt = `당신은 하입비스트 코리아(Hypebeast Korea)와 아이즈매거진의 수석 패션 에디터입니다.
아래 영문 글로벌 패션·스니커즈·컬처 뉴스 목록을 한국 독자가 읽기 좋게 감각적이고 자연스러운 한국어 매거진 문체로 번역하세요.
브랜드명·모델명(예: Nike, Supreme, Palace, Air Max, Salomon 등)은 한국 패션 매거진 표기 관행을 따르고, 요약(summaryKo)은 핵심 내용을 1~2문장(70~130자)으로 매끄럽게 정리하세요.
반드시 아래 JSON 배열 형식으로만 응답하세요:
[{"idx": 0, "titleKo": "번역된 한국어 헤드라인", "summaryKo": "번역 및 요약된 한국어 리드 문장"}]

입력 기사 목록:
${JSON.stringify(payload)}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14000);
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.25,
          },
        }),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);

    if (!resp.ok) return;
    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return;

    const parsed = JSON.parse(rawText) as TranslatedPatch[];
    if (!Array.isArray(parsed)) return;

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      const target = targets[row.idx];
      if (!target || !row.titleKo) continue;
      const cleanTitleKo = String(row.titleKo).trim();
      const cleanSummaryKo = String(
        row.summaryKo || target.item.originalSummary
      ).trim();

      target.item.title = cleanTitleKo;
      target.item.summary = cleanSummaryKo;
      target.item.category = detectCategory(
        `${target.item.originalTitle} ${cleanTitleKo}`,
        cleanSummaryKo,
        ''
      );
      target.item.isTranslated = true;

      if (itemTranslationCache.size > 350) {
        const firstKey = itemTranslationCache.keys().next().value;
        if (firstKey) itemTranslationCache.delete(firstKey);
      }
      itemTranslationCache.set(target.item.url, {
        titleKo: cleanTitleKo,
        summaryKo: cleanSummaryKo,
      });
    }
  } catch {
    // Keep original English gracefully if translation times out
  }
}

export async function GET(request: Request) {
  try {
    const reqUrl = new URL(request.url);
    const forceRefresh = reqUrl.searchParams.get('refresh') === '1';
    const headerKey = (request.headers.get('x-gemini-key') || '').trim();
    const apiKey = (headerKey || process.env.GEMINI_API_KEY || '').trim();

    const now = Date.now();
    if (
      !forceRefresh &&
      cachedArticles.length >= 6 &&
      now - cachedFeedTimestamp < FEED_TTL_MS
    ) {
      // If an API key became available later and untranslated items remain, translate them once
      const hasUntranslated = cachedArticles.some((a) => !hasKoreanText(a.title));
      if (apiKey && hasUntranslated) {
        await translateEnglishFeedItemsWithGemini(cachedArticles, apiKey);
      }
      return NextResponse.json({
        success: true,
        articles: cachedArticles,
        cached: true,
      });
    }

    const xmlList = await Promise.all(
      FEED_SOURCES.map(async (src) => {
        const xml = await fetchWithTimeout(src.url, 6500);
        return parseRssXml(xml, src.sourceName, src.region);
      })
    );

    let merged: RawFeedArticle[] = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < xmlList.length; i++) {
      const group = xmlList[i];
      for (let j = 0; j < group.length; j++) {
        const item = group[j];
        const normUrl = item.url.replace(/\/$/, '');
        if (seenUrls.has(normUrl)) continue;
        seenUrls.add(normUrl);
        merged.push(item);
      }
    }

    const krCount = merged.filter((a) => a.sourceRegion === 'KR').length;
    if (krCount === 0) {
      const fallbackKr = await scrapeHypebeastKrHtmlFallback();
      for (let i = 0; i < fallbackKr.length; i++) {
        const item = fallbackKr[i];
        const normUrl = item.url.replace(/\/$/, '');
        if (!seenUrls.has(normUrl)) {
          seenUrls.add(normUrl);
          merged.unshift(item);
        }
      }
    }

    // Interleave KR and GLOBAL items naturally sorted by timestamp so both Korean & translated Global stories shine
    merged.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    merged = merged.slice(0, 24);

    if (apiKey && merged.length > 0) {
      await translateEnglishFeedItemsWithGemini(merged, apiKey);
    }

    if (merged.length > 0) {
      cachedArticles = merged;
      cachedFeedTimestamp = now;
    }

    return NextResponse.json({
      success: true,
      articles: merged,
      cached: false,
    });
  } catch {
    return NextResponse.json({
      success: false,
      articles: cachedArticles,
    });
  }
}

function extractArticleParagraphsAndOgImage(html: string): {
  paragraphs: string[];
  ogImage: string;
} {
  let ogImage = '';
  const ogMatch =
    /<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i.exec(
      html
    ) ||
    /<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/i.exec(
      html
    );
  if (ogMatch && ogMatch[1]) {
    ogImage = decodeEntities(ogMatch[1]);
  }

  // Scope to <article> or <main> if present
  const articleMatch =
    /<article\b[\s\S]*?<\/article>/i.exec(html) ||
    /<main\b[\s\S]*?<\/main>/i.exec(html);
  const targetHtml = articleMatch ? articleMatch[0] : html;

  const paragraphs: string[] = [];
  const pRe = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(targetHtml)) !== null) {
    const text = stripHtml(pm[1]);
    if (
      text.length < 40 ||
      /cookie|privacy policy|all rights reserved|subscribe to our newsletter|sign up for|terms of service|무단 전재/i.test(
        text
      )
    ) {
      continue;
    }
    if (!paragraphs.includes(text)) {
      paragraphs.push(text);
    }
    if (paragraphs.length >= 10) break;
  }

  return { paragraphs, ogImage };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      title?: string;
      summary?: string;
      clientGeminiKey?: string;
    };

    const targetUrl = String(body.url || '').trim();
    if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://')) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 기사 주소입니다.' },
        { status: 400 }
      );
    }

    const cached = articleDetailCache.get(targetUrl);
    if (cached && Date.now() - cached.cachedAt < 60 * 60 * 1000) {
      return NextResponse.json({
        success: true,
        ...cached,
      });
    }

    const apiKey = (
      body.clientGeminiKey ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    const html = await fetchWithTimeout(targetUrl, 7500);
    const { paragraphs, ogImage } = html
      ? extractArticleParagraphsAndOgImage(html)
      : { paragraphs: [], ogImage: '' };

    const joinedRaw = paragraphs.join('\n\n') || String(body.summary || '');
    const isEnglishContent = !hasKoreanText(joinedRaw.slice(0, 350));

    if (apiKey && joinedRaw.length > 30) {
      const prompt = `당신은 패션·스니커즈·컬처 전문 매거진 '873oc'의 수석 에디터입니다.
아래 기사 원문을 바탕으로 한국 독자가 매거진 뉴스레터처럼 편하게 읽을 수 있도록 정리하세요.
원문이 영어인 경우 자연스럽고 세련된 한국어로 완역·재구성하고, 원문이 한국어인 경우 핵심 내용을 읽기 좋게 다듬어 주세요.

반드시 다음 JSON 형식으로만 출력하세요:
{
  "titleKo": "매거진 스타일 한국어 제목",
  "highlightsKo": ["핵심 요약 포인트 1", "핵심 요약 포인트 2", "핵심 요약 포인트 3"],
  "paragraphsKo": ["본문 단락 1 (3~4문장)", "본문 단락 2 (3~4문장)", "본문 단락 3 (2~4문장)"]
}

기사 제목: ${String(body.title || '').slice(0, 200)}
기사 원문 발췌:
${joinedRaw.slice(0, 4200)}`;

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 16000);
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            apiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.25,
              },
            }),
            signal: ctrl.signal,
          }
        );
        clearTimeout(timer);

        if (resp.ok) {
          const data = await resp.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const result: CachedArticleDetail = {
              titleKo: String(parsed?.titleKo || body.title || '').trim(),
              highlightsKo: Array.isArray(parsed?.highlightsKo)
                ? parsed.highlightsKo.map((s: unknown) => String(s)).slice(0, 4)
                : [],
              paragraphsKo: Array.isArray(parsed?.paragraphsKo)
                ? parsed.paragraphsKo.map((s: unknown) => String(s)).slice(0, 6)
                : paragraphs.slice(0, 5),
              isTranslated: isEnglishContent,
              heroImage: ogImage || undefined,
              cachedAt: Date.now(),
            };
            if (articleDetailCache.size > 200) {
              const firstKey = articleDetailCache.keys().next().value;
              if (firstKey) articleDetailCache.delete(firstKey);
            }
            articleDetailCache.set(targetUrl, result);
            return NextResponse.json({ success: true, ...result });
          }
        }
      } catch {
        // Fall through to extracted paragraphs
      }
    }

    return NextResponse.json({
      success: true,
      titleKo: String(body.title || ''),
      highlightsKo: [],
      paragraphsKo:
        paragraphs.length > 0
          ? paragraphs.slice(0, 5)
          : body.summary
          ? [String(body.summary)]
          : [],
      isTranslated: false,
      heroImage: ogImage || undefined,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: '기사 본문을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
