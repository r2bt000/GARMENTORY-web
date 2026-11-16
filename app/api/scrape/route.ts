import { NextResponse } from 'next/server';
import {
  crawlProductMultiAngleUrls,
  downloadUrlAsInlineData,
  selectDistinctAngleUrls,
} from '../../lib/productGallery';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

type CategoryType = '아우터' | '상의' | '하의' | '신발' | '악세사리';

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
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
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
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>#]+/i);
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
  for (let i = 0; i < suffixPatterns.length; i++) {
    t = t.replace(suffixPatterns[i], '').trim();
  }
  return t.slice(0, 80).trim();
}

function isGenericOrBlockedTitle(title: string): boolean {
  const cleaned = cleanProductTitle(title);
  if (!cleaned || cleaned.length < 2) return true;
  const lower = cleaned.toLowerCase();
  const blockedExact = [
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
    '네이버',
  ];
  if (blockedExact.includes(lower)) return true;

  if (
    /(just a moment|attention required|access denied|403 forbidden|robot|captcha|cloudflare|보안\s*확인|잠시만\s*기다려|접근이\s*거부|페이지를\s*찾을\s*수\s*없|error\s*404|not\s*found|통합검색)/i.test(
      cleaned
    )
  ) {
    return true;
  }
  return false;
}

