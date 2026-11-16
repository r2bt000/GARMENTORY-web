import { NextResponse } from 'next/server';
import {
  canonicalAngleKey,
  crawlProductMultiAngleUrls,
  downloadUrlAsInlineData,
} from '../../lib/productGallery';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type FitTargetId = 'male' | 'female' | 'crop_fit' | 'my_photo';
type StudioAngleId = 'front' | 'left' | 'right' | 'back';
type PhotoSideHint = 'auto' | 'front' | 'back';

interface GarmentInput {
  name: string;
  category: string;
  status?: string;
  image: string;
  sourceUrl?: string;
  extraImages?: string[];
  photoSide?: PhotoSideHint;
}

interface VerifiedGarmentPlanItem {
  name: string;
  category: string;
  // 'PRIMARY' = 클라이언트가 보낸 garment.image 사용 | 'https://...' = 쇼핑몰 갤러리 특정 각도 URL 사용 | 'EXTRA:0' = extraImages[0] | null = 해당 방향 실물 사진 없음(텍스트 스펙만 사용)
  frontSource: string | null;
  sideSource: string | null;
  backSource: string | null;
  frontSpec: string;
  sideSpec: string;
  backSpec: string;
}

interface LookbookRequestBody {
  isDarkMode: boolean;
  fitTarget: FitTargetId;
  angle?: StudioAngleId;
  includePlan?: boolean;
  verifiedPlan?: VerifiedGarmentPlanItem[];
  anchorFrontImage?: string;
  activeGenre: string;
  selectedDetails?: string[];
  garments: GarmentInput[];
  userModelImage?: string;
  preferredEngine?: 'gemini' | 'fashn';
  clientGeminiKey?: string;
  clientFashnKey?: string;
}

interface InlineImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

