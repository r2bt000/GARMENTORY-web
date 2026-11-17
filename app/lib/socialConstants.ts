export type CategoryType = '아우터' | '상의' | '하의' | '신발' | '악세사리';
export type ClothStatus = '보유 중' | '구매 예정';
export type PhotoSideType = 'auto' | 'front' | 'back';

export type MainTab = 'home' | 'style' | 'studio' | 'my' | 'user_profile';
export type MyProfileSubTab = 'posts' | 'closet' | 'saved' | 'proposals';
export type OtherProfileSubTab = 'closet' | 'posts' | 'proposals';
export type LookbookFitTarget = 'male' | 'female' | 'crop_fit' | 'my_photo';
export type LookbookConceptId = 'street' | 'studio';

export interface ClothItem {
  id: number;
  name: string;
  category: CategoryType;
  season: string;
  status: ClothStatus;
  sourceUrl?: string;
  photoSide?: PhotoSideType;
  extraImages?: string[];
  image: string;
}

export interface TaggedClothRef {
  id: number;
  name: string;
  category: CategoryType;
  image: string;
  sourceUrl?: string;
}

export interface StyleComment {
  id: string;
  postId: number;
  userId: string;
  authorHandle: string;
  authorAvatar?: string;
  body: string;
  createdAt: string;
}

export interface StylePost {
  id: number;
  userId: string;
  authorHandle: string;
  authorAvatar?: string;
  imageUrl: string;
  caption: string;
  styleTags: string[];
  taggedItems: TaggedClothRef[];
  likeUserIds: string[];
  comments: StyleComment[];
  createdAt: string;
  createdIso: string;
}

export interface NewsletterArticle {
  id: string;
  url: string;
  sourceName: string;
  sourceRegion: 'KR' | 'GLOBAL';
  originalTitle: string;
  originalSummary: string;
  title: string;
  summary: string;
  image: string;
  category: '패션' | '스니커즈' | '컬처' | '라이프스타일';
  publishedAt: string;
  isTranslated: boolean;
}

export interface ArticleReaderDetail {
  titleKo: string;
  highlightsKo: string[];
  paragraphsKo: string[];
  isTranslated: boolean;
  heroImage?: string;
}

export interface ProposalReply {
  id: string;
  userId: string;
  authorHandle: string;
  authorAvatar?: string;
  body: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  proposer: string;
  proposerUserId?: string;
  proposerAvatar?: string;
  note: string;
  itemIds: number[];
  itemsSnapshot?: ClothItem[];
  likedUserIds: string[];
  replies: ProposalReply[];
  likes: number;
  createdAt: string;
}

export interface CommunityUser {
  id: string;
  handle: string;
  avatarUrl?: string;
  bio: string;
  isPublic: boolean;
  isLiveCloudUser?: boolean;
  closet: ClothItem[];
  proposals: Proposal[];
}

export interface SavedLook {
  id: number;
  genre: string;
  mode: 'DAY' | 'NIGHT';
  title: string;
  items: ClothItem[];
  note: string;
  lookbookImage?: string;
  stylePresetLabel?: string;
}

export interface UrlPreviewData {
  url: string;
  store: string;
  name: string;
  price: string;
  category: CategoryType;
  season: string;
  image: string;
  rawImageUrl?: string;
  galleryUrls?: string[];
  galleryDataUrls?: string[];
  autoExtracted?: boolean;
}

export interface MissingSuggestion {
  name: string;
  reason: string;
  tag?: string;
}

export interface StylistResult {
  id: number;
  genreTag: string;
  apiBadge: string;
  title: string;
  note: string;
  items: ClothItem[];
  suggestions: MissingSuggestion[];
  filterSummary: string;
  mode: 'DAY' | 'NIGHT';
  genre: string;
  lookbookImage?: string;
  lookbookEngine?: string;
  lookbookPresetLabel?: string;
}

export interface ToastItem {
  id: number;
  message: string;
}

export const STORAGE_BUCKET = 'wardrobe-images';

export const STORAGE_KEYS = {
  WARDROBE: '873oc_wardrobe_v6',
  SAVED_LOOKS: '873oc_saved_v6',
  STYLE_POSTS: '873oc_style_posts_v6',
  FOLLOWS: '873oc_follows_v6',
  BOOKMARKED_NEWS: '873oc_news_bookmarks_v6',
  NEWS_CACHE: '873oc_news_cache_ko_v7',
  MY_AVATAR: '873oc_my_avatar_v7',
  WHITE_BG_CACHE: '873oc_white_bg_cache_v1',
};

