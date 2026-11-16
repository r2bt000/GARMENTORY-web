// 쇼핑몰 상세 페이지(KREAM, 무신사, 29CM, 에이블리, 자라 등)에서
// 동일 상품의 다각도(앞면·옆면·뒷면·디테일) 갤러리 이미지를 중복 없이 추출·다운로드하는 서버 전용 유틸리티

export interface GalleryCandidate {
  url: string;
  score: number;
}

export interface InlineImageData {
  mimeType: string;
  data: string;
  sourceUrl?: string;
}

// 서버 인스턴스 내 다각도 갤러리 URL 캐시 (동일 상품 재촬영 시 즉시 응답)
const galleryCache = new Map<string, { urls: string[]; expiresAt: number }>();

export function isBlockedInternalHost(hostname: string): boolean {
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

export function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeGalleryImageUrl(
  rawImg: string,
  pageUrl: string
): string {
  const trimmed = decodeEntities(rawImg || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .trim();
  if (!trimmed || trimmed.startsWith('data:')) return '';
  try {
    const resolved = new URL(trimmed, pageUrl);
    if (!['http:', 'https:'].includes(resolved.protocol)) return '';
    if (isBlockedInternalHost(resolved.hostname)) return '';
    return resolved.toString();
  } catch {
    return '';
  }
}

export function isBadOrLogoImageUrl(imgUrl: string): boolean {
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
    /(og_kream|kream_og|default_og|musinsa_meta|logo|favicon|sprite|apple-touch-icon|meta_default|share_default|common\/og|naver_og|icon_|btn_|badge_|_brand\/|\/brand\/|brand_logo|seller_logo|\/cms\/|banner|event|coupon|avatar|profile)/i.test(
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

// 같은 각도 사진이 리사이즈 쿼리(?type=m_webp 등)만 달라 중복 수집되는 현상을 막기 위한 정규화 키
export function canonicalAngleKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    let pathKey = u.pathname.toLowerCase();
    // 무신사 썸네일 리사이즈 접미어(_500.jpg, _big.jpg 등) 통합하되 각도 번호(_1, _2, _3)는 유지
    pathKey = pathKey
      .replace(/^\/thumbnails\//, '/')
      .replace(/_(?:500|320|220|125|big|small)(\.[a-z0-9]+)$/i, '$1');
    return `${u.hostname.toLowerCase()}${pathKey}`;
  } catch {
    return rawUrl.split('?')[0].toLowerCase();
  }
}

// KREAM / 무신사 고화질 중간 해상도 URL 보정 (빠른 다운로드 + 선명한 디테일)
export function toOptimalFetchUrl(imgUrl: string): string {
  if (imgUrl.includes('kream-phinf.pstatic.net')) {
    const base = imgUrl.split('?')[0];
    return `${base}?type=m_webp`;
  }
  return imgUrl;
}

// 후보 목록에서 실제로 서로 다른 각도(앞·옆·뒤·디테일) 사진만 추려 반환
export function selectDistinctAngleUrls(
  orderedUrls: string[],
  maxAngles = 4
): string[] {
  const deduped: string[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < orderedUrls.length; i++) {
    const u = orderedUrls[i];
    if (!u || isBadOrLogoImageUrl(u)) continue;
    const key = canonicalAngleKey(u);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(toOptimalFetchUrl(u));
  }

  // KREAM 스니커즈 등 360도 회전 뷰(12장 이상 연속 프레임)인 경우 0° / 90° / 180° / 270° 대표 각도로 균등 샘플링!
  if (deduped.length >= 12 && maxAngles >= 3) {
    const n = deduped.length;
    const indices = [
      0,
      Math.floor(n * 0.25),
      Math.floor(n * 0.5),
      Math.floor(n * 0.75),
    ];
    const sampled: string[] = [];
    for (let i = 0; i < indices.length && sampled.length < maxAngles; i++) {
      const item = deduped[indices[i]];
      if (item && !sampled.includes(item)) {
        sampled.push(item);
      }
    }
    return sampled;
  }

  return deduped.slice(0, maxAngles);
}

export async function downloadUrlAsInlineData(
  imgUrl: string,
  refererUrl = '',
  timeoutMs = 4500
): Promise<InlineImageData | null> {
  if (!imgUrl) return null;
  let refererOrigin = '';
  try {
    refererOrigin = refererUrl
      ? new URL(refererUrl).origin + '/'
      : new URL(imgUrl).origin + '/';
  } catch {
    refererOrigin = '';
  }

  const tryFetch = async (target: string, withRef: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(target, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'image/webp,image/avif,image/apng,image/*,*/*;q=0.8',
          ...(withRef && refererOrigin ? { Referer: refererOrigin } : {}),
        },
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!resp.ok) return null;
      const ctype = (resp.headers.get('content-type') || '')
        .toLowerCase()
        .split(';')[0]
        .trim();
      if (
        ctype.startsWith('text/html') ||
        ctype.startsWith('application/json') ||
        ctype.includes('svg')
      ) {
        return null;
      }
      const ab = await resp.arrayBuffer();
      if (ab.byteLength < 600 || ab.byteLength > 4_800_000) return null;
      const mimeType = ctype.startsWith('image/')
        ? ctype
        : target.toLowerCase().includes('webp')
        ? 'image/webp'
        : target.toLowerCase().includes('.png')
        ? 'image/png'
        : 'image/jpeg';
      return {
        mimeType,
        data: Buffer.from(ab).toString('base64'),
        sourceUrl: target,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const optUrl = toOptimalFetchUrl(imgUrl);
  let res = await tryFetch(optUrl, true);
  if (!res) res = await tryFetch(optUrl, false);
  if (!res && optUrl !== imgUrl) {
    res = await tryFetch(imgUrl, true);
  }
  return res;
}

// 상품 상세 URL을 직접 방문해 해당 상품의 앞면·옆면·뒷면 공식 갤러리 이미지 URL 목록을 추출
export async function crawlProductMultiAngleUrls(
  productPageUrl: string,
  maxAngles = 4
): Promise<string[]> {
  if (!productPageUrl || !/^https?:\/\//i.test(productPageUrl)) return [];

  let cleanPageUrl = productPageUrl.split('#')[0].trim();
  try {
    const parsed = new URL(cleanPageUrl);
    if (isBlockedInternalHost(parsed.hostname)) return [];
    cleanPageUrl = parsed.toString();
  } catch {
    return [];
  }

  const now = Date.now();
  const cached = galleryCache.get(cleanPageUrl);
  if (cached && cached.expiresAt > now && cached.urls.length > 0) {
    return cached.urls.slice(0, maxAngles);
  }

  const collectedOrdered: string[] = [];

  // 1단계: 직접 HTML 조회 (JSON-LD Product.image 배열 + 상단 갤러리 CDN 이미지)
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php); kakaotalk-scrap/1.0 (+https://devtalk.kakao.com)',
  ];

  for (let uIdx = 0; uIdx < uas.length; uIdx++) {
    if (selectDistinctAngleUrls(collectedOrdered, maxAngles).length >= 3) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3800);
    try {
      const resp = await fetch(cleanPageUrl, {
        headers: {
          'User-Agent': uas[uIdx],
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (resp.ok) {
        const html = await resp.text();

        // JSON-LD Product.image[] 배열 우선 추출 (앞·옆·뒤 공식 갤러리 배열)
        const ldRegex =
          /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let ldMatch: RegExpExecArray | null;
        while ((ldMatch = ldRegex.exec(html)) !== null) {
          try {
            const parsed = JSON.parse(ldMatch[1].trim());
            const items = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.['@graph'])
              ? parsed['@graph']
              : [parsed];
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              if (
                it &&
                String(it['@type'] || '')
                  .toLowerCase()
                  .includes('product') &&
                it.image
              ) {
                const imgs = Array.isArray(it.image) ? it.image : [it.image];
                for (let j = 0; j < imgs.length; j++) {
                  const raw =
                    typeof imgs[j] === 'string' ? imgs[j] : imgs[j]?.url;
                  const norm = normalizeGalleryImageUrl(raw || '', cleanPageUrl);
                  if (norm) collectedOrdered.push(norm);
                }
              }
            }
          } catch {
            // 무시
          }
        }

        // og:image 대표컷 보장
        const ogMatch = html.match(
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
        );
        if (ogMatch?.[1]) {
          const norm = normalizeGalleryImageUrl(ogMatch[1], cleanPageUrl);
          if (norm) collectedOrdered.push(norm);
        }

        // 본문 상단 갤러리 영역(리뷰·추천 이전 구간)의 상품 스튜디오 CDN URL 추출
        const unescaped = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
        const cutoffMatch = unescaped.match(
          /(?:스타일\s*리뷰|일반\s*리뷰|함께\s*본\s*상품|95점\s*동일\s*상품|style_tab|review_wrap)/i
        );
        const heroHtml = cutoffMatch?.index
          ? unescaped.slice(0, cutoffMatch.index)
          : unescaped.slice(0, 120_000);

        const cdnRegex =
          /https?:\/\/(?:kream-phinf\.pstatic\.net\/[^"'\s<>\\)]+\/[pad]_[0-9a-f]{16,}\.(?:png|jpe?g|webp)|image\.msscdn\.net\/(?:thumbnails\/)?images\/(?:goods_img|prd_img)\/[^"'\s<>\\)]+|img\.29cm\.co\.kr\/(?:next-product|item)\/[^"'\s<>\\)]+|d3ha2047wt6x28\.cloudfront\.net\/[^"'\s<>\\)]+|static\.zara\.net\/photos\/[^"'\s<>\\)]+|shop-phinf\.pstatic\.net\/[^"'\s<>\\)]+)/gi;
        let cm: RegExpExecArray | null;
        while ((cm = cdnRegex.exec(heroHtml)) !== null) {
          const norm = normalizeGalleryImageUrl(cm[0], cleanPageUrl);
          if (norm) collectedOrdered.push(norm);
        }
      }
    } catch {
      // 다음 전략으로 진행
    } finally {
      clearTimeout(timer);
    }
  }

  // 2단계: CSR(클라이언트 렌더링) 페이지여서 1장 이하만 잡힌 경우 Jina Reader로 상단 캐러셀(썸네일 1..N) 다각도 수집!
  if (selectDistinctAngleUrls(collectedOrdered, maxAngles).length < 2) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const jinaResp = await fetch(`https://r.jina.ai/${cleanPageUrl}`, {
        headers: { 'X-Locale': 'ko-KR' },
        signal: controller.signal,
      });
      if (jinaResp.ok) {
        const md = await jinaResp.text();
        // KREAM의 '썸네일 1..8' 슬라이더는 살리고, 하단 '스타일 리뷰 / 일반 리뷰 / 거래 내역 더보기 / 브랜드 / 함께 본 상품'부터 차단!
        const secCutoff = md.match(
          /\n(?:#+\s*)?(?:스타일\s*리뷰|일반\s*리뷰|거래\s*내역\s*더보기|관련\s*기획전|95점\s*동일\s*상품|함께\s*본\s*상품|브랜드\s*\n)/
        );
        const heroMd =
          secCutoff?.index !== undefined ? md.slice(0, secCutoff.index) : md;

        const mdImgRegex = /!\[([\s\S]*?)\]\((https?:\/\/[^)\s"']+)\)/g;
        let m: RegExpExecArray | null;
        while ((m = mdImgRegex.exec(heroMd)) !== null) {
          const alt = m[1].trim();
          // 단일 브랜드명 로고 배제, '썸네일 1..N' 및 상품명 다각도 슬라이드 허용
          if (/^(?:로고|logo|brand)$/i.test(alt)) continue;
          const norm = normalizeGalleryImageUrl(m[2], cleanPageUrl);
          if (norm) collectedOrdered.push(norm);
        }
      }
    } catch {
      // 무시
    } finally {
      clearTimeout(timer);
    }
  }

  const distinct = selectDistinctAngleUrls(collectedOrdered, maxAngles);
  if (distinct.length > 0) {
    galleryCache.set(cleanPageUrl, {
      urls: distinct,
      expiresAt: now + 30 * 60 * 1000,
    });
  }
  return distinct;
}
