import { type ClothItem, compressDataUrlToWebP } from './socialConstants';

function loadBlobAsImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Image decode failed'));
    };
    img.src = objUrl;
  });
}

async function fetchImageBlobSafe(
  imgUrl: string,
  refererHint = ''
): Promise<Blob | null> {
  if (!imgUrl || imgUrl.startsWith('data:image/svg')) return null;

  if (imgUrl.startsWith('data:image/')) {
    try {
      const r = await fetch(imgUrl);
      if (r.ok) return await r.blob();
    } catch {
      return null;
    }
  }

  try {
    const direct = await fetch(imgUrl, { mode: 'cors', cache: 'force-cache' });
    if (direct.ok) {
      const b = await direct.blob();
      if (b.size > 400) return b;
    }
  } catch {
    // fallback to same-origin proxy
  }

  if (/^https?:\/\//i.test(imgUrl)) {
    try {
      const proxyUrl = `/api/scrape?imageUrl=${encodeURIComponent(imgUrl)}${
        refererHint ? `&referer=${encodeURIComponent(refererHint)}` : ''
      }`;
      const proxied = await fetch(proxyUrl);
      if (proxied.ok) {
        const b = await proxied.blob();
        if (b.size > 400) return b;
      }
    } catch {
      return null;
    }
  }

  return null;
}

// 이미지 외곽 모서리·테두리 8개 지점이 불투명(alpha >= 245) 순수 검정(RGB <= 12)인지 검사
export async function detectOpaqueBlackBackground(
  imgUrl: string,
  refererHint = ''
): Promise<{ isBlackBg: boolean; blob: Blob | null }> {
  if (
    !imgUrl ||
    imgUrl.startsWith('data:image/svg') ||
    imgUrl.includes('/white_')
  ) {
    return { isBlackBg: false, blob: null };
  }

  const blob = await fetchImageBlobSafe(imgUrl, refererHint);
  if (!blob) return { isBlackBg: false, blob: null };

  try {
    const img = await loadBlobAsImage(blob);
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { isBlackBg: false, blob: null };

    // 배경을 칠하지 않은 투명 캔버스에 그려서 실제 투명 PNG/WebP(alpha === 0)와 불투명 검은 JPG(alpha === 255)를 정확히 구분
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const samplePoints: [number, number][] = [
      [2, 2],
      [size - 3, 2],
      [2, size - 3],
      [size - 3, size - 3],
      [Math.floor(size / 2), 2],
      [Math.floor(size / 2), size - 3],
      [2, Math.floor(size / 2)],
      [size - 3, Math.floor(size / 2)],
    ];

    let opaqueBlackCount = 0;
    for (let i = 0; i < samplePoints.length; i++) {
      const [x, y] = samplePoints[i];
      const idx = (y * size + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a >= 245 && r <= 12 && g <= 12 && b <= 12) {
        opaqueBlackCount += 1;
      }
    }

    return {
      isBlackBg: opaqueBlackCount >= 6,
      blob,
    };
  } catch {
    return { isBlackBg: false, blob: null };
  }
}

