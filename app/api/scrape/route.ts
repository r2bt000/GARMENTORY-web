import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

type CategoryType = '아우터' | '상의' | '하의' | '신발' | '악세사리';

// 간단한 IP별 슬라이딩 윈도우 레이트 리미터 (서버리스 인스턴스 메모리 보호)
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'anon';
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (
    !h ||
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === '::1' ||
    h === '[::1]'
  ) {
    return true;
  }
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    ) {
      return true;
    }
  }
  return false;
}

function extractAndValidateUrl(rawInput: string): {
  cleanUrl: string | null;
  shareHint: string;
} {
  const trimmed = rawInput.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  if (!urlMatch) {
    return { cleanUrl: null, shareHint: '' };
  }
  const candidate = urlMatch[0].replace(/[),.;]+$/, '');
  const shareHint = trimmed
    .replace(urlMatch[0], '')
    .replace(/[\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { cleanUrl: null, shareHint: '' };
    }
    if (isBlockedHost(parsed.hostname)) {
      return { cleanUrl: null, shareHint: '' };
    }
    return { cleanUrl: parsed.toString(), shareHint };
  } catch {
    return { cleanUrl: null, shareHint: '' };
  }
}

function detectStoreName(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('musinsa')) return 'MUSINSA';
  if (lower.includes('kream')) return 'KREAM';
  if (lower.includes('a-bly') || lower.includes('ably')) return 'ABLY';
  if (lower.includes('29cm')) return '29CM';
  if (lower.includes('zigzag')) return 'ZIGZAG';
  if (lower.includes('zara')) return 'ZARA';
  if (lower.includes('naver') || lower.includes('smartstore')) return 'NAVER';
  if (lower.includes('wconcept')) return 'W CONCEPT';
  if (lower.includes('ssfshop')) return 'SSF SHOP';
  return 'ONLINE STORE';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanProductTitle(raw: string): string {
  let t = decodeHtmlEntities(raw);
  // 쇼핑몰 공통 꼬리표 제거 (KREAM, 무신사, 29CM, 에이블리, 자라 등)
  const suffixPatterns = [
    /\s*[-|·]\s*정품\s*안심\s*거래\s*\|\s*KREAM.*$/i,
    /\s*정품\s*안심\s*거래\s*\|\s*KREAM.*$/i,
    /\s*\|\s*KREAM.*$/i,
    /\s*-\s*KREAM.*$/i,
    /\s*-\s*사이즈\s*&\s*후기\s*\|\s*무신사.*$/i,
    /\s*\|\s*무신사.*$/i,
    /\s*-\s*무신사.*$/i,
    /\s*\|\s*MUSINSA.*$/i,
    /\s*[-|]\s*감도\s*깊은\s*취향\s*셀렉트샵\s*29CM.*$/i,
    /\s*\|\s*29CM.*$/i,
    /\s*[-|]\s*에이블리.*$/i,
    /\s*\|\s*ZARA.*$/i,
    /\s*-\s*ZARA.*$/i,
    /\s*:\s*네이버\s*쇼핑.*$/i,
    /\s*:\s*브랜드스토어.*$/i,
    /\s*:\s*스마트스토어.*$/i,
  ];
  for (const pat of suffixPatterns) {
    t = t.replace(pat, '').trim();
  }
  return t.slice(0, 80).trim();
}

function isGenericOrBlockedTitle(title: string): boolean {
  const cleaned = cleanProductTitle(title);
  if (!cleaned || cleaned.length < 2) return true;
  const lower = cleaned.toLowerCase();
  const blockedExact = new Set([
    'kream',
    'kream | 한정판 거래의 flex',
    '한정판 거래의 flex',
    'musinsa',
    '무신사',
    '무신사 스토어',
    '29cm',
    '감도 깊은 취향 셀렉트샵 29cm',
    '에이블리',
    'ably',
    'zara',
    'zigzag',
    '지그재그',
    '네이버 쇼핑',
    '스마트스토어',
  ]);
  if (blockedExact.has(lower)) return true;

  if (
    /(just a moment|attention required|access denied|403 forbidden|robot|captcha|cloudflare|보안\s*확인|잠시만\s*기다려|접근이\s*거부|페이지를\s*찾을\s*수\s*없|error\s*404|not\s*found)/i.test(
      cleaned
    )
  ) {
    return true;
  }
  return false;
}