export const LEGACY_SAMPLE_ITEM_NAMES = new Set([
  '오버핏 울 블레이저 (차콜)',
  '크롭 화이트 포플린 셔츠',
  '와이드 생지 데님 팬츠',
  '디스트로이드 레더 바이커 자켓',
  '실버 체인 청키 플랫폼 부츠',
  '실버 아일렛 가죽 벨트',
]);

export const SLOT_CATEGORIES: {
  key: CategoryType;
  icon: string;
  label: string;
}[] = [
  { key: '아우터', icon: '🧥', label: '아우터' },
  { key: '상의', icon: '👕', label: '상의' },
  { key: '하의', icon: '👖', label: '하의' },
  { key: '신발', icon: '👟', label: '신발' },
  { key: '악세사리', icon: '🕶️', label: '악세사리' },
];

export const LOOKBOOK_CONCEPTS: {
  id: LookbookConceptId;
  label: string;
  sub: string;
}[] = [
  { id: 'street', label: '거리샷', sub: '성수·한남 자연광 스트릿' },
  { id: 'studio', label: '스튜디오 샷', sub: '화이트 호리존 스튜디오' },
];

export const LOOKBOOK_FIT_TARGETS: { id: LookbookFitTarget; label: string }[] = [
  { id: 'male', label: '남성 모델' },
  { id: 'female', label: '여성 모델 (고양이·여우상)' },
  { id: 'crop_fit', label: '턱 아래 크롭샷' },
  { id: 'my_photo', label: '내 사진 피팅' },
];

export const STYLE_HASH_PRESETS = [
  '#스트릿',
  '#미니멀',
  '#고프코어',
  '#아메카지',
  '#서브컬처',
  '#데일리룩',
];

export const STUDIO_GENRES = [
  '미니멀',
  '스트릿',
  '고프코어',
  '아메카지',
  '시티보이',
  '서브컬처',
];

export const STUDIO_DETAILS = [
  '와이드 실루엣',
  '레이어드',
  '모노톤 매치',
  '빈티지 워싱',
  '실버 포인트',
  '테크 쉘 소재',
];

export const SAMPLE_SHOP_PRESETS: UrlPreviewData[] = [
  {
    url: 'https://kream.co.kr/products/38849',
    store: 'KREAM',
    name: 'Vans Classic Slip-On Racing Red',
    price: '실시간 시세 연동',
    category: '신발',
    season: '사계절',
    image: '',
  },
  {
    url: 'https://kream.co.kr/products/600739',
    store: 'KREAM',
    name: 'Oakley Eye Jacket Redux Matte Black',
    price: '실시간 시세 연동',
    category: '악세사리',
    season: '사계절',
    image: '',
  },
];

export function extractAvatarFromDna(dna?: unknown): string {
  if (!Array.isArray(dna)) return '';
  for (let i = 0; i < dna.length; i++) {
    const entry = String(dna[i] || '');
    if (entry.startsWith('avatar:')) {
      return entry.slice('avatar:'.length).trim();
    }
  }
  return '';
}