// 원본 링크가 없거나 재추출 실패 시, 외곽 테두리에서 연결된 순수 검정 배경만 안전하게 흰색(#FFFFFF)으로 치환
async function floodFillBlackBorderToWhite(
  blob: Blob,
  maxEdge = 1080
): Promise<{
  blob: Blob | null;
  dataUrl: string;
  ext: 'webp' | 'jpg';
  mimeType: string;
} | null> {
  try {
    const img = await loadBlobAsImage(blob);
    let w = img.naturalWidth || img.width || 800;
    let h = img.naturalHeight || img.height || 800;
    if (w > maxEdge || h > maxEdge) {
      if (w >= h) {
        h = Math.round((h * maxEdge) / w);
        w = maxEdge;
      } else {
        w = Math.round((w * maxEdge) / h);
        h = maxEdge;
      }
    }
    w = Math.max(1, w);
    h = Math.max(1, h);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;

    // 중앙 영역(의류 본체)이 검은색 의류인지 측정해 임계값 자동 조절 (검은 후드/맨투맨 손상 방지)
    let centerSamples = 0;
    let veryDarkCenter = 0;
    const x0 = Math.floor(w * 0.32);
    const x1 = Math.floor(w * 0.68);
    const y0 = Math.floor(h * 0.28);
    const y1 = Math.floor(h * 0.72);
    for (let y = y0; y <= y1; y += 4) {
      for (let x = x0; x <= x1; x += 4) {
        const idx = (y * w + x) * 4;
        centerSamples += 1;
        if (px[idx] <= 22 && px[idx + 1] <= 22 && px[idx + 2] <= 22) {
          veryDarkCenter += 1;
        }
      }
    }
    const isDarkGarment =
      centerSamples > 0 && veryDarkCenter / centerSamples > 0.35;
    const strictMax = isDarkGarment ? 5 : 15;

    const total = w * h;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const tryEnqueue = (x: number, y: number) => {
      const pos = y * w + x;
      if (visited[pos]) return;
      const idx = pos * 4;
      if (
        px[idx] <= strictMax &&
        px[idx + 1] <= strictMax &&
        px[idx + 2] <= strictMax
      ) {
        visited[pos] = 1;
        queue[tail++] = pos;
      }
    };

    for (let x = 0; x < w; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, h - 1);
    }
    for (let y = 1; y < h - 1; y++) {
      tryEnqueue(0, y);
      tryEnqueue(w - 1, y);
    }

    while (head < tail) {
      const pos = queue[head++];
      const x = pos % w;
      const y = (pos - x) / w;

      if (x > 0) tryEnqueue(x - 1, y);
      if (x + 1 < w) tryEnqueue(x + 1, y);
      if (y > 0) tryEnqueue(x, y - 1);
      if (y + 1 < h) tryEnqueue(x, y + 1);
    }

    // 만약 전체 픽셀의 92% 이상이 칠해지려 하면 검은 의류 본체까지 침범한 것이므로 중단
    if (tail > total * 0.92 || tail < 30) {
      return null;
    }

    for (let i = 0; i < tail; i++) {
      const pos = queue[i];
      const idx = pos * 4;
      px[idx] = 255;
      px[idx + 1] = 255;
      px[idx + 2] = 255;
      px[idx + 3] = 255;

      // 경계선 1px 소프트 안티앨리어싱
      const x = pos % w;
      const y = (pos - x) / w;
      const neighbors = [
        x > 0 ? pos - 1 : -1,
        x + 1 < w ? pos + 1 : -1,
        y > 0 ? pos - w : -1,
        y + 1 < h ? pos + w : -1,
      ];
      for (let n = 0; n < 4; n++) {
        const np = neighbors[n];
        if (np >= 0 && !visited[np]) {
          const nIdx = np * 4;
          const maxCh = Math.max(px[nIdx], px[nIdx + 1], px[nIdx + 2]);
          if (!isDarkGarment && maxCh <= 32) {
            px[nIdx] = Math.min(255, px[nIdx] + 140);
            px[nIdx + 1] = Math.min(255, px[nIdx + 1] + 140);
            px[nIdx + 2] = Math.min(255, px[nIdx + 2] + 140);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    let outUrl = canvas.toDataURL('image/webp', 0.86);
    let ext: 'webp' | 'jpg' = 'webp';
    let mimeType = 'image/webp';
    if (!outUrl.startsWith('data:image/webp')) {
      outUrl = canvas.toDataURL('image/jpeg', 0.86);
      ext = 'jpg';
      mimeType = 'image/jpeg';
    }

    return await new Promise((resolve) => {
      canvas.toBlob(
        (b) =>
          resolve({
            blob: b,
            dataUrl: outUrl,
            ext,
            mimeType,
          }),
        mimeType,
        0.86
      );
    });
  } catch {
    return null;
  }
}

// 기존 검은 배경 아이템을 흰색(#FFFFFF) 배경으로 복구 (1순위: sourceUrl 원본 투명 이미지 재합성 -> 2순위: 외곽 플러드필)
export async function restoreBlackWardrobeItemToWhite(
  item: ClothItem,
  existingBlob: Blob | null,
  maxEdge = 1080
): Promise<{
  blob: Blob | null;
  dataUrl: string;
  ext: 'webp' | 'jpg';
  mimeType: string;
} | null> {
  const cleanSource = String(item.sourceUrl || '').split('#')[0].trim();

  // 1순위: 쇼핑몰 원본 링크(KREAM, 무신사 등)가 있으면 원본 투명 이미지를 다시 받아 순백색(#FFFFFF) 배경 위에 깔끔하게 합성!
  if (/^https?:\/\//i.test(cleanSource)) {
    try {
      const resp = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanSource }),
      });
      const json = await resp.json();
      if (json?.success) {
        const serverDataUrl =
          typeof json.imageDataUrl === 'string' ? json.imageDataUrl.trim() : '';
        const rawImgUrl =
          typeof json.image === 'string' ? json.image.trim() : '';

        if (serverDataUrl.startsWith('data:image/')) {
          // 원본 자체가 혹시 검은 배경인지 확인 후, 투명 배경이면 #FFFFFF 합성만으로 완벽 복구!
          const check = await detectOpaqueBlackBackground(serverDataUrl);
          if (!check.isBlackBg) {
            const whiteComp = await compressDataUrlToWebP(
              serverDataUrl,
              maxEdge,
              0.86,
              '#FFFFFF'
            );
            if (whiteComp.dataUrl) return whiteComp;
          } else if (check.blob) {
            const flooded = await floodFillBlackBorderToWhite(
              check.blob,
              maxEdge
            );
            if (flooded) return flooded;
          }
        } else if (/^https?:\/\//i.test(rawImgUrl)) {
          const freshBlob = await fetchImageBlobSafe(rawImgUrl, cleanSource);
          if (freshBlob) {
            const readerUrl = await new Promise<string>((res) => {
              const fr = new FileReader();
              fr.onload = () => res(String(fr.result || ''));
              fr.onerror = () => res('');
              fr.readAsDataURL(freshBlob);
            });
            if (readerUrl.startsWith('data:image/')) {
              const check = await detectOpaqueBlackBackground(readerUrl);
              if (!check.isBlackBg) {
                const whiteComp = await compressDataUrlToWebP(
                  readerUrl,
                  maxEdge,
                  0.86,
                  '#FFFFFF'
                );
                if (whiteComp.dataUrl) return whiteComp;
              }
            }
          }
        }
      }
    } catch {
      // fallback to flood-fill
    }
  }

  // 2순위: 직접 업로드한 사진이거나 쇼핑몰 연결이 안 될 때 테두리 검은 픽셀을 흰색으로 치환
  const targetBlob =
    existingBlob || (await fetchImageBlobSafe(item.image, cleanSource));
  if (targetBlob) {
    return await floodFillBlackBorderToWhite(targetBlob, maxEdge);
  }

  return null;
}