function normalizeImageUrl(rawImg: string, pageUrl: string): string {
  const trimmed = decodeHtmlEntities(rawImg || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .trim();
  if (!trimmed || trimmed.startsWith('data:')) return '';
  try {
    const resolved = new URL(trimmed, pageUrl);
    if (!['http:', 'https:'].includes(resolved.protocol)) return '';
    if (isBlockedHost(resolved.hostname)) return '';
    return resolved.toString();
  } catch {
    return '';
  }
}

function isGenericOrBadImage(imgUrl: string): boolean {
  if (!imgUrl) return true;
  const lower = imgUrl.toLowerCase();
  if (
    lower.endsWith('.svg') ||
    lower.includes('.svg?') ||
    lower.includes('1x1') ||
    lower.includes('spacer') ||
    lower.includes('blank.gif')
  ) {
    return true;
  }
  if (
    /(og_kream|kream_og|default_og|musinsa_meta|logo|favicon|sprite|apple-touch-icon|meta_default|share_default|common\/og|naver_og|icon_|btn_|badge_|_brand\/|\/brand\/|brand_logo|seller_logo)/i.test(
      lower
    )
  ) {
    return true;
  }
  if (/[?&]type=s(?:_webp)?(?:&|$)/i.test(lower)) {
    return true;
  }
  return false;
}

function isLikelyBrandLogoAlt(altText: string, titleHint: string): boolean {
  const cleanAlt = altText.trim();
  if (!cleanAlt) return false;
  if (/(로고|logo|brand\s*image|브랜드\s*로고|아이콘)/i.test(cleanAlt)) {
    return true;
  }
  if (/^[가-힣a-zA-Z0-9&.\s]{1,14}\([a-zA-Z0-9&.\s]{1,18}\)$/.test(cleanAlt)) {
    return true;
  }
  const altTokens = cleanAlt.split(/\s+/).filter(Boolean);
  const titleTokens = titleHint.trim().split(/\s+/).filter(Boolean);
  if (altTokens.length === 1 && cleanAlt.length <= 14 && titleTokens.length >= 3) {
    if (!/(썸네일|상품|image|photo)/i.test(cleanAlt)) {
      return true;
    }
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
    score += 55;
  }
  if (/\/[pad]_[0-9a-f]{16,}\.(?:png|jpe?g|webp)/i.test(lower)) {
    score += 45;
  }
  if (/[?&]type=[lm](?:_webp)?(?:&|$)/i.test(lower)) {
    score += 25;
  }
  if (/(products|goods_img|thumbnails|item|product)/i.test(lower)) {
    score += 20;
  }
  if (/(banner|event|coupon|review|profile|avatar|social|style|lookbook_user)/i.test(lower)) {
    score -= 45;
  }

  if (altText) {
    if (isLikelyBrandLogoAlt(altText, titleHint)) {
      score -= 95;
    } else if (titleHint) {
      const titleWords = titleHint
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      const lowerAlt = altText.toLowerCase();
      let matchedWords = 0;
      for (let i = 0; i < titleWords.length; i++) {
        if (lowerAlt.includes(titleWords[i])) {
          matchedWords += 1;
        }
      }
      if (matchedWords >= 2) {
        score += 45;
      }
    }
  }
  return score;
}

function inferCategory(text: string): CategoryType {
  const t = text.toLowerCase();
  if (
    /(선글라스|아이웨어|안경|고글|아이\s*자켓|레이싱\s*자켓|스트레이트\s*자켓|eye\s*jacket|racing\s*jacket|straight\s*jacket|sunglasses|eyewear|glasses|goggles)/.test(
      t
    )
  ) {
    return '악세사리';
  }
  if (
    /(자켓|재킷|코트|블레이저|패딩|점퍼|가디건|파카|집업|바람막이|아우터|플리스|무스탕|트렌치|블루종|아노락|베스트|조끼|퍼퍼|후디드\s*자켓|jacket|coat|blazer|cardigan|parka|puffer|padding|windbreaker|fleece|outer|vest)/.test(
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
    /(부츠|로퍼|더비|스니커즈|신발|슈즈|운동화|샌들|왈라비|슬리퍼|슬립온|뮬|클로그|구두|플랫|힐|포스|조던|덩크|삼바|slip-on|slipon|boots|shoes|sneakers|loafer|sandal|clog|derby)/.test(
      t
    )
  ) {
    return '신발';
  }
  if (
    /(볼캡|모자|비니|버킷햇|백|가방|백팩|크로스백|숄더백|토트백|벨트|체인|목걸이|반지|팔찌|귀걸이|안경|선글라스|머플러|스카프|반다나|장갑|양말|초커|키링|지갑|bandana|cap|hat|beanie|bag|backpack|belt|chain|ring|necklace|glasses|sunglasses|scarf|wallet)/.test(
      t
    )
  ) {
    return '악세사리';
  }
  return '상의';
}

function inferSeason(text: string): string {
  const t = text.toLowerCase();
  if (
    /(패딩|다운|써마핏|therma|플리스|무스탕|헤비|기모|울\s*코트|캐시미어|머플러|비니|퍼퍼|puffer|down|winter)/.test(
      t
    )
  ) {
    return '겨울';
  }
  if (
    /(반팔|숏슬리브|슬리브리스|나시|민소매|반바지|쇼츠|린넨|샌들|슬리퍼|쿨링|short\s*sleeve|sleeveless|linen|summer)/.test(
      t
    )
  ) {
    return '여름';
  }
  if (
    /(가디건|트렌치|바람막이|윈드브레이커|블레이저|자켓|재킷|간절기|라이트\s*아우터|셔츠|긴팔)/.test(
      t
    )
  ) {
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
  const priority = text.match(
    /(?:즉시\s*구매가|구매가|판매가|할인가|발매가)\s*[:：]?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/
  );
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
  images: { url: string; score: number }[];
  orderedHeroGallery: string[];
  price: string;
  extraCategoryText: string;
}

function parseHtmlMetadata(html: string, pageUrl: string): ExtractedMeta {
  let title = '';
  const images: { url: string; score: number }[] = [];
  const orderedHeroGallery: string[] = [];
  let price = '';
  let extraCategoryText = '';

  const pushCandidateImg = (
    rawUrl: string,
    bonus = 0,
    alt = '',
    inHeroGallery = false
  ) => {
    const norm = normalizeImageUrl(rawUrl, pageUrl);
    if (!norm) return;
    const sc = scoreProductImage(norm, alt, title) + bonus;
    if (sc > 0) {
      images.push({ url: norm, score: sc });
      if (inHeroGallery && !isLikelyBrandLogoAlt(alt, title)) {
        orderedHeroGallery.push(norm);
      }
    }
  };

  const ldRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  while ((ldMatch = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(ldMatch[1].trim());
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed?.['@graph'] && Array.isArray(parsed['@graph'])
        ? parsed['@graph']
        : [parsed];
      for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        if (!item || typeof item !== 'object') continue;
        const itemType = String(item['@type'] || '').toLowerCase();
        if (itemType.includes('product')) {
          if (!title && typeof item.name === 'string' && !isGenericOrBlockedTitle(item.name)) {
            title = cleanProductTitle(item.name);
          }
          if (item.image) {
            const imgList = Array.isArray(item.image) ? item.image : [item.image];
            for (let j = 0; j < imgList.length; j++) {
              const entry = imgList[j];
              const u = typeof entry === 'string' ? entry : entry?.url;
              if (u) pushCandidateImg(u, j === 0 ? 175 : 120, '', true);
            }
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

  const metaMap = new Map<string, string>();
  const metaRegex = /<meta\s+[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = metaRegex.exec(html)) !== null) {
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
  for (let i = 0; i < metaTitleCandidates.length; i++) {
    const cand = metaTitleCandidates[i];
    if (!title && cand && !isGenericOrBlockedTitle(cand)) {
      title = cleanProductTitle(cand);
    }
  }

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
  for (let i = 0; i < metaImgCandidates.length; i++) {
    const cand = metaImgCandidates[i];
    if (cand) pushCandidateImg(cand, 185, '', true);
  }

  const imgRegex = /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi;
  let im: RegExpExecArray | null;
  let imgIndex = 0;
  while ((im = imgRegex.exec(html)) !== null) {
    const altMatch = im[0].match(/alt=["']([^"']*)["']/i);
    const positionBonus = imgIndex === 0 ? 35 : imgIndex <= 4 ? 15 : 0;
    pushCandidateImg(im[1], positionBonus, altMatch?.[1] || '', imgIndex <= 8);
    imgIndex += 1;
  }

  const unescapedHtml = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const heroCutoff = unescapedHtml.match(
    /(?:스타일\s*리뷰|일반\s*리뷰|함께\s*본\s*상품|95점\s*동일\s*상품|review_wrap)/i
  );
  const cutoffPos = heroCutoff?.index ?? unescapedHtml.length;

  const cdnRegex =
    /https?:\/\/(?:kream-phinf\.pstatic\.net|image\.msscdn\.net|img\.29cm\.co\.kr|d3ha2047wt6x28\.cloudfront\.net|cf\.product-image\.s\.zigzag\.kr|shop-phinf\.pstatic\.net|static\.zara\.net)[^"'\s<>\\)]+/gi;
  let cm: RegExpExecArray | null;
  let cdnIdx = 0;
  while ((cm = cdnRegex.exec(unescapedHtml)) !== null) {
    const inHero = cm.index < cutoffPos;
    pushCandidateImg(cm[0], cdnIdx === 0 ? 25 : 5, '', inHero);
    cdnIdx += 1;
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

  return { title, images, orderedHeroGallery, price, extraCategoryText };
}

async function fetchHtmlWithUa(
  url: string,
  userAgent: string,
  timeoutMs = 4200
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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

async function resolveVerifiedImageDataUrl(
  candidates: { url: string; score: number }[],
  pageUrl: string
): Promise<{ dataUrl: string; sourceImageUrl: string }> {
  const sorted = candidates.slice().sort((a, b) => b.score - a.score);
  const uniqueUrls: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i].url;
    if (u && !uniqueUrls.includes(u)) {
      uniqueUrls.push(u);
    }
    if (uniqueUrls.length >= 5) break;
  }

  for (let i = 0; i < uniqueUrls.length; i++) {
    const candidateUrl = uniqueUrls[i];
    const inline = await downloadUrlAsInlineData(candidateUrl, pageUrl, 4800);
    if (inline) {
      return {
        dataUrl: `data:${inline.mimeType};base64,${inline.data}`,
        sourceImageUrl: candidateUrl,
      };
    }
  }

  return { dataUrl: '', sourceImageUrl: uniqueUrls[0] || '' };
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`img:${ip}`, 60, 60_000)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawImgUrl = searchParams.get('imageUrl') || '';
  const rawReferer = searchParams.get('referer') || '';

  const { cleanUrl } = extractAndValidateUrl(rawImgUrl);
  if (!cleanUrl) {
    return new Response('Invalid imageUrl', { status: 400 });
  }

  const inline = await downloadUrlAsInlineData(cleanUrl, rawReferer, 5000);
  if (!inline) {
    return new Response('Upstream image fetch failed', { status: 502 });
  }

  return new Response(Buffer.from(inline.data, 'base64'), {
    status: 200,
    headers: {
      'Content-Type': inline.mimeType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
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
      return NextResponse.json(
        { success: false, error: '올바른 상품 페이지 주소를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const store = detectStoreName(cleanUrl);
    let bestTitle = '';
    let bestPrice = '';
    let extraText = '';
    const allImages: { url: string; score: number }[] = [];
    const heroGalleryPool: string[] = [];

    const botUserAgents = [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php); kakaotalk-scrap/1.0 (+https://devtalk.kakao.com)',
      'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/bot)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ];

    for (let i = 0; i < botUserAgents.length; i++) {
      if (bestTitle && selectDistinctAngleUrls(heroGalleryPool, 4).length >= 3) break;
      const html = await fetchHtmlWithUa(cleanUrl, botUserAgents[i], 4000);
      if (!html) continue;
      const parsed = parseHtmlMetadata(html, cleanUrl);
      if (!bestTitle && parsed.title) bestTitle = parsed.title;
      if (!bestPrice && parsed.price) bestPrice = parsed.price;
      if (parsed.extraCategoryText) extraText += ' ' + parsed.extraCategoryText;
      for (let j = 0; j < parsed.images.length; j++) {
        allImages.push(parsed.images[j]);
      }
      for (let j = 0; j < parsed.orderedHeroGallery.length; j++) {
        heroGalleryPool.push(parsed.orderedHeroGallery[j]);
      }
    }

    // 2차 전략: 제목이 없거나 다각도 갤러리 사진이 1장 이하일 때 Jina Reader로 상단 다각도 슬라이더(썸네일 1..N) 확보!
    if (!bestTitle || selectDistinctAngleUrls(heroGalleryPool, 4).length < 2) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
          headers: { 'X-Locale': 'ko-KR' },
          signal: controller.signal,
        });
        if (jinaRes.ok) {
          const mdText = await jinaRes.text();
          const titleLine = mdText.match(/^Title:\s*(.+)$/m);
          if (titleLine && titleLine[1] && !isGenericOrBlockedTitle(titleLine[1])) {
            if (!bestTitle) bestTitle = cleanProductTitle(titleLine[1]);
          }
          if (!bestPrice) {
            bestPrice = extractPriceFromText(mdText);
          }
          extraText += ' ' + mdText.slice(0, 1500);

          const secondarySectionMatch = mdText.match(
            /\n(?:#+\s*)?(?:스타일\s*리뷰|일반\s*리뷰|거래\s*내역\s*더보기|관련\s*기획전|95점\s*동일\s*상품|함께\s*본\s*상품|브랜드\s*\n)/
          );
          const secondaryCutoffIdx = secondarySectionMatch?.index ?? mdText.length;

          const mdImgRegex = /!\[([\s\S]*?)\]\((https?:\/\/[^)\s"']+)\)/g;
          let m: RegExpExecArray | null;
          let heroCount = 0;
          while ((m = mdImgRegex.exec(mdText)) !== null) {
            const norm = normalizeImageUrl(m[2], cleanUrl);
            if (!norm) continue;
            const isHeroZone = m.index < secondaryCutoffIdx;
            const zoneBonus = isHeroZone ? (heroCount === 0 ? 95 : 40) : -70;
            if (isHeroZone && !isLikelyBrandLogoAlt(m[1], bestTitle)) {
              heroGalleryPool.push(norm);
              heroCount += 1;
            }
            const sc = scoreProductImage(norm, m[1], bestTitle) + zoneBonus;
            if (sc > 0) allImages.push({ url: norm, score: sc });
          }

          const rawCdnRegex =
            /https?:\/\/(?:kream-phinf\.pstatic\.net|image\.msscdn\.net|img\.29cm\.co\.kr|d3ha2047wt6x28\.cloudfront\.net|cf\.product-image\.s\.zigzag\.kr|shop-phinf\.pstatic\.net|static\.zara\.net)[^"'\s<>\\)]+/gi;
          let cm: RegExpExecArray | null;
          let rawIdx = 0;
          while ((cm = rawCdnRegex.exec(mdText)) !== null) {
            const norm = normalizeImageUrl(cm[0], cleanUrl);
            if (!norm) continue;
            const isHeroZone = cm.index < secondaryCutoffIdx;
            const zoneBonus = isHeroZone ? (rawIdx === 0 ? 60 : 20) : -50;
            if (isHeroZone) {
              heroGalleryPool.push(norm);
              rawIdx += 1;
            }
            const sc = scoreProductImage(norm, '', bestTitle) + zoneBonus;
            if (sc > 0) allImages.push({ url: norm, score: sc });
          }
        }
      } catch {
        // 다음 폴백 진행
      } finally {
        clearTimeout(timer);
      }
    }

    if (!bestTitle || allImages.length === 0) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
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
          if (typeof rawImg === 'string') {
            const norm = normalizeImageUrl(rawImg, cleanUrl);
            if (!isGenericOrBadImage(norm)) {
              allImages.push({ url: norm, score: 150 });
              heroGalleryPool.push(norm);
            }
          }
        }
      } catch {
        // 무시
      } finally {
        clearTimeout(timer);
      }
    }

    if (!bestTitle || allImages.length === 0) {
      const searchQ = bestTitle ? `${store} ${bestTitle}` : cleanUrl;
      const naverHtml = await fetchHtmlWithUa(
        `https://m.search.naver.com/search.naver?query=${encodeURIComponent(searchQ)}`,
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        4000
      );
      if (naverHtml) {
        if (!bestTitle) {
          const kreamTitleMatch = naverHtml.match(
            />([^<>]{4,80}?(?:정품\s*안심\s*거래\s*\|\s*KREAM|\|\s*KREAM|\|\s*무신사|\|\s*29CM))<\//i
          );
          if (kreamTitleMatch && kreamTitleMatch[1] && !isGenericOrBlockedTitle(kreamTitleMatch[1])) {
            bestTitle = cleanProductTitle(kreamTitleMatch[1]);
          }
        }
        const naverThumbRegex =
          /https?:\/\/(?:kream-phinf\.pstatic\.net|search\.pstatic\.net\/common\/\?src=https?[^"'&\s]+|shop-phinf\.pstatic\.net)[^"'<>\s]+/gi;
        let nm: RegExpExecArray | null;
        while ((nm = naverThumbRegex.exec(naverHtml)) !== null) {
          const rawFound = decodeHtmlEntities(nm[0]);
          if (!isGenericOrBadImage(rawFound)) {
            allImages.push({ url: rawFound, score: 80 });
          }
        }
      }
    }

    if (!bestTitle && shareHint && !isGenericOrBlockedTitle(shareHint)) {
      bestTitle = cleanProductTitle(shareHint);
    }

    if (bestTitle) {
      const verifiedImg = await resolveVerifiedImageDataUrl(allImages, cleanUrl);
      const distinctGallery = selectDistinctAngleUrls(
        [verifiedImg.sourceImageUrl, ...heroGalleryPool],
        4
      );
      // 다각도 갤러리 미리보기가 브라우저에서 핫링크 차단 없이 즉시 보이도록 최대 4장 병렬 Base64 변환
      const galleryDataUrls: string[] = [];
      if (distinctGallery.length > 0) {
        const dlResults = await Promise.all(
          distinctGallery.map((gUrl) =>
            downloadUrlAsInlineData(gUrl, cleanUrl, 3800)
          )
        );
        for (let k = 0; k < dlResults.length; k++) {
          const item = dlResults[k];
          if (item) {
            galleryDataUrls.push(`data:${item.mimeType};base64,${item.data}`);
          }
        }
      }

      const combinedContext = `${bestTitle} ${extraText}`;
      return NextResponse.json({
        success: true,
        cleanUrl,
        store,
        name: bestTitle,
        price: bestPrice || '실시간 링크 연동 상품',
        category: inferCategory(combinedContext),
        season: inferSeason(combinedContext),
        image: verifiedImg.sourceImageUrl || '',
        imageDataUrl:
          galleryDataUrls[0] || verifiedImg.dataUrl || '',
        galleryUrls: distinctGallery,
        galleryDataUrls,
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