function normalizeImageUrl(rawImg: string, pageUrl: string): string {
  const trimmed = decodeHtmlEntities(rawImg || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return '';
  try {
    const resolved = new URL(trimmed, pageUrl).toString();
    if (!/^https?:\/\//i.test(resolved)) return '';
    return resolved;
  } catch {
    return '';
  }
}

function isGenericOrBadImage(imgUrl: string): boolean {
  if (!imgUrl) return true;
  const lower = imgUrl.toLowerCase();
  if (lower.endsWith('.svg') || lower.includes('1x1') || lower.includes('spacer')) {
    return true;
  }
  if (
    /(og_kream|kream_og|default_og|musinsa_meta|logo|favicon|sprite|apple-touch-icon|meta_default|share_default|common\/og)/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

function scoreProductImage(imgUrl: string, altText = '', titleHint = ''): number {
  if (isGenericOrBadImage(imgUrl)) return -100;
  let score = 10;
  const lower = imgUrl.toLowerCase();
  if (
    /(kream-phinf\.pstatic\.net|image\.msscdn\.net|img\.29cm\.co\.kr|d3ha2047wt6x28\.cloudfront\.net|cf\.product-image\.s\.zigzag\.kr|shop-phinf\.pstatic\.net|static\.zara\.net)/i.test(
      lower
    )
  ) {
    score += 50;
  }
  if (/(products|goods_img|thumbnails|item|product)/i.test(lower)) {
    score += 20;
  }
  if (/(banner|event|coupon|review|profile|avatar|icon|btn_)/i.test(lower)) {
    score -= 35;
  }
  if (altText && titleHint) {
    const firstWord = titleHint.split(/\s+/)[0];
    if (firstWord && altText.includes(firstWord)) {
      score += 30;
    }
  }
  return score;
}

function inferCategory(text: string): CategoryType {
  const t = text.toLowerCase();
  if (
    /(자켓|재킷|코트|블레이저|패딩|점퍼|가디건|파카|집업|바람막이|아우터|플리스|무스탕|트렌치|블루종|아노락|베스트|조끼|jacket|coat|blazer|cardigan|parka|puffer|padding|windbreaker|fleece|outer|vest)/.test(
      t
    )
  ) {
    return '아우터';
  }
  if (
    /(팬츠|데님|청바지|슬랙스|바지|쇼츠|반바지|스커트|치마|카고|치노|트라우저|조거|레깅스|pants|denim|jeans|skirt|shorts|trousers|jogger)/.test(
      t
    )
  ) {
    return '하의';
  }
  if (
    /(부츠|로퍼|더비|스니커즈|신발|슈즈|운동화|샌들|왈라비|슬리퍼|뮬|클로그|구두|플랫|힐|포스|조던|덩크|삼바|boots|shoes|sneakers|loafer|sandal|clog|derby)/.test(
      t
    )
  ) {
    return '신발';
  }
  if (
    /(볼캡|모자|비니|버킷햇|백|가방|백팩|크로스백|숄더백|토트백|벨트|체인|목걸이|반지|팔찌|귀걸이|안경|선글라스|머플러|스카프|장갑|양말|초커|키링|지갑|cap|hat|beanie|bag|backpack|belt|chain|ring|necklace|glasses|sunglasses|scarf|wallet)/.test(
      t
    )
  ) {
    return '악세사리';
  }
  return '상의';
}

function inferSeason(text: string): string {
  const t = text.toLowerCase();
  if (/(패딩|다운|써마핏|therma|플리스|무스탕|헤비|기모|울\s*코트|캐시미어|머플러|비니|puffer|down|winter)/.test(t)) {
    return '겨울';
  }
  if (/(반팔|숏슬리브|슬리브리스|나시|민소매|반바지|쇼츠|린넨|샌들|슬리퍼|쿨링|short\s*sleeve|sleeveless|linen|summer)/.test(t)) {
    return '여름';
  }
  if (/(가디건|트렌치|바람막이|윈드브레이커|블레이저|자켓|재킷|간절기|라이트\s*아우터|셔츠|긴팔)/.test(t)) {
    return '봄/가을';
  }
  return '사계절';
}

function formatPriceString(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (!digits) return '';
  const num = Number(digits);
  if (!Number.isFinite(num) || num < 1000 || num > 100_000_000) return '';
  return `${num.toLocaleString('ko-KR')}원`;
}

function extractPriceFromText(text: string): string {
  // 발매가 또는 즉시 구매가/판매가 우선 탐색
  const priority = text.match(/(?:즉시\s*구매가|구매가|판매가|할인가|발매가)\s*[:：]?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
  if (priority && priority[1]) {
    return `${priority[1]}원`;
  }
  const anyWon = text.match(/\b([1-9][0-9]{0,2}(?:,[0-9]{3})+)\s*원/);
  if (anyWon && anyWon[1]) {
    const val = Number(anyWon[1].replace(/,/g, ''));
    if (val >= 5000 && val <= 50_000_000) {
      return `${anyWon[1]}원`;
    }
  }
  return '';
}

interface ExtractedMeta {
  title: string;
  image: string;
  price: string;
  extraCategoryText: string;
}

function parseHtmlMetadata(html: string, pageUrl: string): ExtractedMeta {
  let title = '';
  let image = '';
  let price = '';
  let extraCategoryText = '';

  // 1. JSON-LD (Product 스키마 우선 추출)
  const ldMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed?.['@graph'] && Array.isArray(parsed['@graph'])
        ? parsed['@graph']
        : [parsed];
      for (const item of candidates) {
        if (!item || typeof item !== 'object') continue;
        const itemType = String(item['@type'] || '').toLowerCase();
        if (itemType.includes('product')) {
          if (!title && typeof item.name === 'string' && !isGenericOrBlockedTitle(item.name)) {
            title = cleanProductTitle(item.name);
          }
          if (!image && item.image) {
            const rawImg = Array.isArray(item.image)
              ? typeof item.image[0] === 'string'
                ? item.image[0]
                : item.image[0]?.url
              : typeof item.image === 'string'
              ? item.image
              : item.image?.url;
            const norm = normalizeImageUrl(rawImg || '', pageUrl);
            if (!isGenericOrBadImage(norm)) image = norm;
          }
          if (!price && item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            price = formatPriceString(offer?.price ?? offer?.lowPrice);
          }
          if (typeof item.category === 'string') {
            extraCategoryText += ' ' + item.category;
          }
        }
      }
    } catch {
      // 무시
    }
  }

  // 2. 모든 <meta> 태그 속성 순서 무관 파싱
  const metaMap = new Map<string, string>();
  const metaTags = html.matchAll(/<meta\s+[^>]*>/gi);
  for (const tagMatch of metaTags) {
    const tag = tagMatch[0];
    const keyMatch = tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i);
    const valMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if (keyMatch && valMatch) {
      const k = keyMatch[1].toLowerCase().trim();
      const v = valMatch[1].trim();
      if (v && !metaMap.has(k)) {
        metaMap.set(k, v);
      }
    }
  }

  const metaTitleCandidates = [
    metaMap.get('og:title'),
    metaMap.get('twitter:title'),
    metaMap.get('title'),
  ];
  for (const cand of metaTitleCandidates) {
    if (!title && cand && !isGenericOrBlockedTitle(cand)) {
      title = cleanProductTitle(cand);
    }
  }

  // <title> 태그 보조 확인
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTag && titleTag[1] && !isGenericOrBlockedTitle(titleTag[1])) {
      title = cleanProductTitle(titleTag[1]);
    }
  }

  const metaImgCandidates = [
    metaMap.get('og:image:secure_url'),
    metaMap.get('og:image'),
    metaMap.get('twitter:image'),
    metaMap.get('image'),
  ];
  for (const cand of metaImgCandidates) {
    if (!image && cand) {
      const norm = normalizeImageUrl(cand, pageUrl);
      if (!isGenericOrBadImage(norm)) {
        image = norm;
      }
    }
  }

  // 만약 meta 이미지가 없거나 로고였다면 본문 내 쇼핑몰 상품 CDN 이미지 스캔
  if (!image) {
    const imgCandidates: { url: string; score: number }[] = [];
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const im of imgMatches) {
      const norm = normalizeImageUrl(im[1], pageUrl);
      if (!norm) continue;
      const altMatch = im[0].match(/alt=["']([^"']*)["']/i);
      const sc = scoreProductImage(norm, altMatch?.[1] || '', title);
      if (sc > 0) imgCandidates.push({ url: norm, score: sc });
    }
    imgCandidates.sort((a, b) => b.score - a.score);
    if (imgCandidates[0]) {
      image = imgCandidates[0].url;
    }
  }

  if (!price) {
    price =
      formatPriceString(metaMap.get('product:price:amount')) ||
      formatPriceString(metaMap.get('og:price:amount')) ||
      extractPriceFromText(metaMap.get('og:description') || '');
  }

  if (metaMap.get('og:description')) {
    extraCategoryText += ' ' + decodeHtmlEntities(metaMap.get('og:description') || '');
  }

  return { title, image, price, extraCategoryText };
}