// 4면 동시 촬영(1회당 4요청) 및 재촬영을 여유 있게 허용하도록 분당 36회로 설정
const lookbookBuckets = new Map<string, number[]>();
function allowLookbookCall(ip: string): boolean {
  const now = Date.now();
  const recent = (lookbookBuckets.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 36) {
    lookbookBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  lookbookBuckets.set(ip, recent);
  return true;
}

// 의류별 앞·옆·뒤 방향 판별 캐시 (재생성 클릭 시에도 100% 동일하게 앞·뒷면 분리 유지!)
const orientationCache = new Map<
  string,
  { item: VerifiedGarmentPlanItem; expiresAt: number }
>();

function makeOrientationCacheKey(g: GarmentInput): string {
  const cleanSrc = String(g.sourceUrl || '').split('#')[0].trim();
  const imgHead = String(g.image || '').slice(0, 96);
  const extraCount = Array.isArray(g.extraImages) ? g.extraImages.length : 0;
  return `${g.category}|${g.name}|${g.photoSide || 'auto'}|${cleanSrc}|${extraCount}|${imgHead}`;
}

const WHITE_STUDIO_PHOTOGRAPHY_DIRECTION =
  'Shot in a clean, minimalist professional fashion e-commerce photography studio against a pure seamless solid white cyclorama wall and white studio floor (#FFFFFF infinity cove). Zero outdoor background, zero furniture, zero props, zero text, zero watermarks, zero split-screen or collage frames. Even, soft commercial catalog lighting (Musinsa / 29CM / SSENSE official studio model lookbook aesthetic) with balanced fill light so dark and black garments retain crisp seam lines, zippers, quilting, hardware, and fabric texture separation against the pure white backdrop, with only a subtle natural soft contact shadow directly beneath the shoes. Vertical 3:4 full-length studio model framing.';

async function resolveImageToInlineData(
  src: string,
  refererHint = ''
): Promise<{ mimeType: string; data: string } | null> {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();

  if (trimmed.startsWith('data:image/svg')) {
    return null;
  }

  if (trimmed.startsWith('data:image/')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return null;
    const meta = trimmed.slice(5, commaIdx);
    const base64Data = trimmed.slice(commaIdx + 1).trim();
    const mimeMatch = /^([a-zA-Z0-9.+/-]+);base64$/i.exec(meta);
    const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/webp';
    if (!base64Data || base64Data.length < 64) return null;
    return { mimeType, data: base64Data };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const downloaded = await downloadUrlAsInlineData(
      trimmed,
      refererHint,
      5000
    );
    if (downloaded) {
      return { mimeType: downloaded.mimeType, data: downloaded.data };
    }
  }

  return null;
}

interface CandidateRef {
  token: string; // 'PRIMARY' | 'EXTRA:0' | 'https://...'
  inline: { mimeType: string; data: string };
}

async function gatherGarmentCandidates(
  g: GarmentInput,
  maxCandidates: number
): Promise<CandidateRef[]> {
  const results: CandidateRef[] = [];
  const seenUrlKeys = new Set<string>();
  const cleanSourceUrl = String(g.sourceUrl || '').split('#')[0].trim();

  // 1) 대표 이미지 (PRIMARY)
  const prim = await resolveImageToInlineData(g.image, cleanSourceUrl);
  if (prim) {
    results.push({ token: 'PRIMARY', inline: prim });
    if (/^https?:\/\//i.test(g.image)) {
      seenUrlKeys.add(canonicalAngleKey(g.image));
    }
  }

  // 2) 사용자/스크래퍼가 저장해 둔 보조 이미지 (EXTRA:i 또는 HTTP URL)
  const rawExtras: { token: string; src: string }[] = [];
  if (Array.isArray(g.extraImages)) {
    for (let i = 0; i < g.extraImages.length; i++) {
      const ex = String(g.extraImages[i] || '').trim();
      if (!ex) continue;
      if (ex.startsWith('data:image/')) {
        rawExtras.push({ token: `EXTRA:${i}`, src: ex });
      } else if (/^https?:\/\//i.test(ex)) {
        const k = canonicalAngleKey(ex);
        if (!seenUrlKeys.has(k)) {
          seenUrlKeys.add(k);
          rawExtras.push({ token: ex, src: ex });
        }
      }
    }
  }

  // 3) 쇼핑몰 상세 페이지(sourceUrl) 실시간 다각도 갤러리 스캔 (앞·옆·뒷면 확보!)
  if (cleanSourceUrl && /^https?:\/\//i.test(cleanSourceUrl)) {
    const crawled = await crawlProductMultiAngleUrls(cleanSourceUrl, 4);
    for (let i = 0; i < crawled.length; i++) {
      const cu = crawled[i];
      const k = canonicalAngleKey(cu);
      if (!seenUrlKeys.has(k)) {
        seenUrlKeys.add(k);
        rawExtras.push({ token: cu, src: cu });
      }
    }
  }

  if (rawExtras.length > 0 && results.length < maxCandidates) {
    const slice = rawExtras.slice(0, maxCandidates);
    const downloaded = await Promise.all(
      slice.map(async (entry) => ({
        token: entry.token,
        inline: await resolveImageToInlineData(entry.src, cleanSourceUrl),
      }))
    );
    // PRIMARY(Supabase WebP 변환본)와 쇼핑몰 첫 번째 슬라이드가 사실상 같은 각도일 수도 있으나,
    // Vision 판별기가 각 후보의 실제 앞/뒤/옆 방향을 직접 눈으로 판별해 가장 정확한 컷을 골라줍니다!
    for (let i = 0; i < downloaded.length; i++) {
      if (results.length >= maxCandidates) break;
      const d = downloaded[i];
      if (d.inline) {
        results.push({ token: d.token, inline: d.inline });
      }
    }
  }

  return results;
}

// [핵심 Stage 1] Gemini 2.5 Flash 비전 분석기로 각 의류의 후보 사진들이 '앞면(FRONT)'인지 '뒷면(BACK)'인지 '측면(SIDE)'인지 사전 분리!
// -> 정면 모델샷 생성 시 '뒷면 그래픽 사진'을 아예 입력에서 물리적으로 제거하여 앞뒤 뒤바뀜을 원천 차단합니다.
async function buildVerifiedGarmentPlan(
  garments: GarmentInput[],
  geminiKey: string
): Promise<VerifiedGarmentPlanItem[]> {
  const now = Date.now();
  const finalPlan: (VerifiedGarmentPlanItem | null)[] = garments.map((g) => {
    const ck = makeOrientationCacheKey(g);
    const hit = orientationCache.get(ck);
    if (hit && hit.expiresAt > now) {
      return hit.item;
    }
    return null;
  });

  const uncachedIndices: number[] = [];
  for (let i = 0; i < garments.length; i++) {
    if (!finalPlan[i]) uncachedIndices.push(i);
  }

  if (uncachedIndices.length === 0) {
    return finalPlan as VerifiedGarmentPlanItem[];
  }

  // 미캐시 의류들의 다각도 후보 이미지들을 병렬 수집
  const candidateLists = await Promise.all(
    uncachedIndices.map((gIdx) => {
      const g = garments[gIdx];
      const maxCands =
        g.category === '상의' || g.category === '아우터' ? 4 : 3;
      return gatherGarmentCandidates(g, maxCands);
    })
  );

  // 비전 분석 프롬프트 조립
  const visionParts: Array<InlineImagePart | { text: string }> = [];
  const itemMetaMap: {
    garmentIdx: number;
    candidates: CandidateRef[];
    globalImgIds: number[];
  }[] = [];

  let imgSeq = 1;
  for (let u = 0; u < uncachedIndices.length; u++) {
    const gIdx = uncachedIndices[u];
    const g = garments[gIdx];
    const cands = candidateLists[u];
    const ids: number[] = [];
    for (let c = 0; c < cands.length; c++) {
      visionParts.push({ inlineData: cands[c].inline });
      ids.push(imgSeq);
      imgSeq += 1;
    }
    itemMetaMap.push({
      garmentIdx: gIdx,
      candidates: cands,
      globalImgIds: ids,
    });
  }

  if (imgSeq > 1) {
    const itemLines = itemMetaMap.map((entry, idx) => {
      const g = garments[entry.garmentIdx];
      const userHint =
        g.photoSide === 'back'
          ? ' (USER EXPLICITLY TAGGED Image 1 AS BACK VIEW!)'
          : g.photoSide === 'front'
          ? ' (USER EXPLICITLY TAGGED Image 1 AS FRONT VIEW!)'
          : '';
      return `Item #${idx}: category="${g.category}", name="${g.name}"${userHint}, candidateImageNumbers=[${entry.globalImgIds.join(
        ', '
      )}]`;
    });

    const classifierPrompt = `You are an expert fashion product photo orientation analyzer.
For each clothing item below, examine its candidateImageNumbers carefully to classify whether each photo shows the FRONT, BACK, or SIDE of the item.
HOW TO DISTINGUISH FRONT vs BACK OF TOPS/JACKETS:
- FRONT view: deeper curved front crew/V neckline scoop, inside back-neck brand/size tag is often visible inside the collar opening, center-front zipper/buttons/drawstrings, small left-chest logo or front graphic.
- BACK view: higher straight/upward-curved rear collar rib that hides the inside neck tag, rear hood panel covering upper back, full-back graphic print across the shoulder blades, or rear yoke. (Many streetwear brands put the BACK graphic as photo #1 and the plain/minimal FRONT chest as photo #2!)
- For pants: front fly/button = FRONT; two rear patch/welt pockets without fly = BACK.

Items to analyze:
${itemLines.join('\n')}

Return ONLY valid JSON matching this exact schema:
{
  "items": [
    {
      "itemIndex": 0,
      "frontImageNumber": <integer from candidateImageNumbers that clearly shows FRONT view, or null if NONE of the candidate images show the front (e.g. only a back-view photo was provided)>,
      "sideImageNumber": <integer from candidateImageNumbers showing a side/angle view, or null>,
      "backImageNumber": <integer from candidateImageNumbers that clearly shows BACK view, or null>,
      "frontSpec": "<concise English visual description of ONLY the FRONT of this garment: exact base color, fabric/wash, fit, collar/zipper, and ONLY genuine front details; if frontImageNumber is null because only a back photo exists, describe a clean plain front in the exact same fabric/color WITHOUT the back graphic!>",
      "sideSpec": "<concise English visual description of the side silhouette, sleeve/leg cut, and drape>",
      "backSpec": "<concise English visual description of ONLY the BACK of this garment, including any back graphic, hood, or rear pockets>"
    }
  ]
}`;

    visionParts.push({ text: classifierPrompt });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9500);
      try {
        const vResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            geminiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: visionParts }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
            signal: controller.signal,
          }
        );

        if (vResp.ok) {
          const vJson = await vResp.json();
          const rawTxt = vJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof rawTxt === 'string' && rawTxt.trim()) {
            const parsed = JSON.parse(rawTxt);
            const arr = Array.isArray(parsed?.items) ? parsed.items : [];

            for (let a = 0; a < arr.length; a++) {
              const row = arr[a];
              const meta = itemMetaMap[Number(row?.itemIndex)];
              if (!meta) continue;
              const g = garments[meta.garmentIdx];

              const mapImgNumToToken = (num: unknown): string | null => {
                if (typeof num !== 'number') return null;
                const pos = meta.globalImgIds.indexOf(num);
                if (pos === -1 || !meta.candidates[pos]) return null;
                return meta.candidates[pos].token;
              };

              let frontToken = mapImgNumToToken(row.frontImageNumber);
              const sideToken = mapImgNumToToken(row.sideImageNumber);
              let backToken = mapImgNumToToken(row.backImageNumber);

              // 사용자가 명시적으로 '뒷면 사진'으로 지정했고 후보가 1장뿐이면 정면 토큰 강제 차단!
              if (g.photoSide === 'back' && meta.candidates.length === 1) {
                frontToken = null;
                backToken = 'PRIMARY';
              } else if (g.photoSide === 'front' && !frontToken && meta.candidates.length >= 1) {
                frontToken = 'PRIMARY';
              }

              const built: VerifiedGarmentPlanItem = {
                name: g.name,
                category: g.category,
                frontSource: frontToken,
                sideSource: sideToken,
                backSource: backToken,
                frontSpec:
                  typeof row.frontSpec === 'string' && row.frontSpec.trim()
                    ? row.frontSpec.trim()
                    : `${g.name} (${g.category}, clean front view)`,
                sideSpec:
                  typeof row.sideSpec === 'string' && row.sideSpec.trim()
                    ? row.sideSpec.trim()
                    : `${g.name} (${g.category}, side profile silhouette)`,
                backSpec:
                  typeof row.backSpec === 'string' && row.backSpec.trim()
                    ? row.backSpec.trim()
                    : `${g.name} (${g.category}, rear view)`,
              };

              finalPlan[meta.garmentIdx] = built;
              orientationCache.set(makeOrientationCacheKey(g), {
                item: built,
                expiresAt: now + 60 * 60 * 1000,
              });
            }
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // 비전 분류 타임아웃 시 아래 안전 기본값으로 폴백
    }
  }

  // 혹시 누락된 항목은 안전한 폴백 플랜 생성
  for (let i = 0; i < garments.length; i++) {
    if (!finalPlan[i]) {
      const g = garments[i];
      const isExplicitBack = g.photoSide === 'back';
      finalPlan[i] = {
        name: g.name,
        category: g.category,
        frontSource: isExplicitBack ? null : 'PRIMARY',
        sideSource: isExplicitBack ? null : 'PRIMARY',
        backSource: isExplicitBack
          ? 'PRIMARY'
          : Array.isArray(g.extraImages) && g.extraImages[0]
          ? g.extraImages[0]
          : null,
        frontSpec: isExplicitBack
          ? `${g.name} (${g.category}): clean plain front matching the garment's base fabric and color, with NO rear back-print graphic on the chest.`
          : `${g.name} (${g.category}) front view.`,
        sideSpec: `${g.name} (${g.category}) side profile drape.`,
        backSpec: `${g.name} (${g.category}) back view.`,
      };
    }
  }

  return finalPlan as VerifiedGarmentPlanItem[];
}