export function createMinimalPlaceholderSvg(label: string, sub = '873oc'): string {
  const safeLabel = label.slice(0, 16);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="450" viewBox="0 0 400 450">
    <rect width="400" height="450" fill="#F4F4F5"/>
    <text x="50%" y="47%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#18181B">${safeLabel}</text>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="500" fill="#71717A">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function stripWardrobeMetaHash(url?: string): string {
  return String(url || '')
    .split('#873oc=')[0]
    .split('#oblique=')[0]
    .trim();
}

export function encodeWardrobeSourceMeta(
  cleanUrl?: string,
  photoSide?: PhotoSideType,
  extraImages?: string[]
): string {
  const base = stripWardrobeMetaHash(cleanUrl);
  const side = photoSide && photoSide !== 'auto' ? photoSide : undefined;
  const extras = Array.isArray(extraImages)
    ? extraImages
        .filter((u) => typeof u === 'string' && u.length > 0 && u.length < 2200)
        .slice(0, 4)
    : [];
  if (!side && extras.length === 0) {
    return base;
  }
  const payload = encodeURIComponent(
    JSON.stringify({
      ...(side ? { side } : {}),
      ...(extras.length > 0 ? { extra: extras } : {}),
    })
  );
  return `${base}#873oc=${payload}`;
}

export function decodeWardrobeSourceMeta(rawSourceUrl?: string): {
  cleanUrl: string;
  photoSide: PhotoSideType;
  extraImages: string[];
} {
  const raw = String(rawSourceUrl || '');
  const marker = raw.includes('#873oc=')
    ? '#873oc='
    : raw.includes('#oblique=')
    ? '#oblique='
    : '';
  if (!marker) {
    return { cleanUrl: raw.trim(), photoSide: 'auto', extraImages: [] };
  }
  const idx = raw.indexOf(marker);
  const cleanUrl = raw.slice(0, idx).trim();
  const encoded = raw.slice(idx + marker.length);
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded));
    const photoSide: PhotoSideType =
      parsed?.side === 'front' || parsed?.side === 'back'
        ? parsed.side
        : 'auto';
    const extraImages: string[] = Array.isArray(parsed?.extra)
      ? parsed.extra.filter(
          (u: unknown) => typeof u === 'string' && u.length > 0
        )
      : [];
    return { cleanUrl, photoSide, extraImages };
  } catch {
    return { cleanUrl, photoSide: 'auto', extraImages: [] };
  }
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return '방금 전';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '최근';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

// iOS Safari 등 WebP 인코딩 미지원 브라우저에서 JPEG 폴백 시 투명 배경이 검은색(#000000)으로 변하지 않도록
// 항상 순백색(#FFFFFF) 배경을 먼저 채운 뒤 합성합니다.
export async function compressImageToWebP(
  file: File,
  maxEdge = 1280,
  quality = 0.84,
  bgColor = '#FFFFFF'
): Promise<{
  blob: Blob;
  dataUrl: string;
  ext: 'webp' | 'jpg';
  mimeType: string;
  originalBytes: number;
  compressedBytes: number;
}> {
  const originalBytes = file.size || 0;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read error'));
    reader.onload = () => {
      const srcUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode error'));
      img.onload = () => {
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
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        let ext: 'webp' | 'jpg' = 'webp';
        let mimeType = 'image/webp';
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          ext = 'jpg';
          mimeType = 'image/jpeg';
        }

        canvas.toBlob(
          (blob) => {
            const safeBlob = blob || new Blob([], { type: mimeType });
            resolve({
              blob: safeBlob,
              dataUrl,
              ext,
              mimeType,
              originalBytes,
              compressedBytes:
                safeBlob.size || Math.round(dataUrl.length * 0.75),
            });
          },
          mimeType,
          quality
        );
      };
      img.src = srcUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressDataUrlToWebP(
  srcDataUrl: string,
  maxEdge = 1080,
  quality = 0.84,
  bgColor = '#FFFFFF'
): Promise<{
  blob: Blob | null;
  dataUrl: string;
  ext: 'webp' | 'jpg';
  mimeType: string;
}> {
  if (!srcDataUrl || !srcDataUrl.startsWith('data:image/')) {
    return {
      blob: null,
      dataUrl: srcDataUrl,
      ext: 'webp',
      mimeType: 'image/webp',
    };
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
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
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          blob: null,
          dataUrl: srcDataUrl,
          ext: 'webp',
          mimeType: 'image/webp',
        });
        return;
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let outUrl = canvas.toDataURL('image/webp', quality);
      let ext: 'webp' | 'jpg' = 'webp';
      let mimeType = 'image/webp';
      if (!outUrl.startsWith('data:image/webp')) {
        outUrl = canvas.toDataURL('image/jpeg', quality);
        ext = 'jpg';
        mimeType = 'image/jpeg';
      }
      canvas.toBlob(
        (blob) => {
          resolve({
            blob,
            dataUrl: outUrl,
            ext,
            mimeType,
          });
        },
        mimeType,
        quality
      );
    };
    img.onerror = () =>
      resolve({
        blob: null,
        dataUrl: srcDataUrl,
        ext: 'webp',
        mimeType: 'image/webp',
      });
    img.src = srcDataUrl;
  });
}
