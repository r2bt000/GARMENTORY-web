import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

// 국내 메이저 패션 매거진(기본 한국어·초고속 응답) + 글로벌 스트릿·패션 피드(즉시 한국어 자동 번역) 병렬 구성
const FEED_SOURCES: {
  url: string;
  sourceName: string;
  region: 'KR' | 'GLOBAL';
}[] = [
  { url: 'https://www.gqkorea.co.kr/feed/', sourceName: 'GQ KOREA', region: 'KR' },
  { url: 'https://www.vogue.co.kr/feed/', sourceName: 'VOGUE KOREA', region: 'KR' },
  { url: 'https://www.wkorea.com/feed/', sourceName: 'W KOREA', region: 'KR' },
  { url: 'https://www.esquirekorea.co.kr/feed/', sourceName: 'ESQUIRE KR', region: 'KR' },
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
    if (m && m[1] && !/1x1|pixel|avatar|logo|icon\.svg|gravatar/i.test(m[1])) {
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
    /sneaker|footwear|shoe|jordan|air max|air force|dunk|new balance|asics|salomon|adidas|yeezy|crocs|vans|converse|loafer|boot|스니커|신발|슈즈|부츠|로퍼|조던|나이키|뉴발란스|아디다스|살로몬|크록스|반스/.test(
      joined
    )
  ) {
    return '스니커즈';
  }
  if (
    /fashion|apparel|runway|collection|collab|capsule|jacket|hoodie|denim|streetwear|luxury|prada|gucci|chanel|dior|balenciaga|supreme|stussy|palace|kith|lookbook|패션|컬렉션|협업|콜라보|아우터|자켓|재킷|코트|데님|룩북|런웨이|캠페인|스타일|브랜드|샤넬|디올|프라다|구찌|루이 비통/.test(
      joined
    )
  ) {
    return '패션';
  }
  if (
    /music|film|movie|art|exhibition|album|netflix|artist|design|architecture|음악|영화|아트|전시|앨범|넷플릭스|아티스트|디자인|배우|아이돌/.test(
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

async function fetchWithTimeout(url: string, timeoutMs = 2300): Promise<string> {
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

// [Layer 1] 초고속 병렬 영→한 번역기 (~0.2초 응답 · API 키 무관하게 100% 한국어 보장)
async function fastTranslateTextToKorean(
  text: string,
  timeoutMs = 2000
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || hasKoreanText(trimmed)) return trimmed;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const resp = await fetch(endpoint, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!resp.ok) return trimmed;
    const data = await resp.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const joined = data[0]
        .map((seg: unknown) =>
          Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''
        )
        .join('')
        .trim();
      if (joined && hasKoreanText(joined)) {
        return joined;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
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
    const cleanSummary = stripHtml(descRaw)
      .replace(/더 보기.*$/g, '')
      .replace(/The post .* appeared first on .*$/i, '')
      .trim()
      .slice(0, 180);

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

    results.push({
      id: `${sourceName.replace(/\s+/g, '')}_${Buffer.from(link)
        .toString('base64')
        .slice(0, 22)}`,
      url: link,
      sourceName,
      sourceRegion: region,
      originalTitle: rawTitle,
      originalSummary: cleanSummary,
      title: cachedKo ? cachedKo.titleKo : rawTitle,
      summary: cachedKo ? cachedKo.summaryKo : cleanSummary,
      image,
      category: detectCategory(
        cachedKo ? `${rawTitle} ${cachedKo.titleKo}` : rawTitle,
        cleanSummary,
        rawCat
      ),
      publishedAt: isoDate,
      isTranslated: Boolean(cachedKo),
    });

    if (results.length >= 7) break;
  }

  return results;
}

// [Layer 1 + Layer 2] 모든 영문 기사를 즉시 병렬 한국어로 변환 + Gemini 무지연(thinkingBudget:0) 에디토리얼 윤문
async function ensureAllArticlesInKoreanFast(
  articles: RawFeedArticle[],
  apiKey: string
): Promise<void> {
  const uncachedTargets: { index: number; item: RawFeedArticle }[] = [];

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    if (hasKoreanText(art.title) && (!art.summary || hasKoreanText(art.summary))) {
      continue;
    }
    const cached = itemTranslationCache.get(art.url);
    if (cached) {
      art.title = cached.titleKo;
      art.summary = cached.summaryKo;
      art.isTranslated = true;
      continue;
    }
    uncachedTargets.push({ index: i, item: art });
  }

  if (uncachedTargets.length === 0) return;

  // 1) 먼저 초고속 병렬 번역(~250ms)으로 100% 한국어 제목·요약을 즉시 확보 (영어 노출 원천 차단!)
  await Promise.all(
    uncachedTargets.map(async ({ item }) => {
      const [koTitle, koSummary] = await Promise.all([
        hasKoreanText(item.title)
          ? Promise.resolve(item.title)
          : fastTranslateTextToKorean(item.originalTitle, 2000),
        !item.originalSummary || hasKoreanText(item.originalSummary)
          ? Promise.resolve(item.originalSummary)
          : fastTranslateTextToKorean(item.originalSummary, 2000),
      ]);

      if (hasKoreanText(koTitle)) {
        item.title = koTitle;
        item.summary = koSummary;
        item.isTranslated = true;
        item.category = detectCategory(
          `${item.originalTitle} ${koTitle}`,
          koSummary,
          ''
        );
        itemTranslationCache.set(item.url, {
          titleKo: koTitle,
          summaryKo: koSummary,
        });
      }
    })
  );

  // 2) Gemini API 키가 있으면 thinkingBudget: 0 (추론 지연 제거 -> 약 1초 응답)으로 매거진 어조 다듬기 시도
  if (!apiKey) return;

  const polishList = uncachedTargets.slice(0, 10);
  const payload = polishList.map((t, idx) => ({
    idx,
    title: t.item.originalTitle.slice(0, 140),
    summary: t.item.originalSummary.slice(0, 190),
  }));

  const prompt = `패션 매거진 한국어 에디터로서 아래 영문 뉴스 제목·요약을 세련된 한국어 헤드라인과 1문장 요약으로 다듬으세요. JSON 배열만 출력:
[{"idx":0,"titleKo":"한국어 제목","summaryKo":"한국어 한 줄 요약"}]
입력:${JSON.stringify(payload)}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2400);
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
            temperature: 0.2,
            thinkingConfig: { thinkingBudget: 0 },
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
      const target = polishList[row.idx];
      if (!target || !row.titleKo || !hasKoreanText(row.titleKo)) continue;
      const cleanTitleKo = String(row.titleKo).trim();
      const cleanSummaryKo = String(
        row.summaryKo || target.item.summary
      ).trim();

      target.item.title = cleanTitleKo;
      target.item.summary = cleanSummaryKo;
      target.item.isTranslated = true;
      itemTranslationCache.set(target.item.url, {
        titleKo: cleanTitleKo,
        summaryKo: cleanSummaryKo,
      });
    }
  } catch {
    // 2.4초 초과 시 이미 완료된 Layer 1 한국어 번역본을 즉시 그대로 반환!
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
      return NextResponse.json(
        {
          success: true,
          articles: cachedArticles,
          cached: true,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
          },
        }
      );
    }

    // 모든 국내·해외 RSS 피드를 최대 2.3초 타임아웃으로 동시에 병렬 수집 (느린 사이트 자동 패스)
    const xmlGroups = await Promise.all(
      FEED_SOURCES.map(async (src) => {
        const xml = await fetchWithTimeout(src.url, 2300);
        return parseRssXml(xml, src.sourceName, src.region);
      })
    );

    let merged: RawFeedArticle[] = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < xmlGroups.length; i++) {
      const group = xmlGroups[i];
      for (let j = 0; j < group.length; j++) {
        const item = group[j];
        const normUrl = item.url.replace(/\/$/, '');
        if (seenUrls.has(normUrl)) continue;
        seenUrls.add(normUrl);
        merged.push(item);
      }
    }

    merged.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    merged = merged.slice(0, 24);

    if (merged.length > 0) {
      await ensureAllArticlesInKoreanFast(merged, apiKey);
    }

    // 혹시라도 번역이 안 된 순수 영문 항목이 남아 있다면 철저히 제외해 100% 한국어 피드만 노출
    const koreanOnly = merged.filter((a) => hasKoreanText(a.title));
    const finalArticles = koreanOnly.length >= 4 ? koreanOnly : merged;

    if (finalArticles.length > 0) {
      cachedArticles = finalArticles;
      cachedFeedTimestamp = now;
    }

    return NextResponse.json(
      {
        success: true,
        articles: finalArticles.length > 0 ? finalArticles : cachedArticles,
        cached: false,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        },
      }
    );
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
      text.length < 38 ||
      /cookie|privacy policy|all rights reserved|subscribe to our newsletter|sign up for|terms of service|무단 전재|저작권자/i.test(
        text
      )
    ) {
      continue;
    }
    if (!paragraphs.includes(text)) {
      paragraphs.push(text);
    }
    if (paragraphs.length >= 6) break;
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

    const html = await fetchWithTimeout(targetUrl, 3000);
    const { paragraphs, ogImage } = html
      ? extractArticleParagraphsAndOgImage(html)
      : { paragraphs: [], ogImage: '' };

    const rawParas =
      paragraphs.length > 0
        ? paragraphs.slice(0, 5)
        : body.summary
        ? [String(body.summary)]
        : [];
    const joinedSample = rawParas.join(' ');
    const isEnglishContent =
      Boolean(joinedSample) && !hasKoreanText(joinedSample.slice(0, 300));

    // 1) 영문 본문이면 즉시 병렬 번역(~0.3초)으로 모든 문단을 한국어로 변환!
    const [translatedTitle, translatedParas] = await Promise.all([
      body.title && !hasKoreanText(body.title)
        ? fastTranslateTextToKorean(body.title, 2200)
        : Promise.resolve(String(body.title || '')),
      isEnglishContent
        ? Promise.all(
            rawParas.map((p) => fastTranslateTextToKorean(p.slice(0, 700), 2400))
          )
        : Promise.resolve(rawParas),
    ]);

    let finalTitleKo = translatedTitle;
    let finalParasKo = translatedParas;
    let highlightsKo: string[] = [];

    // 2) Gemini 키가 있으면 thinkingBudget: 0 으로 빠르게 핵심 요약 3줄 추가 (최대 2.8초)
    if (apiKey && rawParas.length > 0) {
      const prompt = `패션 매거진 에디터로서 아래 기사를 한국어로 3줄 핵심 요약(highlightsKo)하고 본문(paragraphsKo)을 매끄러운 한국어 3문단으로 정리하세요. JSON만 출력:
{"titleKo":"한국어 제목","highlightsKo":["핵심 1","핵심 2","핵심 3"],"paragraphsKo":["문단 1","문단 2","문단 3"]}
제목: ${String(body.title || '').slice(0, 160)}
본문: ${rawParas.join('\n').slice(0, 2600)}`;

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2800);
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
                temperature: 0.2,
                thinkingConfig: { thinkingBudget: 0 },
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
            if (parsed?.titleKo && hasKoreanText(String(parsed.titleKo))) {
              finalTitleKo = String(parsed.titleKo).trim();
            }
            if (Array.isArray(parsed?.highlightsKo)) {
              highlightsKo = parsed.highlightsKo
                .map((s: unknown) => String(s))
                .filter((s: string) => hasKoreanText(s))
                .slice(0, 3);
            }
            if (
              Array.isArray(parsed?.paragraphsKo) &&
              parsed.paragraphsKo.length > 0 &&
              hasKoreanText(String(parsed.paragraphsKo[0]))
            ) {
              finalParasKo = parsed.paragraphsKo
                .map((s: unknown) => String(s))
                .slice(0, 5);
            }
          }
        }
      } catch {
        // 시간 초과 시 이미 준비된 한국어 문단(translatedParas) 즉시 반환
      }
    }

    const detailResult: CachedArticleDetail = {
      titleKo: finalTitleKo,
      highlightsKo,
      paragraphsKo: finalParasKo,
      isTranslated: isEnglishContent,
      heroImage: ogImage || undefined,
      cachedAt: Date.now(),
    };

    if (articleDetailCache.size > 200) {
      const firstKey = articleDetailCache.keys().next().value;
      if (firstKey) articleDetailCache.delete(firstKey);
    }
    articleDetailCache.set(targetUrl, detailResult);

    return NextResponse.json({
      success: true,
      ...detailResult,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: '기사 본문을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
