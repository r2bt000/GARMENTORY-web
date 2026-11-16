import { NextResponse } from 'next/server';
import { downloadUrlAsInlineData } from '../../lib/productGallery';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type FitTargetId = 'male' | 'female' | 'crop_fit' | 'my_photo';
type LookbookConceptId = 'street' | 'studio';
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

interface LookbookRequestBody {
  isDarkMode: boolean;
  concept?: LookbookConceptId;
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

const lookbookBuckets = new Map<string, number[]>();
function allowLookbookCall(ip: string): boolean {
  const now = Date.now();
  const recent = (lookbookBuckets.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 20) {
    lookbookBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  lookbookBuckets.set(ip, recent);
  return true;
}

const WHITE_STUDIO_FRONT_DIRECTION =
  'Shot in a clean, minimalist professional fashion e-commerce photography studio against a pure seamless solid white cyclorama wall and white studio floor (#FFFFFF infinity cove). Zero outdoor background, zero furniture, zero props, zero text, zero watermarks, zero split-screen or collage frames. Even, soft commercial catalog lighting (SSENSE / 29CM / Musinsa Studio official front catalog model lookbook aesthetic) with balanced fill light so dark and black garments retain crisp seam lines, zippers, quilting, hardware, and fabric texture separation against the pure white backdrop, with only a subtle natural soft contact shadow directly beneath the shoes. Vertical 3:4 full-length front-facing studio model framing.';

const STREET_SNAP_FRONT_DIRECTION =
  'Shot outdoors as an authentic high-end Korean street fashion snap in a clean, stylish minimalist Seoul neighborhood (Seongsu-dong / Hannam-dong / Dosan Park editorial vibe: understated architectural raw concrete or warm stone facade, clean sidewalk, subtle modern glass storefront, and soft natural urban trees in gentle background bokeh). Soft natural afternoon daylight, captured on a full-frame 35mm DSLR camera with an 85mm f/2.0 prime portrait lens: creamy shallow depth-of-field in the background while the model and every garment seam, fabric drape, graphic, hardware, and sneaker detail remain tack-sharp. Zero distracting pedestrians, zero messy signs, zero text, zero watermarks, zero split-screen or collage frames. Vertical 3:4 full-length front-facing street snap framing.';

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
            '분당 AI 착장 촬영 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as LookbookRequestBody;
    const concept: LookbookConceptId =
      body.concept === 'street' ? 'street' : 'studio';
    const isStreet = concept === 'street';
    const conceptLabel = isStreet ? '거리샷' : '스튜디오 샷';

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
          presetLabel: `${conceptLabel} · 내 사진 피팅`,
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
          'AI 모델샷 엔진을 작동하려면 GEMINI_API_KEY가 필요합니다. 우측 상단 설정 창에 키를 입력하거나 Vercel 환경변수(GEMINI_API_KEY)에 등록해 주세요.',
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
          `- Reference Image #${refCounter}: TARGET PERSON PHOTO (preserve this exact person's identity, hair, and body proportions in a clean front-facing ${
            isStreet ? 'Seoul street snap' : 'white studio'
          } pose).`
        );
        refCounter += 1;
        hasUserPhotoInline = true;
      }
    }

    // 2) 선택된 의류 이미지 주입 ('뒷면 사진' 표시 아이템은 등판 프린팅이 앞면에 찍히지 않도록 보호)
    const allNamesJoined = garments.map((g) => `${g.name} ${g.category}`).join(' ');
    const hasHeadAccessory =
      /(선글라스|아이웨어|안경|고글|아이\s*자켓|모자|볼캡|비니|버킷햇|eye\s*jacket|sunglasses|eyewear|glasses|goggles|cap|hat|beanie)/i.test(
        allNamesJoined
      );

    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const cleanName = String(g.name || '선택 의류').slice(0, 80);
      const cleanCat = String(g.category || '의류').slice(0, 20);
      const cleanSourceUrl = String(g.sourceUrl || '').split('#')[0].trim();

      if (g.photoSide === 'back') {
        const customFrontSrc =
          Array.isArray(g.extraImages) && g.extraImages[0]
            ? g.extraImages[0]
            : '';
        const customFrontInline = customFrontSrc
          ? await resolveImageToInlineData(customFrontSrc, cleanSourceUrl)
          : null;

        if (customFrontInline) {
          parts.push({ inlineData: customFrontInline });
          referenceMappingLines.push(
            `- Reference Image #${refCounter}: [${cleanCat}] "${cleanName}" (FRONT VIEW) — reproduce this exact front design, color, and silhouette.`
          );
          refCounter += 1;
        } else {
          referenceMappingLines.push(
            `- Garment Item [${cleanCat}] "${cleanName}": The registered closet thumbnail is a rear back-print view, so for this FRONT-FACING model shot, render a clean, plain solid front matching the item's color/category ("${cleanName}") with ZERO large graphic on the front chest.`
          );
        }
        continue;
      }

      const inline = await resolveImageToInlineData(g.image, cleanSourceUrl);
      if (inline) {
        parts.push({ inlineData: inline });
        referenceMappingLines.push(
          `- Reference Image #${refCounter}: [${cleanCat}] "${cleanName}" — faithfully reproduce the exact garment silhouette, color, fabric texture, collar/zipper/pocket details, and front design on the front-facing model.`
        );
        refCounter += 1;
      } else {
        referenceMappingLines.push(
          `- Garment Item (text description): [${cleanCat}] "${cleanName}".`
        );
      }
    }

    // 3) 모델 외형 및 포즈 디렉션
    // - 남성: 기존 한국 남성 패션 룩북 모델 느낌 그대로 유지
    // - 여성: 아이돌 비주얼 센터급 실사 미모 + 세련된 고양이상·여우상 이목구비 집중 반영!
    let subjectDirection =
      'A clean-cut Korean male fashion lookbook model in his mid-20s standing in a relaxed, natural straight-on 0-degree FRONT-FACING full-body pose from head to shoes (entire head and shoes fully visible inside frame, facing directly toward the camera).';
    let presetBadgeLabel = `${conceptLabel} · 남성 모델`;

    if (hasUserPhotoInline) {
      subjectDirection = isStreet
        ? 'Virtual Try-On Street Snap: Dress the exact person from Reference Image #1 in all selected garments below in a natural front-facing full-body Seoul street snap.'
        : 'Virtual Try-On in White Studio: Dress the exact person from Reference Image #1 in all selected garments below in a clean front-facing full-body pose inside a pure white photography studio.';
      presetBadgeLabel = `${conceptLabel} · 내 사진 피팅`;
    } else if (body.fitTarget === 'female') {
      subjectDirection =
        'An ultra-photorealistic, breathtakingly gorgeous K-pop idol visual-center tier Korean female fashion model in her early 20s with captivating chic cat-like / fox-like facial features (세련되고 매력적인 고양이상·여우상 아이돌 비주얼): sleek almond eyes with subtly upturned outer corners and clear magnetic gaze, refined high nose bridge, small V-line face proportions, flawless clear glass-skin complexion with authentic natural DSLR skin texture (100% real human photography — NEVER CGI, NEVER 3D render, NEVER plastic doll), subtle natural K-beauty rose-beige lip and clean makeup, effortless silky dark-brown long layered hair, and tall 8-head model proportions, standing in a natural, confident FRONT-FACING full-body pose from head to shoes (entire head and shoes fully visible inside frame, facing directly toward the camera).';
      presetBadgeLabel = `${conceptLabel} · 여성 모델`;
    } else if (body.fitTarget === 'crop_fit' && !hasHeadAccessory) {
      subjectDirection =
        'A clean lookbook neck-to-toe FRONT-FACING crop (framed cleanly from just below the chin down to the shoes, facing directly forward so 100% of attention is on front garment fit, layering, and footwear).';
      presetBadgeLabel = `${conceptLabel} · 크롭샷`;
    } else if (body.fitTarget === 'crop_fit' && hasHeadAccessory) {
      subjectDirection =
        'A clean Korean fashion lookbook model standing full-body facing directly toward the camera from head to shoes so the selected eyewear/hat accessory and complete front outfit are clearly visible.';
      presetBadgeLabel = `${conceptLabel} · 전신샷`;
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
      missingBasicsParts.length > 0
        ? `Combine all selected garments on a single front-facing model. For unselected categories (${missingBasicsParts.join(
            ', '
          )}), pair understated plain neutral basics.`
        : 'Combine all selected garments together into one cohesive layered outfit on a single front-facing model.';

    const environmentDirection = isStreet
      ? STREET_SNAP_FRONT_DIRECTION
      : WHITE_STUDIO_FRONT_DIRECTION;

    const masterPrompt = [
      `Generate ONE single photorealistic vertical 3:4 FRONT-FACING ${
        isStreet ? 'Korean street-snap fashion photograph' : 'white studio catalog model photograph'
      } (strictly FRONT view only — NO back view, NO side view, NO multi-panel collage, NO split screen, NO text, NO watermarks).`,
      `Styling Genre Reference: ${String(body.activeGenre || '미니멀').slice(0, 40)}${
        detailKeywords ? ` (${detailKeywords})` : ''
      }.`,
      `Model Appearance & Front Pose: ${subjectDirection}`,
      'Selected Wardrobe Items to Wear:',
      ...referenceMappingLines,
      autoCompleteNote,
      `Environment, Background & Lighting (STRICT): ${environmentDirection}`,
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
              imageDataUrl: `data:${outMime};base64,${inlineData.data}`,
              engineLabel: `Gemini 2.5 Flash Image · ${conceptLabel}`,
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
        'Google AI Studio 이미지 생성 할당량(Quota)에 도달했습니다. 잠시 후 다시 시도해 주세요.';
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
          '서버에서 AI 모델샷 요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 }
    );
  }
}
