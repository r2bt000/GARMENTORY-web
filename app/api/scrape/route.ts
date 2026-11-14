import { NextResponse } from 'next/server';

function detectStoreName(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('musinsa')) return 'MUSINSA';
  if (lower.includes('kream')) return 'KREAM';
  if (lower.includes('a-bly') || lower.includes('ably')) return 'ABLY';
  if (lower.includes('29cm')) return '29CM';
  if (lower.includes('zara')) return 'ZARA';
  if (lower.includes('naver')) return 'NAVER SHOPPING';
  return 'ONLINE STORE';
}

function inferCategory(title: string): '아우터' | '상의' | '하의' | '신발' | '악세사리' {
  const t = title.toLowerCase();
  if (/(자켓|재킷|코트|블레이저|패딩|점퍼|가디건|파카|집업|아우터|jacket|coat|blazer|cardigan)/.test(t)) {
    return '아우터';
  }
  if (/(팬츠|데님|청바지|슬랙스|바지|쇼츠|스커트|치마|카고|치노|pants|denim|jeans|skirt)/.test(t)) {
    return '하의';
  }
  if (/(부츠|로퍼|더비|스니커즈|신발|슈즈|운동화|샌들|왈라비|슬리퍼|boots|shoes|sneakers|loafer)/.test(t)) {
    return '신발';
  }
  if (/(볼캡|모자|비니|백|가방|벨트|체인|목걸이|반지|팔찌|안경|선글라스|머플러|초커|cap|bag|belt|chain|ring)/.test(t)) {
    return '악세사리';
  }
  return '상의';
}

function extractMetaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const regex of patterns) {
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const store = detectStoreName(url);

    // 1차: 서버 직접 Open Graph 메타태그 파싱 (브라우저 CORS 제한 우회)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const htmlRes = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const ogTitle =
          extractMetaContent(html, 'og:title') ||
          extractMetaContent(html, 'twitter:title');
        const ogImage =
          extractMetaContent(html, 'og:image') ||
          extractMetaContent(html, 'twitter:image');
        const rawPrice =
          extractMetaContent(html, 'product:price:amount') ||
          extractMetaContent(html, 'og:price:amount');

        if (ogTitle) {
          const cleanTitle = ogTitle
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .slice(0, 48);

          const formattedPrice =
            rawPrice && !Number.isNaN(Number(rawPrice))
              ? `${Number(rawPrice).toLocaleString('ko-KR')}원`
              : '실시간 링크 연동 상품';

          return NextResponse.json({
            success: true,
            store,
            name: cleanTitle,
            price: formattedPrice,
            category: inferCategory(cleanTitle),
            season: '사계절',
            image: ogImage || '',
          });
        }
      }
    } catch {
      // 일부 쇼핑몰 봇 차단 시 2차 폴백으로 진행
    }

    // 2차: Microlink 메타데이터 API 폴백
    try {
      const microRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(url)}`
      );
      const microJson = await microRes.json();
      if (microJson?.status === 'success' && microJson?.data?.title) {
        const cleanTitle = String(microJson.data.title).slice(0, 48);
        return NextResponse.json({
          success: true,
          store,
          name: cleanTitle,
          price: '실시간 링크 연동 상품',
          category: inferCategory(cleanTitle),
          season: '사계절',
          image: microJson?.data?.image?.url || '',
        });
      }
    } catch {
      // 폴백 진행
    }

    return NextResponse.json({
      success: false,
      store,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
