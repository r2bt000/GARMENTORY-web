import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface StylistRequestBody {
  isDarkMode: boolean;
  activeGenre: string;
  items: { name: string; category: string }[];
  selectedDetails: string[];
  budget: string;
  clientGeminiKey?: string;
}

const stylistBuckets = new Map<string, number[]>();
function allowStylistCall(ip: string): boolean {
  const now = Date.now();
  const recent = (stylistBuckets.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 20) {
    stylistBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  stylistBuckets.set(ip, recent);
  return true;
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'anon';
    if (!allowStylistCall(ip)) {
      return NextResponse.json({ usedRealApi: false, rateLimited: true }, { status: 429 });
    }

    const body = (await request.json()) as StylistRequestBody;
    const apiKey = (body.clientGeminiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({ usedRealApi: false });
    }

    const itemNames = (body.items || [])
      .slice(0, 12)
      .map((p) => `${String(p.name || '').slice(0, 60)}(${String(p.category || '').slice(0, 12)})`)
      .join(', ');

    const promptText = `당신은 한국의 하이엔드 패션 디렉터입니다. 현재 모드: ${
      body.isDarkMode
        ? '언더그라운드 서브컬처(펑크/고스/로리타/아방가르드)'
        : '메이저 핀터레스트 에디토리얼'
    }. 장르: ${String(body.activeGenre || '').slice(0, 40)}. 사용자가 터치로 선택한 의류: [${itemNames}]. 선호 디테일: ${(
      body.selectedDetails || []
    )
      .slice(0, 10)
      .join(', ')}. 예산: ${String(body.budget || '').slice(0, 30)}.
다음 JSON 형식으로만 응답하세요:
{"title": "감각적인 코디 제목", "note": "2~3문장의 구체적인 핏/레이어링 스타일링 팁", "missingItems": [{"name": "KREAM이나 무신사에서 검색 잘 되는 구체적인 아이템명 1", "reason": "추천 이유 한 줄"}, {"name": "구체적인 아이템명 2", "reason": "추천 이유 한 줄"}]}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!resp.ok) {
      return NextResponse.json({ usedRealApi: false });
    }

    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ usedRealApi: false });
    }

    const parsed = JSON.parse(rawText);
    if (parsed && parsed.note) {
      return NextResponse.json({
        usedRealApi: true,
        title: parsed.title || `${body.activeGenre} 원터치 커스텀 룩`,
        note: parsed.note,
        missingItems: Array.isArray(parsed.missingItems) ? parsed.missingItems : null,
      });
    }

    return NextResponse.json({ usedRealApi: false });
  } catch {
    return NextResponse.json({ usedRealApi: false });
  }
}
