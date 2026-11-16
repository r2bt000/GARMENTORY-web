import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export type StylePresetId =
  | 'editorial_street'
  | 'minimal_studio'
  | 'underground_flash';

export type FitTargetId = 'crop_fit' | 'female' | 'male' | 'my_photo';

interface GarmentInput {
  name: string;
  category: string;
  status?: string;
  image: string;
}

interface LookbookRequestBody {
  isDarkMode: boolean;
  stylePreset: StylePresetId;
  fitTarget: FitTargetId;
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

// IP당 분당 최대 10회 화보 생성 허용 (API 과금·쿼터 보호)
const lookbookBuckets = new Map<string, number[]>();
function allowLookbookCall(ip: string): boolean {
  const now = Date.now();
  const recent = (lookbookBuckets.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) {
    lookbookBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  lookbookBuckets.set(ip, recent);
  return true;
}

const STYLE_LOCK_PROMPTS: Record<
  StylePresetId,
  { label: string; photographyPrompt: string }
> = {
  editorial_street: {
    label: '한남·성수 스트릿 스냅',
    photographyPrompt:
      'Shot on Contax T2 35mm film camera, soft overcast natural daylight in Seoul Hannam-dong / Seongsu architectural concrete and warm limestone sidewalk, effortless candid full-body street fashion lookbook framing, subtle 35mm film grain, muted neutral editorial color grading, natural fabric movement and realistic shadows, vertical 3:4 Pinterest fashion editorial photograph.',
  },
  minimal_studio: {
    label: '클린 호리존 스튜디오',
    photographyPrompt:
      'High-fashion Korean contemporary e-commerce lookbook photography (29CM / Musinsa Studio Editorial aesthetic) in front of a clean seamless warm off-white plaster cyclorama wall and matte concrete floor, soft diffused studio key lighting with gentle natural floor shadow, crisp full-body vertical 3:4 portrait framing, ultra-accurate garment color, stitching, hardware, and drape fidelity.',
  },
  underground_flash: {
    label: '언더그라운드 플래시 아카이브',
    photographyPrompt:
      'Raw 35mm point-and-shoot night street snap with direct on-camera xenon flash, dark industrial concrete alley and brushed metallic shutter backdrop, high-contrast Tokyo/Paris underground archive magazine aesthetic (Rick Owens / avant-garde subculture mood), crisp specular flash highlights on leather, denim, and silver hardware, vertical 3:4 editorial lookbook photograph.',
  },
};

async function resolveImageToInlineData(
  src: string
): Promise<{ mimeType: string; data: string } | null> {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();

  // SVG 아이콘 데이터는 바이너리 참조 이미지에서 제외 (텍스트 설명으로만 반영)
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    try {
      const resp = await fetch(trimmed, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!resp.ok) return null;
      const contentType = (resp.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!contentType.startsWith('image/') || contentType.includes('svg')) {
        return null;
      }
      const ab = await resp.arrayBuffer();
      if (ab.byteLength < 200 || ab.byteLength > 4_200_000) return null;
      const base64 = Buffer.from(ab).toString('base64');
      return { mimeType: contentType, data: base64 };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
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
            '분당 화보 생성 요청 한도(10회)에 도달했습니다. 잠시 후 다시 시도해 주세요.',
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as LookbookRequestBody;
    const garments = Array.isArray(body.garments) ? body.garments.slice(0, 5) : [];

    if (garments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '화보를 생성할 의류를 1벌 이상 먼저 터치해 선택해 주세요.',
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

    // 전용 FASHN AI 엔진 우선 요청 시 처리 (내 전신 사진 가상 피팅)
    if (
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
          imageDataUrl: fashnRes.imageDataUrl,
          engineLabel: 'FASHN AI Virtual Try-On v1.6',
          presetLabel: '내 전신 사진 가상 피팅',
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
          'AI 실사 화보 엔진을 작동하려면 GEMINI_API_KEY가 필요합니다. 우측 상단 [DB · API] 창에 키를 입력하거나 Vercel 환경변수(GEMINI_API_KEY)에 등록해 주세요.',
      });
    }

    const presetKey: StylePresetId =
      body.stylePreset && STYLE_LOCK_PROMPTS[body.stylePreset]
        ? body.stylePreset
        : body.isDarkMode
        ? 'underground_flash'
        : 'editorial_street';
    const presetObj = STYLE_LOCK_PROMPTS[presetKey];

    const parts: Array<InlineImagePart | { text: string }> = [];
    const referenceMappingLines: string[] = [];
    let refCounter = 1;

    // 1) 내 전신 사진이 업로드된 경우 첫 번째 참조 이미지로 주입
    let hasUserPhotoInline = false;
    if (body.fitTarget === 'my_photo' && body.userModelImage) {
      const userInline = await resolveImageToInlineData(body.userModelImage);
      if (userInline) {
        parts.push({ inlineData: userInline });
        referenceMappingLines.push(
          `- Reference Image #${refCounter}: TARGET PERSON PHOTO (keep this exact person's body proportions, pose, skin tone, hairstyle, and identity, and dress them naturally in all selected garments below).`
        );
        refCounter += 1;
        hasUserPhotoInline = true;
      }
    }

    // 2) 선택된 옷장 의류 이미지들을 순서대로 인라인 참조 이미지로 주입
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const cleanName = String(g.name || '선택 의류').slice(0, 80);
      const cleanCat = String(g.category || '의류').slice(0, 20);
      const inline = await resolveImageToInlineData(g.image);
      if (inline) {
        parts.push({ inlineData: inline });
        referenceMappingLines.push(
          `- Reference Image #${refCounter}: [${cleanCat}] "${cleanName}" — faithfully reproduce the exact garment silhouette, color, fabric texture, collar/zipper/pocket details, and any small emblem from this product photo.`
        );
        refCounter += 1;
      } else {
        referenceMappingLines.push(
          `- Garment Item (text description): [${cleanCat}] "${cleanName}".`
        );
      }
    }

    // 3) 피팅 대상 모델 디렉션 구성
    let subjectDirection =
      'A stylish Korean fashion editorial model in their mid-20s standing naturally from head to toe (full-body shot including shoes).';
    if (hasUserPhotoInline) {
      subjectDirection =
        'Virtual Try-On: Dress the exact person from Reference Image #1 in the complete outfit below. Preserve the person’s face, body build, and natural stance while seamlessly replacing their clothing with all selected garments.';
    } else if (body.fitTarget === 'crop_fit') {
      subjectDirection =
        'A Pinterest OOTD neck-to-toe editorial crop (framed cleanly from just below the chin down to the shoes so focus is 100% on outfit proportions, layering, and footwear) on a stylish model in their mid-20s.';
    } else if (body.fitTarget === 'female') {
      subjectDirection =
        'A stylish Korean female fashion editorial model in her mid-20s, effortless full-body head-to-toe standing pose showing outerwear/top, bottoms, and footwear clearly.';
    } else if (body.fitTarget === 'male') {
      subjectDirection =
        'A stylish Korean male fashion editorial model in his mid-20s, effortless full-body head-to-toe standing pose showing outerwear/top, bottoms, and footwear clearly.';
    }

    const detailKeywords = Array.isArray(body.selectedDetails)
      ? body.selectedDetails.slice(0, 6).join(', ')
      : '';

    // 누락된 카테고리(예: 아우터만 선택했을 때 이너/바지/신발)는 장르에 맞는 무채색 미니멀 베이직으로 자연스럽게 매칭 지시
    const selectedCategories = garments.map((g) => g.category);
    const autoCompleteNote =
      selectedCategories.length < 3
        ? 'For any clothing category not explicitly provided in the list (such as neutral inner tee, clean wide trousers, or minimal leather shoes/sneakers), pair understated neutral basics that harmonize with the featured garment without stealing focus.'
        : 'Combine all selected garments together into one cohesive layered outfit on a single person.';

    const masterPrompt = [
      'Generate ONE single photorealistic vertical 3:4 high-fashion editorial lookbook photograph (NO split screen, NO collage, NO floating product cutouts, NO text, NO watermarks, NO UI overlays).',
      `Fashion Mood & Styling Genre: ${String(body.activeGenre || '미니멀').slice(0, 40)}${
        detailKeywords ? ` (${detailKeywords})` : ''
      }.`,
      `Subject & Framing: ${subjectDirection}`,
      'Selected Wardrobe Garments to Wear Together:',
      ...referenceMappingLines,
      autoCompleteNote,
      `Style-Lock Photography & Lighting Direction: ${presetObj.photographyPrompt}`,
      'Ensure realistic garment layering, natural fabric folds, accurate proportions, and authentic high-fashion lookbook realism.',
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
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });

      lastStatus = resp.status;

      if (!resp.ok) {
        const errBody = await resp.text();
        lastErrorDetail = errBody.slice(0, 260);
        // 모델 미지원(404)이거나 지역/모달리티 호환 오류(400)일 때만 예비 모델로 재시도
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
              imageDataUrl: `data:${outMime};base64,${inlineData.data}`,
              engineLabel:
                modelId === 'gemini-2.5-flash-image'
                  ? 'Gemini 2.5 Flash Image · Style-Lock'
                  : 'Gemini Multimodal Image · Style-Lock',
              presetLabel: presetObj.label,
            });
          }
        }
      }
      lastErrorDetail = '모델 응답에 이미지 데이터가 포함되지 않았습니다.';
    }

    // 친절한 한국어 원인 안내 메시지 분기
    let friendlyMsg =
      'AI 화보 생성 중 일시적인 오류가 발생했습니다. 잠시 후 다시 촬영 버튼을 눌러주세요.';
    if (lastStatus === 429 || lastErrorDetail.includes('RESOURCE_EXHAUSTED')) {
      friendlyMsg =
        'Google AI Studio 이미지 생성 무료 할당량(Quota)을 초과했거나 이미지 모델이 유료 결제 계정(Tier 1) 연결을 요구하고 있습니다. AI Studio 쿼터 설정을 확인해 주세요.';
    } else if (
      lastStatus === 401 ||
      lastStatus === 403 ||
      lastErrorDetail.includes('API_KEY_INVALID')
    ) {
      friendlyMsg =
        '입력된 GEMINI_API_KEY가 올바르지 않거나 권한이 없습니다. Google AI Studio에서 발급한 키를 다시 확인해 주세요.';
    }

    return NextResponse.json(
      {
        success: false,
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
          '서버에서 화보 요청을 처리하는 중 오류가 발생했습니다. 의류 이미지 용량을 확인하거나 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 }
    );
  }
}