async function fetchHtmlWithUa(url: string, userAgent: string, timeoutMs = 5500): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/scrape?imageUrl=...&referer=... : 네이버/KREAM/무신사 핫링크(Referer) 차단 우회 및 WebP 변환용 동일 출처 이미지 프록시
export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`img:${ip}`, 60, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawImgUrl = searchParams.get('imageUrl') || '';
  const rawReferer = searchParams.get('referer') || '';

  const { cleanUrl } = extractAndValidateUrl(rawImgUrl);
  if (!cleanUrl) {
    return new NextResponse('Invalid imageUrl', { status: 400 });
  }

  let refererOrigin = '';
  try {
    if (rawReferer) {
      refererOrigin = new URL(rawReferer).origin + '/';
    } else {
      refererOrigin = new URL(cleanUrl).origin + '/';
    }
  } catch {
    refererOrigin = '';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(cleanUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/avif,image/apng,image/*,*/*;q=0.8',
        ...(refererOrigin ? { Referer: refererOrigin } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return new NextResponse('Upstream image fetch failed', { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 415 });
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new NextResponse('Image proxy timeout', { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`scrape:${ip}`, 25, 60_000)) {
      return NextResponse.json(
        { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const body = (await request.json()) as { url?: string };
    if (!body?.url || typeof body.url !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
    }

    const { cleanUrl, shareHint } = extractAndValidateUrl(body.url);
    if (!cleanUrl) {
      return NextResponse.json({ success: false, error: '올바른 상품 페이지 주소를 입력해 주세요.' }, { status: 400 });
    }

    const store = detectStoreName(cleanUrl);
    let bestTitle = '';
    let bestImage = '';
    let bestPrice = '';
    let extraText = '';

    // 1차 전략: 카카오톡·페이스북 공유 미리보기 봇 UA & 네이버 Yeti 봇 UA (국내 쇼핑몰 SSR OG 메타태그 화이트리스트 경로)
    const botUserAgents = [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php); kakaotalk-scrap/1.0 (+https://devtalk.kakao.com)',
      'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/bot)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ];

    for (const ua of botUserAgents) {
      if (bestTitle && bestImage) break;
      const html = await fetchHtmlWithUa(cleanUrl, ua, 4800);
      if (!html) continue;
      const parsed = parseHtmlMetadata(html, cleanUrl);
      if (!bestTitle && parsed.title) bestTitle = parsed.title;
      if (!bestImage && parsed.image) bestImage = parsed.image;
      if (!bestPrice && parsed.price) bestPrice = parsed.price;
      if (parsed.extraCategoryText) extraText += ' ' + parsed.extraCategoryText;
    }

    // 2차 전략: Jina Reader 헤드리스 SPA 렌더링 폴백 (Cloudflare/WAF 또는 Nuxt/Next 동적 렌더링 페이지 대응)
    if (!bestTitle || !bestImage) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
          headers: {
            Accept: 'application/json',
            'X-Locale': 'ko-KR',
            'X-With-Images-Summary': 'true',
          },
          signal: controller.signal,
        });
        if (jinaRes.ok) {
          const jinaJson = await jinaRes.json();
          const jData = jinaJson?.data;
          if (jData) {
            if (!bestTitle && typeof jData.title === 'string' && !isGenericOrBlockedTitle(jData.title)) {
              bestTitle = cleanProductTitle(jData.title);
            }
            const mdContent = typeof jData.content === 'string' ? jData.content : '';
            if (!bestPrice && mdContent) {
              bestPrice = extractPriceFromText(mdContent);
            }
            if (mdContent) {
              extraText += ' ' + mdContent.slice(0, 1200);
            }

            if (!bestImage) {
              const scored: { url: string; score: number }[] = [];
              // images 요약 객체 탐색
              if (jData.images && typeof jData.images === 'object') {
                for (const [alt, rawU] of Object.entries(jData.images)) {
                  if (typeof rawU !== 'string') continue;
                  const norm = normalizeImageUrl(rawU, cleanUrl);
                  if (!norm) continue;
                  const sc = scoreProductImage(norm, alt, bestTitle);
                  if (sc > 0) scored.push({ url: norm, score: sc });
                }
              }
              // 마크다운 ![alt](url) 탐색
              const mdImgs = mdContent.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g);
              for (const m of mdImgs) {
                const norm = normalizeImageUrl(m[2], cleanUrl);
                if (!norm) continue;
                const sc = scoreProductImage(norm, m[1], bestTitle);
                if (sc > 0) scored.push({ url: norm, score: sc });
              }
              scored.sort((a, b) => b.score - a.score);
              if (scored[0]) {
                bestImage = scored[0].url;
              }
            }
          }
        }
      } catch {
        // 다음 폴백 진행
      } finally {
        clearTimeout(timer);
      }
    }

    // 3차 전략: Microlink 오픈그래프 API 보조 폴백
    if (!bestTitle || !bestImage) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const microRes = await fetch(
          `https://api.microlink.io/?url=${encodeURIComponent(cleanUrl)}`,
          { signal: controller.signal }
        );
        if (microRes.ok) {
          const microJson = await microRes.json();
          const rawT = microJson?.data?.title;
          if (!bestTitle && typeof rawT === 'string' && !isGenericOrBlockedTitle(rawT)) {
            bestTitle = cleanProductTitle(rawT);
          }
          const rawImg = microJson?.data?.image?.url;
          if (!bestImage && typeof rawImg === 'string') {
            const norm = normalizeImageUrl(rawImg, cleanUrl);
            if (!isGenericOrBadImage(norm)) bestImage = norm;
          }
        }
      } catch {
        // 무시
      } finally {
        clearTimeout(timer);
      }
    }

    // 공유 텍스트에 상품명이 함께 복사되어 온 경우 보조 활용
    if (!bestTitle && shareHint && !isGenericOrBlockedTitle(shareHint)) {
      bestTitle = cleanProductTitle(shareHint);
    }

    if (bestTitle) {
      const combinedContext = `${bestTitle} ${extraText}`;
      return NextResponse.json({
        success: true,
        cleanUrl,
        store,
        name: bestTitle,
        price: bestPrice || '실시간 링크 연동 상품',
        category: inferCategory(combinedContext),
        season: inferSeason(combinedContext),
        image: bestImage || '',
      });
    }

    return NextResponse.json({
      success: false,
      cleanUrl,
      store,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