async function resolvePlanSourceToken(
  token: string | null,
  garment: GarmentInput
): Promise<{ mimeType: string; data: string } | null> {
  if (!token) return null;
  const cleanSourceUrl = String(garment.sourceUrl || '').split('#')[0].trim();
  if (token === 'PRIMARY') {
    return resolveImageToInlineData(garment.image, cleanSourceUrl);
  }
  if (token.startsWith('EXTRA:')) {
    const idx = Number(token.slice('EXTRA:'.length));
    const ex = Array.isArray(garment.extraImages)
      ? garment.extraImages[idx]
      : '';
    return ex ? resolveImageToInlineData(ex, cleanSourceUrl) : null;
  }
  return resolveImageToInlineData(token, cleanSourceUrl);
}

async function runFashnVirtualTryOn(
  fashnKey: string,
  userModelImage: string,
  primaryGarment: GarmentInput
): Promise<{ ok: boolean; imageDataUrl?: string; errorMsg?: string }> {
  const categoryMap: Record<string, 'tops' | 'bottoms' | 'one-pieces'> = {
    아우터: 'tops',
    상의: 'tops',
    하의: 'bottoms',
  };
  const mappedCategory = categoryMap[primaryGarment.category] || 'tops';

  try {
    const startResp = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fashnKey}`,
      },
      body: JSON.stringify({
        model_name: 'tryon-v1.6',
        inputs: {
          model_image: userModelImage,
          garment_image: primaryGarment.image,
          category: mappedCategory,
          mode: 'balanced',
        },
      }),
    });

    if (!startResp.ok) {
      const errTxt = await startResp.text();
      return {
        ok: false,
        errorMsg: `FASHN AI 호출 실패 (${startResp.status}): ${errTxt.slice(0, 140)}`,
      };
    }

    const startJson = await startResp.json();
    const predictionId = startJson?.id;
    if (!predictionId) {
      return { ok: false, errorMsg: 'FASHN AI 작업 ID를 받지 못했습니다.' };
    }

    for (let attempt = 0; attempt < 22; attempt++) {
      await new Promise((r) => setTimeout(r, 1800));
      const pollResp = await fetch(
        `https://api.fashn.ai/v1/status/${encodeURIComponent(predictionId)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${fashnKey}` },
          cache: 'no-store',
        }
      );
      if (!pollResp.ok) continue;
      const pollJson = await pollResp.json();
      if (pollJson?.status === 'completed') {
        const outUrl = Array.isArray(pollJson.output)
          ? pollJson.output[0]
          : pollJson.output;
        if (typeof outUrl === 'string' && outUrl.startsWith('http')) {
          const inline = await resolveImageToInlineData(outUrl);
          if (inline) {
            return {
              ok: true,
              imageDataUrl: `data:${inline.mimeType};base64,${inline.data}`,
            };
          }
          return { ok: true, imageDataUrl: outUrl };
        }
      }
      if (pollJson?.status === 'failed' || pollJson?.status === 'canceled') {
        return {
          ok: false,
          errorMsg: `FASHN AI 생성 실패: ${String(pollJson?.error || '알 수 없는 오류')}`,
        };
      }
    }

    return { ok: false, errorMsg: 'FASHN AI 응답 대기 시간이 초과되었습니다.' };
  } catch {
    return { ok: false, errorMsg: 'FASHN AI 네트워크 통신 중 오류가 발생했습니다.' };
  }
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'anon';

    if (!allowLookbookCall(ip)) {
      return NextResponse.json(
        {
          success: false,
          rateLimited: true,
          message:
            '잠시 요청이 집중되었습니다. 몇 초 후 다시 촬영 버튼을 눌러주세요.',
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as LookbookRequestBody;
    const garments = Array.isArray(body.garments) ? body.garments.slice(0, 5) : [];
    const angle: StudioAngleId =
      body.angle === 'left' || body.angle === 'right' || body.angle === 'back'
        ? body.angle
        : 'front';

    if (garments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '모델샷을 생성할 의류를 1벌 이상 먼저 터치해 선택해 주세요.',
        },
        { status: 400 }
      );
    }

    const geminiKey = (
      body.clientGeminiKey ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();
    const fashnKey = (
      body.clientFashnKey ||
      process.env.FASHN_API_KEY ||
      ''
    ).trim();

    if (
      angle === 'front' &&
      body.fitTarget === 'my_photo' &&
      body.userModelImage &&
      fashnKey &&
      (body.preferredEngine === 'fashn' || !geminiKey)
    ) {
      const primaryGarment =
        garments.find((g) => g.category === '아우터') ||
        garments.find((g) => g.category === '상의') ||
        garments[0];
      const fashnRes = await runFashnVirtualTryOn(
        fashnKey,
        body.userModelImage,
        primaryGarment
      );
      if (fashnRes.ok && fashnRes.imageDataUrl) {
        return NextResponse.json({
          success: true,
          angle: 'front',
          imageDataUrl: fashnRes.imageDataUrl,
          engineLabel: 'FASHN AI Virtual Try-On v1.6',
          presetLabel: '화이트 스튜디오 · 내 사진 피팅',
        });
      }
      if (!geminiKey) {
        return NextResponse.json(
          {
            success: false,
            message: fashnRes.errorMsg || '가상 피팅 생성에 실패했습니다.',
          },
          { status: 502 }
        );
      }
    }

    if (!geminiKey) {
      return NextResponse.json({
        success: false,
        missingKey: true,
        message:
          '화이트 스튜디오 AI 모델샷 엔진을 작동하려면 GEMINI_API_KEY가 필요합니다. 우측 상단 [DB · API] 창에 키를 입력하거나 Vercel 환경변수(GEMINI_API_KEY)에 등록해 주세요.',
      });
    }

    // 1) 의류별 앞·옆·뒤 방향 검증 플랜 확보 (전달받았으면 즉시 재사용, 없으면 비전 분석 실행)
    const verifiedPlan: VerifiedGarmentPlanItem[] =
      Array.isArray(body.verifiedPlan) &&
      body.verifiedPlan.length === garments.length
        ? body.verifiedPlan
        : await buildVerifiedGarmentPlan(garments, geminiKey);

    const parts: Array<InlineImagePart | { text: string }> = [];
    const referenceMappingLines: string[] = [];
    let refCounter = 1;

    // 2) 좌측·우측·후면 촬영 시에는 이미 생성된 '정면 모델샷(anchorFrontImage)'을 #1번 기준 앵커로 주입해 동일 인물·동일 코디·동일 조명 100% 고정!
    let hasAnchorFront = false;
    if (angle !== 'front' && body.anchorFrontImage) {
      const anchorInline = await resolveImageToInlineData(body.anchorFrontImage);
      if (anchorInline) {
        parts.push({ inlineData: anchorInline });
        if (angle === 'back') {
          referenceMappingLines.push(
            `- Reference Image #${refCounter}: FRONT-SHOT MODEL & OUTFIT CONSISTENCY ANCHOR (keep this EXACT SAME model's hair/headwear, body build, trouser color/wash, shoe color/style, and pure white studio lighting — now turn this exact person 180 degrees around so we see ONLY their full BACK from behind!).`
          );
        } else {
          referenceMappingLines.push(
            `- Reference Image #${refCounter}: FRONT-SHOT MODEL & OUTFIT CONSISTENCY ANCHOR (keep this EXACT SAME model's face, hair, eyewear, body proportions, exact garments, trouser wash, shoes, and pure white studio lighting — now rotate this exact person 90 degrees to show their ${
              angle === 'left' ? 'LEFT' : 'RIGHT'
            } SIDE PROFILE!).`
          );
        }
        refCounter += 1;
        hasAnchorFront = true;
      }
    }

    // 내 사진 직접 피팅인 경우 (정면 촬영 또는 앵커가 없을 때)
    let hasUserPhotoInline = false;
    if (!hasAnchorFront && body.fitTarget === 'my_photo' && body.userModelImage) {
      const userInline = await resolveImageToInlineData(body.userModelImage);
      if (userInline) {
        parts.push({ inlineData: userInline });
        referenceMappingLines.push(
          `- Reference Image #${refCounter}: TARGET PERSON PHOTO (preserve this exact person's identity, hair, and body proportions inside a pure white photography studio).`
        );
        refCounter += 1;
        hasUserPhotoInline = true;
      }
    }

    // 3) 촬영 각도(angle)에 정확히 일치하는 의류 참조 사진만 선별 첨부! (정면 촬영 시 뒷면 그래픽 사진은 물리적으로 제외!)
    const hasOuterSelected = garments.some((g) => g.category === '아우터');
    const allNamesJoined = garments.map((g) => `${g.name} ${g.category}`).join(' ');
    const hasHeadAccessory =
      /(선글라스|아이웨어|안경|고글|아이\s*자켓|모자|볼캡|비니|버킷햇|eye\s*jacket|sunglasses|eyewear|glasses|goggles|cap|hat|beanie)/i.test(
        allNamesJoined
      );

    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const plan = verifiedPlan[i];
      const cleanName = String(g.name || '선택 의류').slice(0, 80);
      const cleanCat = String(g.category || '의류').slice(0, 20);

      // 아우터를 입은 상태에서 뒷모습(back)을 찍을 때, 이너 상의의 등판 그래픽 사진을 넣으면 아우터 등에 잘못 합성될 수 있으므로 원천 차단!
      if (angle === 'back' && hasOuterSelected && g.category === '상의') {
        referenceMappingLines.push(
          `- Inner Top [${cleanCat}] "${cleanName}": worn underneath the outer jacket (covered from behind by the outer jacket; only a subtle clean bottom hem edge may peek out if longer).`
        );
        continue;
      }

      let targetToken: string | null = null;
      let specText = plan.frontSpec;

      if (angle === 'front') {
        targetToken = plan.frontSource;
        specText = plan.frontSpec;
      } else if (angle === 'back') {
        // 뒷면 사진이 있으면 최우선 사용! 없으면(예: 신발·무지 바지 등) 정면/기본 사진 참고하되 뒷면 스펙 적용
        targetToken =
          plan.backSource ||
          (g.category === '신발' || g.category === '하의'
            ? plan.frontSource
            : null);
        specText = plan.backSpec;
      } else {
        // 좌/우 측면 촬영: 측면 사진이 있으면 최우선, 없으면 정면 사진 참고 (뒷면 그래픽 사진은 절대 넣지 않음!)
        targetToken = plan.sideSource || plan.frontSource;
        specText = `${plan.sideSpec} (Front reference detail: ${plan.frontSpec})`;
      }

      const resolvedInline = await resolvePlanSourceToken(targetToken, g);
      if (resolvedInline) {
        parts.push({ inlineData: resolvedInline });
        referenceMappingLines.push(
          `- Reference Image #${refCounter} ([${cleanCat}] "${cleanName}" — verified ${angle.toUpperCase()}-compatible reference): ${specText}`
        );
        refCounter += 1;
      } else {
        referenceMappingLines.push(
          `- Garment Specification ONLY ([${cleanCat}] "${cleanName}" — NO rear graphic leakage allowed): ${specText}`
        );
      }
    }

    // 4) 전·좌·우·후 4면 쇼핑몰 카탈로그 카메라 구도 지시문
    const anglePoseInstructions: Record<StudioAngleId, string> = {
      front:
        'STRICT 0-DEGREE FULL FRONT VIEW: Model standing upright facing directly toward the camera (head-to-toe front catalog pose, arms relaxed naturally at sides). If both an outer jacket and an inner top are worn, wear the outer jacket naturally open/unzipped in front so the clean front of the inner top is visible.',
      left:
        'STRICT 90-DEGREE LEFT SIDE PROFILE VIEW: Model turned 90 degrees sideways (facing toward the left edge of the frame in a clean perpendicular side-profile catalog stance from head to shoes), clearly showing the left sleeve, side silhouette/drape of the jacket/top and trousers, and the full side profile of the shoes.',
      right:
        'STRICT 90-DEGREE RIGHT SIDE PROFILE VIEW: Model turned 90 degrees sideways to the opposite side (facing toward the right edge of the frame in a clean perpendicular side-profile catalog stance from head to shoes), clearly showing the right sleeve, side seam/pocket drape of the trousers, and the opposite side profile of the shoes.',
      back:
        'STRICT 180-DEGREE FULL REAR / BACK VIEW: Model turned completely 180 degrees away from the camera (facing the white studio back wall, showing the back of the head/hood, full back of the upper garment, rear pockets and leg drape of the trousers, and heels of the shoes). Do NOT turn torso toward the camera.',
    };

    const genderLabel =
      body.fitTarget === 'female'
        ? 'clean-cut Korean female fashion lookbook model in her mid-20s'
        : 'clean-cut Korean male fashion lookbook model in his mid-20s';

    let subjectDirection = `A ${genderLabel}. ${anglePoseInstructions[angle]}`;
    if (hasUserPhotoInline && angle === 'front') {
      subjectDirection = `Virtual Try-On in White Studio: Dress the exact person from Reference Image #1 in all selected garments below in a clean front-facing full-body white studio pose.`;
    } else if (body.fitTarget === 'crop_fit' && !hasHeadAccessory) {
      subjectDirection = `Neck-to-toe e-commerce studio crop (framed from just below the chin/neck base down to the shoes) on a ${genderLabel}. ${anglePoseInstructions[angle]}`;
    }

    const detailKeywords = Array.isArray(body.selectedDetails)
      ? body.selectedDetails.slice(0, 6).join(', ')
      : '';

    const selectedCategories = garments.map((g) => g.category);
    const missingBasicsParts: string[] = [];
    if (!selectedCategories.includes('상의'))
      missingBasicsParts.push('a clean plain solid neutral inner t-shirt');
    if (!selectedCategories.includes('하의'))
      missingBasicsParts.push('clean minimal wide-fit trousers');
    if (!selectedCategories.includes('신발'))
      missingBasicsParts.push('clean minimal sneakers or leather derby shoes');

    const autoCompleteNote =
      missingBasicsParts.length > 0 && !hasAnchorFront
        ? `For unselected categories (${missingBasicsParts.join(
            ', '
          )}), pair understated plain neutral basics.`
        : 'Maintain 100% identical garments, colors, washes, and proportions across the entire outfit.';

    const masterPrompt = [
      `Generate ONE single photorealistic vertical 3:4 shopping-mall studio model photograph showing ONLY the ${angle.toUpperCase()} view (NO multi-panel collage, NO split screen, NO multiple figures, NO text, NO watermarks).`,
      angle === 'front'
        ? 'CRITICAL FRONT-CHEST RULE: Never invent or place a large back-print graphic onto the front chest of an inner shirt or jacket unless it explicitly appears in the verified FRONT reference!'
        : 'CRITICAL MULTI-ANGLE CONSISTENCY RULE: Keep the exact same model hair/build, exact same garment colors/fabric/wash, exact same footwear, and exact same pure white studio lighting as the Front Anchor (#1), changing ONLY the camera/body rotation angle as instructed!',
      `Styling Genre Reference: ${String(body.activeGenre || '미니멀').slice(0, 40)}${
        detailKeywords ? ` (${detailKeywords})` : ''
      }.`,
      `Camera Angle & Model Pose: ${subjectDirection}`,
      'Garment References for This Angle:',
      ...referenceMappingLines,
      autoCompleteNote,
      `Studio Background & Lighting (STRICT): ${WHITE_STUDIO_PHOTOGRAPHY_DIRECTION}`,
    ].join('\n');

    parts.push({ text: masterPrompt });

    const candidateModels = [
      'gemini-2.5-flash-image',
      'gemini-2.0-flash-preview-image-generation',
    ];

    let lastStatus = 500;
    let lastErrorDetail = '';

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const modelId = candidateModels[mIdx];
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(
        geminiKey
      )}`;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });

      lastStatus = resp.status;

      if (!resp.ok) {
        const errBody = await resp.text();
        lastErrorDetail = errBody.slice(0, 260);
        if (resp.status === 404 || resp.status === 400) {
          continue;
        }
        break;
      }

      const data = await resp.json();
      const respParts = data?.candidates?.[0]?.content?.parts;
      if (Array.isArray(respParts)) {
        for (let pIdx = 0; pIdx < respParts.length; pIdx++) {
          const part = respParts[pIdx];
          const inlineData = part?.inlineData || part?.inline_data;
          if (inlineData?.data) {
            const outMime =
              inlineData.mimeType || inlineData.mime_type || 'image/png';
            return NextResponse.json({
              success: true,
              angle,
              imageDataUrl: `data:${outMime};base64,${inlineData.data}`,
              verifiedPlan: body.includePlan ? verifiedPlan : undefined,
              engineLabel: 'White Studio · 4면(전·좌·우·후) 카탈로그 엔진',
              presetLabel: '화이트 스튜디오 4면 모델샷',
            });
          }
        }
      }
      lastErrorDetail = '모델 응답에 이미지 데이터가 포함되지 않았습니다.';
    }

    let friendlyMsg =
      'AI 모델샷 생성 중 일시적인 오류가 발생했습니다. 잠시 후 다시 촬영 버튼을 눌러주세요.';
    if (lastStatus === 429 || lastErrorDetail.includes('RESOURCE_EXHAUSTED')) {
      friendlyMsg =
        'Google AI Studio 이미지 생성 할당량(Quota)에 도달했습니다. 잠시 후 다시 촬영 버튼을 눌러주세요.';
    } else if (
      lastStatus === 401 ||
      lastStatus === 403 ||
      lastErrorDetail.includes('API_KEY_INVALID')
    ) {
      friendlyMsg =
        '입력된 GEMINI_API_KEY가 올바르지 않거나 권한이 없습니다. Google AI Studio에서 발급한 키를 확인해 주세요.';
    }

    return NextResponse.json(
      {
        success: false,
        angle,
        status: lastStatus,
        message: friendlyMsg,
      },
      { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message:
          '서버에서 스튜디오 모델샷 요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 }
    );
  }
}
