import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export type FitTargetId = 'male' | 'female' | 'crop_fit' | 'my_photo';

interface GarmentInput {
  name: string;
  category: string;
  status?: string;
  image: string;
}

interface LookbookRequestBody {
  isDarkMode: boolean;
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

// IP당 분당 최대 10회 화보 생성 허용 (API 쿼터 보호)
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

const WHITE_STUDIO_PHOTOGRAPHY_DIRECTION =
  'Shot in a clean, minimalist professional fashion photography studio against a pure seamless solid white cyclorama wall and white studio floor (#FFFFFF infinity cove). Zero outdoor background, zero furniture, zero props, zero text, zero logos or watermarks. Even, soft commercial lookbook lighting (SSENSE / 29CM / Musinsa Studio official catalog model shot aesthetic) with balanced fill light so dark and black garments retain crisp seam lines, zippers, quilting, hardware, and fabric texture separation against the clean white backdrop, with only a subtle natural soft contact shadow directly beneath the shoes. Vertical 3:4 full-length studio lookbook framing.';

async function resolveImageToInlineData(
  src: string
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    try {
      const resp = await fetch(trimmed, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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
            '분당 스튜디오 모델샷 생성 한도(10회)에 도달했습니다. 잠시 후 다시 시도해 주세요.',
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
          `- Reference Image #${refCounter}: TARGET PERSON PHOTO (preserve this exact person's face, hairstyle, body proportions, and natural standing pose, dress them in all selected garments below, and place them cleanly inside a pure white cyclorama photography studio).`
        );
        refCounter += 1;
        hasUserPhotoInline = true;
      }
    }

    // 2) 선택된 옷장 의류 이미지들을 순서대로 인라인 참조 이미지로 주입
    const allNamesJoined = garments.map((g) => `${g.name} ${g.category}`).join(' ');
    const hasHeadAccessory =
      /(선글라스|아이웨어|안경|고글|아이\s*자켓|모자|볼캡|비니|버킷햇|eye\s*jacket|sunglasses|eyewear|glasses|goggles|cap|hat|beanie)/i.test(
        allNamesJoined
      );

    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const cleanName = String(g.name || '선택 의류').slice(0, 80);
      const cleanCat = String(g.category || '의류').slice(0, 20);
      const inline = await resolveImageToInlineData(g.image);
      if (inline) {
        parts.push({ inlineData: inline });
        referenceMappingLines.push(
          `- Reference Image #${refCounter}: [${cleanCat}] "${cleanName}" — faithfully reproduce the exact garment silhouette, color, fabric texture, collar/zipper/pocket details, and any small logo from this product photo.`
        );
        refCounter += 1;
      } else {
        referenceMappingLines.push(
          `- Garment Item (text description): [${cleanCat}] "${cleanName}".`
        );
      }
    }

    // 3) 화이트 스튜디오 모델 디렉션 구성
    let subjectDirection =
      'A clean-cut Korean male fashion lookbook model in his mid-20s standing in a relaxed, natural front-facing full-body catalog pose from head to shoes (entire head and shoes fully visible inside frame).';
    let presetBadgeLabel = '화이트 스튜디오 · 남성 모델샷';

    if (hasUserPhotoInline) {
      subjectDirection =
        'Virtual Try-On in White Studio: Dress the exact person from Reference Image #1 in all selected garments below while placing them cleanly in a pure white studio cyclorama background.';
      presetBadgeLabel = '화이트 스튜디오 · 내 사진 피팅';
    } else if (body.fitTarget === 'female') {
      subjectDirection =
        'A clean-cut Korean female fashion lookbook model in her mid-20s standing in a relaxed, natural front-facing full-body catalog pose from head to shoes (entire head and shoes fully visible inside frame).';
      presetBadgeLabel = '화이트 스튜디오 · 여성 모델샷';
    } else if (body.fitTarget === 'crop_fit' && !hasHeadAccessory) {
      subjectDirection =
        'A clean e-commerce lookbook neck-to-toe studio crop (framed cleanly from just below the chin down to the shoes so 100% of attention is on garment fit, layering, and footwear) on a stylish fashion model.';
      presetBadgeLabel = '화이트 스튜디오 · 크롭 모델샷';
    } else if (body.fitTarget === 'crop_fit' && hasHeadAccessory) {
      subjectDirection =
        'A clean Korean fashion lookbook model standing full-body from head to shoes so the selected eyewear/hat accessory and complete outfit are clearly visible.';
      presetBadgeLabel = '화이트 스튜디오 · 전신 모델샷';
    }

    const detailKeywords = Array.isArray(body.selectedDetails)
      ? body.selectedDetails.slice(0, 6).join(', ')
      : '';

    const selectedCategories = garments.map((g) => g.category);
    const hasTop = selectedCategories.includes('상의');
    const hasBottom = selectedCategories.includes('하의');
    const hasShoes = selectedCategories.includes('신발');

    const missingBasicsParts: string[] = [];
    if (!hasTop) missingBasicsParts.push('a clean neutral plain inner t-shirt');
    if (!hasBottom) missingBasicsParts.push('clean minimal wide-fit trousers');
    if (!hasShoes) missingBasicsParts.push('clean minimal sneakers or leather derby shoes');

    const autoCompleteNote =
      missingBasicsParts.length > 0
        ? `Combine all selected garments on a single model. For unselected categories (${missingBasicsParts.join(
            ', '
          )}), pair understated neutral basics so the look is complete without distracting from the selected items.`
        : 'Combine all selected garments together into one cohesive layered outfit on a single model.';

    const masterPrompt = [
      'Generate ONE single photorealistic vertical 3:4 studio fashion lookbook model photograph (NO collage, NO split screen, NO floating product cutouts, NO text, NO watermarks).',
      `Styling Genre Reference: ${String(body.activeGenre || '미니멀').slice(0, 40)}${
        detailKeywords ? ` (${detailKeywords})` : ''
      }.`,
      `Model & Pose: ${subjectDirection}`,
      'Selected Wardrobe Items to Wear:',
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
                  ? 'Gemini 2.5 Flash Image · White Studio'
                  : 'Gemini Multimodal Image · White Studio',
              presetLabel: presetBadgeLabel,
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
        'Google AI Studio 이미지 생성 할당량(Quota)을 초과했거나 이미지 모델이 유료 결제 계정(Tier 1) 연결을 요구하고 있습니다. AI Studio 쿼터 설정을 확인해 주세요.';
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
          '서버에서 스튜디오 모델샷 요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 }
    );
  }
}
