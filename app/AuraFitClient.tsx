'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import NewsletterHomeSection from './components/NewsletterHomeSection';
import StyleFeedSection from './components/StyleFeedSection';
import StudioSection from './components/StudioSection';
import ProfileAndClosetSection from './components/ProfileAndClosetSection';
import AppModals from './components/AppModals';
import {
  type ArticleReaderDetail,
  type CategoryType,
  type ClothItem,
  type ClothStatus,
  type CommunityUser,
  type LookbookConceptId,
  type LookbookFitTarget,
  type MainTab,
  type MissingSuggestion,
  type MyProfileSubTab,
  type NewsletterArticle,
  type OtherProfileSubTab,
  type PhotoSideType,
  type Proposal,
  type ProposalReply,
  type SavedLook,
  STORAGE_BUCKET,
  STORAGE_KEYS,
  type StyleComment,
  type StylePost,
  type StylistResult,
  type TaggedClothRef,
  type ToastItem,
  type UrlPreviewData,
  LEGACY_SAMPLE_ITEM_NAMES,
  compressDataUrlToWebP,
  compressImageToWebP,
  createMinimalPlaceholderSvg,
  decodeWardrobeSourceMeta,
  encodeWardrobeSourceMeta,
  extractAvatarFromDna,
  formatRelativeTime,
  stripWardrobeMetaHash,
} from './lib/socialConstants';

function parseProposalRow(p: Record<string, unknown>): Proposal | null {
  const rawSnap = p.items_snapshot;
  let itemsSnapshot: ClothItem[] = [];
  let likedUserIds: string[] = [];
  let replies: ProposalReply[] = [];
  let proposerAvatar = '';

  if (Array.isArray(rawSnap)) {
    itemsSnapshot = rawSnap as ClothItem[];
  } else if (rawSnap && typeof rawSnap === 'object') {
    const obj = rawSnap as Record<string, unknown>;
    if (obj.deleted === true) {
      return null;
    }
    if (Array.isArray(obj.items)) {
      itemsSnapshot = obj.items as ClothItem[];
    }
    if (Array.isArray(obj.likedUserIds)) {
      likedUserIds = obj.likedUserIds.map((u) => String(u));
    }
    if (Array.isArray(obj.replies)) {
      replies = obj.replies as ProposalReply[];
    }
    if (typeof obj.proposerAvatar === 'string') {
      proposerAvatar = obj.proposerAvatar;
    }
  }

  return {
    id: String(p.id),
    proposer: String(p.proposer_handle || '@873oc'),
    proposerUserId: p.proposer_user_id ? String(p.proposer_user_id) : undefined,
    proposerAvatar: proposerAvatar || undefined,
    note: String(p.note || ''),
    itemIds: Array.isArray(p.item_ids)
      ? p.item_ids.map((n: unknown) => Number(n))
      : [],
    itemsSnapshot,
    likedUserIds,
    replies,
    likes: likedUserIds.length,
    createdAt: formatRelativeTime(
      typeof p.created_at === 'string' ? p.created_at : undefined
    ),
  };
}

export default function AuraFitClient() {
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // 메인 탭: HOME · STYLE · STUDIO · MY + 타 유저 프로필 화면
  const [currentTab, setCurrentTab] = useState<MainTab>('home');
  const [previousTab, setPreviousTab] = useState<MainTab>('style');
  const [mySubTab, setMySubTab] = useState<MyProfileSubTab>('posts');
  const [otherSubTab, setOtherSubTab] = useState<OtherProfileSubTab>('closet');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // 내 프로필 · 프로필 사진 · 옷장 · 룩북 상태
  const [myHandle, setMyHandle] = useState<string>('@my_873oc');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>('');
  const [myBio, setMyBio] = useState<string>(
    '옷장 아이템을 터치해 어울리는 코디를 자유롭게 제안해 주세요!'
  );
  const [wardrobe, setWardrobe] = useState<ClothItem[]>([]);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [selectedClothIds, setSelectedClothIds] = useState<number[]>([]);

  // 커뮤니티 유저 · STYLE 피드 · 팔로우 관계 상태
  const [communityUsers, setCommunityUsers] = useState<CommunityUser[]>([
    {
      id: 'me',
      handle: '@my_873oc',
      avatarUrl: '',
      bio: '옷장 아이템을 터치해 어울리는 코디를 자유롭게 제안해 주세요!',
      isPublic: true,
      closet: [],
      proposals: [],
    },
  ]);
  const [stylePosts, setStylePosts] = useState<StylePost[]>([]);
  const [followEdges, setFollowEdges] = useState<
    { followerId: string; followingId: string }[]
  >([]);
  const likingPostSetRef = useRef<Set<number>>(new Set());
  const likingProposalSetRef = useRef<Set<string>>(new Set());

  // HOME 뉴스레터 상태
  const [newsArticles, setNewsArticles] = useState<NewsletterArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true);
  const [bookmarkedNewsIds, setBookmarkedNewsIds] = useState<string[]>([]);
  const [activeArticle, setActiveArticle] = useState<NewsletterArticle | null>(
    null
  );
  const [articleDetail, setArticleDetail] =
    useState<ArticleReaderDetail | null>(null);
  const [isLoadingArticleDetail, setIsLoadingArticleDetail] =
    useState<boolean>(false);

  // STUDIO 상태 (거리샷 / 스튜디오 샷 선택 + 고양이·여우상 여성 모델)
  const [selectedGenre, setSelectedGenre] = useState<string>('미니멀');
  const [activeDetails, setActiveDetails] = useState<string[]>([
    '와이드 실루엣',
    '모노톤 매치',
  ]);
  const [customDetailNote, setCustomDetailNote] = useState<string>('');
  const [lookbookConcept, setLookbookConcept] =
    useState<LookbookConceptId>('street');
  const [lookbookFitTarget, setLookbookFitTarget] =
    useState<LookbookFitTarget>('male');
  const [userTryOnPhoto, setUserTryOnPhoto] = useState<string>('');
  const [userTryOnInfo, setUserTryOnInfo] = useState<string>('');
  const [autoShootLookbook, setAutoShootLookbook] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingLookbook, setIsGeneratingLookbook] =
    useState<boolean>(false);
  const [stylistResult, setStylistResult] = useState<StylistResult | null>(
    null
  );
  const [lookbookStatusHint, setLookbookStatusHint] = useState<string>('');
  const [isSavingLookbook, setIsSavingLookbook] = useState<boolean>(false);
  const shootSessionRef = useRef<number>(0);

  // 모달 & 인증 상태 (시스템 설정 모달 제거 완료!)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authNickname, setAuthNickname] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string>('');

  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadMethod, setUploadMethod] = useState<'photo' | 'url'>('photo');
  const [photoName, setPhotoName] = useState<string>('');
  const [photoCategory, setPhotoCategory] = useState<CategoryType>('상의');
  const [photoSeason, setPhotoSeason] = useState<string>('사계절');
  const [photoStatus, setPhotoStatus] = useState<ClothStatus>('보유 중');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoExt, setPhotoExt] = useState<'webp' | 'jpg'>('webp');
  const [photoMime, setPhotoMime] = useState<string>('image/webp');
  const [photoCompressInfo, setPhotoCompressInfo] = useState<string>('');
  const [photoSideInput, setPhotoSideInput] = useState<PhotoSideType>('auto');
  const [photoSourceUrlInput, setPhotoSourceUrlInput] = useState<string>('');
  const [isUploadingCloth, setIsUploadingCloth] = useState<boolean>(false);

  const [shopUrlInput, setShopUrlInput] = useState<string>('');
  const [isFetchingUrl, setIsFetchingUrl] = useState<boolean>(false);
  const [urlPreview, setUrlPreview] = useState<UrlPreviewData | null>(null);
  const [urlStatus, setUrlStatus] = useState<ClothStatus>('보유 중');
  const [urlCustomBlob, setUrlCustomBlob] = useState<Blob | null>(null);
  const [urlCustomExt, setUrlCustomExt] = useState<'webp' | 'jpg'>('webp');
  const [urlCustomMime, setUrlCustomMime] = useState<string>('image/webp');

  const [editingCloth, setEditingCloth] = useState<ClothItem | null>(null);
  const [editClothName, setEditClothName] = useState<string>('');
  const [editClothCategory, setEditClothCategory] =
    useState<CategoryType>('상의');
  const [editClothSeason, setEditClothSeason] = useState<string>('사계절');
  const [editClothStatus, setEditClothStatus] =
    useState<ClothStatus>('보유 중');
  const [editClothSourceUrl, setEditClothSourceUrl] = useState<string>('');
  const [editClothPhotoSide, setEditClothPhotoSide] =
    useState<PhotoSideType>('auto');
  const [editClothExtraImages, setEditClothExtraImages] = useState<string[]>(
    []
  );
  const [isUploadingExtraAngle, setIsUploadingExtraAngle] =
    useState<boolean>(false);
  const [isSavingClothEdit, setIsSavingClothEdit] = useState<boolean>(false);

  const [zoomImageUrl, setZoomImageUrl] = useState<string>('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const envSbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const envSbKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  const showToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const supabaseClient: SupabaseClient | null = useMemo(() => {
    if (!envSbUrl || !envSbKey) return null;
    try {
      return createClient(envSbUrl, envSbKey);
    } catch {
      return null;
    }
  }, [envSbUrl, envSbKey]);

  // 로컬 캐시 복원
  useEffect(() => {
    try {
      const savedNewsCache = localStorage.getItem(STORAGE_KEYS.NEWS_CACHE);
      if (savedNewsCache) {
        const parsedNews = JSON.parse(savedNewsCache);
        if (Array.isArray(parsedNews) && parsedNews.length > 0) {
          setNewsArticles(parsedNews);
          setIsLoadingNews(false);
        }
      }
      const savedBookmarks = localStorage.getItem(STORAGE_KEYS.BOOKMARKED_NEWS);
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks);
        if (Array.isArray(parsed)) setBookmarkedNewsIds(parsed);
      }
      const savedAvatar = localStorage.getItem(STORAGE_KEYS.MY_AVATAR);
      if (savedAvatar) {
        setMyAvatarUrl(savedAvatar);
      }
      const savedWardrobe = localStorage.getItem(STORAGE_KEYS.WARDROBE);
      if (savedWardrobe) {
        const parsed = JSON.parse(savedWardrobe);
        if (Array.isArray(parsed)) setWardrobe(parsed);
      }
      const savedLooksRaw = localStorage.getItem(STORAGE_KEYS.SAVED_LOOKS);
      if (savedLooksRaw) {
        const parsed = JSON.parse(savedLooksRaw);
        if (Array.isArray(parsed)) setSavedLooks(parsed);
      }
    } catch {
      // ignore
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.BOOKMARKED_NEWS,
        JSON.stringify(bookmarkedNewsIds)
      );
      if (!authUser) {
        localStorage.setItem(STORAGE_KEYS.WARDROBE, JSON.stringify(wardrobe));
        localStorage.setItem(
          STORAGE_KEYS.SAVED_LOOKS,
          JSON.stringify(savedLooks)
        );
      }
    } catch {
      // ignore
    }
  }, [isHydrated, bookmarkedNewsIds, wardrobe, savedLooks, authUser]);

  // HOME 뉴스레터 자동 로드
  const fetchNewsletterFeed = useCallback(async (forceRefresh = false) => {
    setIsLoadingNews(true);
    try {
      const res = await fetch(
        `/api/newsletter${forceRefresh ? '?refresh=1' : ''}`
      );
      const json = await res.json();
      if (Array.isArray(json?.articles) && json.articles.length > 0) {
        setNewsArticles(json.articles);
        try {
          localStorage.setItem(
            STORAGE_KEYS.NEWS_CACHE,
            JSON.stringify(json.articles)
          );
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    void fetchNewsletterFeed(false);
  }, [fetchNewsletterFeed]);

  const handleOpenArticle = async (article: NewsletterArticle) => {
    setActiveArticle(article);
    setArticleDetail(null);
    setIsLoadingArticleDetail(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: article.url,
          title: article.originalTitle || article.title,
          summary: article.originalSummary || article.summary,
        }),
      });
      const json = await res.json();
      if (json?.success) {
        setArticleDetail({
          titleKo: json.titleKo || article.title,
          highlightsKo: Array.isArray(json.highlightsKo)
            ? json.highlightsKo
            : [],
          paragraphsKo: Array.isArray(json.paragraphsKo)
            ? json.paragraphsKo
            : [],
          isTranslated: Boolean(json.isTranslated || article.isTranslated),
          heroImage: json.heroImage,
        });
      }
    } catch {
      // fallback
    } finally {
      setIsLoadingArticleDetail(false);
    }
  };

  // 클라우드 전체 동기화 (모르는 사람·비로그인 방문자도 KREAM처럼 모든 STYLE 게시물·옷장 공개 열람 가능!)
  const loadCloudData = useCallback(
    async (client: SupabaseClient, user: User | null) => {
      try {
        let activeHandle = '@my_873oc';
        let activeAvatar = '';
        let activeBio =
          '옷장 아이템을 터치해 어울리는 코디를 자유롭게 제안해 주세요!';

        if (user) {
          const defaultNick =
            '@' +
            (
              user.user_metadata?.preferred_username ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              '873oc_user'
            )
              .toLowerCase()
              .replace(/[^a-z0-9가-힣_]/g, '');

          const { data: profData } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (profData) {
            activeHandle = (profData.handle || defaultNick).replace(
              /^@(aurafit|oblique)_/,
              '@873oc_'
            );
            activeAvatar =
              (typeof profData.avatar_url === 'string' && profData.avatar_url) ||
              extractAvatarFromDna(profData.dna) ||
              (typeof user.user_metadata?.avatar_url === 'string'
                ? user.user_metadata.avatar_url
                : '');
            activeBio = profData.bio || profData.style_request || activeBio;

            if (profData.is_public === false) {
              await client
                .from('profiles')
                .update({ is_public: true })
                .eq('id', user.id);
            }
          } else {
            activeHandle = defaultNick;
            activeAvatar =
              typeof user.user_metadata?.avatar_url === 'string'
                ? user.user_metadata.avatar_url
                : '';
            await client.from('profiles').upsert({
              id: user.id,
              handle: defaultNick,
              is_public: true,
            });
          }

          setMyHandle(activeHandle);
          setMyAvatarUrl(activeAvatar);
          setMyBio(activeBio);
          try {
            localStorage.setItem(STORAGE_KEYS.MY_AVATAR, activeAvatar);
          } catch {
            // ignore
          }

          // 내 옷장 조회 및 레거시 샘플 정리
          const { data: wRows } = await client
            .from('wardrobe_items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (Array.isArray(wRows)) {
            const legacyRows = wRows.filter(
              (r) =>
                LEGACY_SAMPLE_ITEM_NAMES.has(String(r.name || '')) &&
                String(r.image_url || '').startsWith('data:image/svg+xml;utf8,')
            );
            if (legacyRows.length > 0) {
              await client
                .from('wardrobe_items')
                .delete()
                .in(
                  'id',
                  legacyRows.map((r) => r.id)
                )
                .eq('user_id', user.id);
            }

            const cleanRows = wRows.filter(
              (r) =>
                !(
                  LEGACY_SAMPLE_ITEM_NAMES.has(String(r.name || '')) &&
                  String(r.image_url || '').startsWith(
                    'data:image/svg+xml;utf8,'
                  )
                )
            );
            const mappedCloset: ClothItem[] = cleanRows.map((r) => {
              const meta = decodeWardrobeSourceMeta(r.source_url);
              return {
                id: Number(r.id),
                name: r.name,
                category: r.category as CategoryType,
                season: r.season,
                status: r.status as ClothStatus,
                sourceUrl: meta.cleanUrl,
                photoSide: meta.photoSide,
                extraImages: meta.extraImages,
                image: r.image_url,
              };
            });
            setWardrobe(mappedCloset);
            if (mappedCloset.length > 0) {
              setMySubTab((prev) => (prev === 'posts' ? 'closet' : prev));
            }
          }

          // 저장된 룩북 로드
          const { data: lRows } = await client
            .from('saved_looks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (Array.isArray(lRows)) {
            setSavedLooks(
              lRows.map((r) => {
                const rawJson = r.items_json;
                const parsedItems: ClothItem[] = Array.isArray(rawJson)
                  ? rawJson
                  : Array.isArray(rawJson?.items)
                  ? rawJson.items
                  : [];
                const parsedCover =
                  !Array.isArray(rawJson) &&
                  typeof rawJson?.lookbookImage === 'string' &&
                  rawJson.lookbookImage
                    ? rawJson.lookbookImage
                    : !Array.isArray(rawJson) &&
                      typeof rawJson?.lookbookAngles?.front === 'string'
                    ? rawJson.lookbookAngles.front
                    : undefined;
                return {
                  id: Number(r.id),
                  genre: r.genre,
                  mode: (r.mode as 'DAY' | 'NIGHT') || 'DAY',
                  title: r.title,
                  items: parsedItems,
                  note: r.note || '',
                  lookbookImage: parsedCover,
                  stylePresetLabel:
                    (!Array.isArray(rawJson) && rawJson?.stylePresetLabel) ||
                    '스튜디오 샷',
                };
              })
            );
          }
        }

        // 모든 공개 프로필 · 공개 옷장 · 코디 제안 · STYLE 게시물 병렬 조회
        const [
          { data: pubProfiles },
          { data: allPubItems },
          { data: allProps },
          { data: postRows, error: postErr },
        ] = await Promise.all([
          client.from('profiles').select('*').limit(100),
          client
            .from('wardrobe_items')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500),
          client
            .from('outfit_proposals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200),
          client
            .from('style_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

        const profAvatarLookup = new Map<string, string>();
        if (user && activeAvatar) {
          profAvatarLookup.set(user.id, activeAvatar);
        }
        (pubProfiles || []).forEach((pr) => {
          const av =
            (typeof pr.avatar_url === 'string' && pr.avatar_url) ||
            extractAvatarFromDna(pr.dna) ||
            '';
          if (av) profAvatarLookup.set(String(pr.id), av);
        });

        const myProps: Proposal[] = user
          ? (allProps || [])
              .filter((p) => p.target_user_id === user.id)
              .map((p) => parseProposalRow(p as Record<string, unknown>))
              .filter((p): p is Proposal => p !== null)
          : [];

        const liveOthers: CommunityUser[] = (pubProfiles || [])
          .filter((prof) => !user || prof.id !== user.id)
          .map((prof) => {
            const uCloset: ClothItem[] = (allPubItems || [])
              .filter(
                (w) =>
                  w.user_id === prof.id &&
                  !(
                    LEGACY_SAMPLE_ITEM_NAMES.has(String(w.name || '')) &&
                    String(w.image_url || '').startsWith(
                      'data:image/svg+xml;utf8,'
                    )
                  )
              )
              .map((w) => {
                const meta = decodeWardrobeSourceMeta(w.source_url);
                return {
                  id: Number(w.id),
                  name: w.name,
                  category: w.category as CategoryType,
                  season: w.season,
                  status: w.status as ClothStatus,
                  sourceUrl: meta.cleanUrl,
                  photoSide: meta.photoSide,
                  extraImages: meta.extraImages,
                  image: w.image_url,
                };
              });

            const uProps: Proposal[] = (allProps || [])
              .filter((p) => p.target_user_id === prof.id)
              .map((p) => parseProposalRow(p as Record<string, unknown>))
              .filter((p): p is Proposal => p !== null);

            const av =
              (typeof prof.avatar_url === 'string' && prof.avatar_url) ||
              extractAvatarFromDna(prof.dna) ||
              '';

            return {
              id: String(prof.id),
              handle: String(prof.handle || '@873oc_member').replace(
                /^@(aurafit|oblique)_/,
                '@873oc_'
              ),
              avatarUrl: av,
              bio:
                prof.bio ||
                prof.style_request ||
                '옷장 아이템을 터치해 어울리는 코디를 제안해 주세요!',
              isPublic: true,
              isLiveCloudUser: true,
              closet: uCloset,
              proposals: uProps,
            };
          });

        const meEntry: CommunityUser = {
          id: 'me',
          handle: activeHandle,
          avatarUrl: activeAvatar,
          bio: activeBio,
          isPublic: true,
          isLiveCloudUser: Boolean(user),
          closet: [],
          proposals: myProps,
        };
        setCommunityUsers([meEntry, ...liveOthers]);

        if (!postErr && Array.isArray(postRows)) {
          const [
            { data: likeRows },
            { data: commentRows },
            { data: followRows },
          ] = await Promise.all([
            client.from('style_post_likes').select('*').limit(2000),
            client
              .from('style_post_comments')
              .select('*')
              .order('created_at', { ascending: true })
              .limit(1000),
            client.from('user_follows').select('*').limit(2000),
          ]);

          if (Array.isArray(followRows)) {
            setFollowEdges(
              followRows.map((f) => ({
                followerId: String(f.follower_id),
                followingId: String(f.following_id),
              }))
            );
          }

          const mappedPosts: StylePost[] = postRows.map((pr) => {
            const pid = Number(pr.id);
            const pUid = String(pr.user_id);
            const pLikes = Array.from(
              new Set(
                (likeRows || [])
                  .filter((lk) => Number(lk.post_id) === pid)
                  .map((lk) => String(lk.user_id))
              )
            );
            const pComments: StyleComment[] = (commentRows || [])
              .filter((cm) => Number(cm.post_id) === pid)
              .map((cm) => {
                const cUid = String(cm.user_id);
                return {
                  id: String(cm.id),
                  postId: pid,
                  userId: cUid,
                  authorHandle: String(cm.author_handle || '@873oc').replace(
                    /^@(aurafit|oblique)_/,
                    '@873oc_'
                  ),
                  authorAvatar: profAvatarLookup.get(cUid) || undefined,
                  body: String(cm.body || ''),
                  createdAt: formatRelativeTime(cm.created_at),
                };
              });
            const tagged: TaggedClothRef[] = Array.isArray(pr.tagged_items)
              ? pr.tagged_items
              : [];
            return {
              id: pid,
              userId: pUid,
              authorHandle: String(pr.author_handle || '@873oc').replace(
                /^@(aurafit|oblique)_/,
                '@873oc_'
              ),
              authorAvatar: profAvatarLookup.get(pUid) || undefined,
              imageUrl: String(pr.image_url || ''),
              caption: String(pr.caption || ''),
              styleTags: Array.isArray(pr.style_tags) ? pr.style_tags : [],
              taggedItems: tagged,
              likeUserIds: pLikes,
              comments: pComments,
              createdAt: formatRelativeTime(pr.created_at),
              createdIso: String(pr.created_at || new Date().toISOString()),
            };
          });

          setStylePosts(mappedPosts);
          if (user && mappedPosts.some((mp) => mp.userId === user.id)) {
            setMySubTab('posts');
          }
        }
      } catch {
        // ignore transient error
      }
    },
    []
  );

  useEffect(() => {
    if (!supabaseClient) {
      setAuthUser(null);
      return;
    }

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setAuthUser(u);
      void loadCloudData(supabaseClient, u);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_ev, session) => {
      const u = session?.user ?? null;
      setAuthUser(u);
      void loadCloudData(supabaseClient, u);
    });

    return () => subscription.unsubscribe();
  }, [supabaseClient, loadCloudData]);

  useEffect(() => {
    if (!zoomImageUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomImageUrl('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomImageUrl]);

  // 이메일 · 소셜 로그인
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseClient) {
      setAuthMessage('서비스 연결을 확인해 주세요.');
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    try {
      if (authMode === 'signup') {
        const cleanNick = authNickname
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9가-힣_]/g, '');
        const { data, error } = await supabaseClient.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: {
              preferred_username: cleanNick || undefined,
            },
          },
        });
        if (error) {
          setAuthMessage(error.message);
        } else if (data.session) {
          setAuthModalOpen(false);
          showToast('회원가입 및 로그인이 완료되었습니다!');
        } else {
          setAuthMessage('가입 확인 메일이 발송되었습니다. 메일함을 확인해 주세요.');
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) {
          setAuthMessage(error.message);
        } else {
          setAuthModalOpen(false);
          showToast('로그인되었습니다.');
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
  };

  const handleSignOut = async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    setAuthUser(null);
    setMyAvatarUrl('');
    setWardrobe([]);
    setSavedLooks([]);
    setSelectedClothIds([]);
    setAuthModalOpen(false);
    showToast('로그아웃되었습니다.');
  };

  // 타 사용자 프로필 진입
  const handleVisitUserProfile = (userId: string, handleHint?: string) => {
    if (!userId || userId === 'me' || (authUser && userId === authUser.id)) {
      setCurrentTab('my');
      return;
    }
    setCommunityUsers((prev) => {
      if (prev.some((u) => u.id === userId)) return prev;
      return [
        ...prev,
        {
          id: userId,
          handle: handleHint || '@873oc_user',
          avatarUrl: '',
          bio: '옷장 아이템을 터치해 어울리는 코디를 제안해 주세요!',
          isPublic: true,
          isLiveCloudUser: true,
          closet: [],
          proposals: [],
        },
      ];
    });
    if (currentTab !== 'user_profile') {
      setPreviousTab(currentTab);
    }
    setViewingUserId(userId);
    setOtherSubTab('closet');
    setCurrentTab('user_profile');
  };

  // 팔로우 / 언팔로우 토글
  const handleToggleFollow = async (targetUserId: string) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!targetUserId || targetUserId === authUser.id) return;

    const already = followEdges.some(
      (f) => f.followerId === authUser.id && f.followingId === targetUserId
    );

    if (already) {
      setFollowEdges((prev) =>
        prev.filter(
          (f) =>
            !(f.followerId === authUser.id && f.followingId === targetUserId)
        )
      );
      if (supabaseClient) {
        await supabaseClient
          .from('user_follows')
          .delete()
          .eq('follower_id', authUser.id)
          .eq('following_id', targetUserId);
      }
      showToast('팔로우를 취소했습니다.');
    } else {
      setFollowEdges((prev) => [
        ...prev,
        { followerId: authUser.id, followingId: targetUserId },
      ]);
      if (supabaseClient) {
        await supabaseClient.from('user_follows').insert({
          follower_id: authUser.id,
          following_id: targetUserId,
        });
      }
      showToast('팔로우했습니다!');
    }
  };

  // STYLE 게시물 업로드
  const handleCreateStylePost = async (draft: {
    file: File;
    caption: string;
    styleTags: string[];
    taggedClothIds: number[];
  }): Promise<boolean> => {
    if (!authUser) {
      setAuthModalOpen(true);
      return false;
    }

    try {
      const compressed = await compressImageToWebP(draft.file, 1350, 0.85);
      let finalPhotoUrl = compressed.dataUrl;

      if (supabaseClient && compressed.blob) {
        const fileName = `style_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}.${compressed.ext}`;
        const storagePath = `${authUser.id}/${fileName}`;
        const { error: upErr } = await supabaseClient.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, compressed.blob, {
            contentType: compressed.mimeType,
            cacheControl: '3600',
            upsert: false,
          });
        if (!upErr) {
          const { data: pubData } = supabaseClient.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);
          if (pubData?.publicUrl) {
            finalPhotoUrl = pubData.publicUrl;
          }
        }
      }

      const taggedRefs: TaggedClothRef[] = wardrobe
        .filter((w) => draft.taggedClothIds.includes(w.id))
        .map((w) => ({
          id: w.id,
          name: w.name,
          category: w.category,
          image: w.image,
          sourceUrl: w.sourceUrl || '',
        }));

      let createdPostId = Date.now();

      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('style_posts')
          .insert({
            user_id: authUser.id,
            author_handle: myHandle,
            image_url: finalPhotoUrl,
            caption: draft.caption.trim(),
            style_tags: draft.styleTags,
            tagged_items: taggedRefs,
          })
          .select('*')
          .single();

        if (!error && data) {
          createdPostId = Number(data.id);
        }
      }

      const newPost: StylePost = {
        id: createdPostId,
        userId: authUser.id,
        authorHandle: myHandle,
        authorAvatar: myAvatarUrl || undefined,
        imageUrl: finalPhotoUrl,
        caption: draft.caption.trim(),
        styleTags: draft.styleTags,
        taggedItems: taggedRefs,
        likeUserIds: [],
        comments: [],
        createdAt: '방금 전',
        createdIso: new Date().toISOString(),
      };

      setStylePosts((prev) => [newPost, ...prev]);
      showToast('STYLE 피드에 게시물이 등록되었습니다!');
      return true;
    } catch {
      showToast('게시물 업로드 중 오류가 발생했습니다.');
      return false;
    }
  };

  // STYLE 게시물 하트 토글 (사용자당 정확히 1회 좋아요 · 재클릭 시 취소)
  const handleToggleLikePost = async (post: StylePost) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    if (likingPostSetRef.current.has(post.id)) return;
    likingPostSetRef.current.add(post.id);

    const liked = post.likeUserIds.includes(authUser.id);

    setStylePosts((prev) =>
      prev.map((p) => {
        if (p.id !== post.id) return p;
        const uniqueSet = new Set(p.likeUserIds);
        if (liked) {
          uniqueSet.delete(authUser.id);
        } else {
          uniqueSet.add(authUser.id);
        }
        return {
          ...p,
          likeUserIds: Array.from(uniqueSet),
        };
      })
    );

    try {
      if (supabaseClient) {
        if (liked) {
          await supabaseClient
            .from('style_post_likes')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', authUser.id);
        } else {
          await supabaseClient.from('style_post_likes').upsert({
            post_id: post.id,
            user_id: authUser.id,
          });
        }
      }
    } finally {
      likingPostSetRef.current.delete(post.id);
    }
  };

  // STYLE 게시물 댓글 등록 & 삭제
  const handleSubmitComment = async (post: StylePost, commentBody: string) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    let newId = `cm_${Date.now()}`;
    if (supabaseClient) {
      const { data } = await supabaseClient
        .from('style_post_comments')
        .insert({
          post_id: post.id,
          user_id: authUser.id,
          author_handle: myHandle,
          body: commentBody,
        })
        .select('id')
        .maybeSingle();
      if (data?.id) newId = String(data.id);
    }

    const cm: StyleComment = {
      id: newId,
      postId: post.id,
      userId: authUser.id,
      authorHandle: myHandle,
      authorAvatar: myAvatarUrl || undefined,
      body: commentBody,
      createdAt: '방금 전',
    };

    setStylePosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, comments: [...p.comments, cm] } : p
      )
    );
  };

  const handleDeleteComment = async (post: StylePost, comment: StyleComment) => {
    if (!authUser || comment.userId !== authUser.id) return;
    setStylePosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, comments: p.comments.filter((c) => c.id !== comment.id) }
          : p
      )
    );
    if (supabaseClient && !comment.id.startsWith('cm_')) {
      await supabaseClient
        .from('style_post_comments')
        .delete()
        .eq('id', Number(comment.id))
        .eq('user_id', authUser.id);
    }
    showToast('댓글이 삭제되었습니다.');
  };

  const handleDeleteStylePost = async (post: StylePost) => {
    if (!authUser || post.userId !== authUser.id) return;
    if (supabaseClient) {
      const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
      if (post.imageUrl.includes(marker)) {
        const rawPath = post.imageUrl.split(marker)[1]?.split('?')[0];
        if (rawPath) {
          await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .remove([decodeURIComponent(rawPath)]);
        }
      }
      await supabaseClient
        .from('style_posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', authUser.id);
    }
    setStylePosts((prev) => prev.filter((p) => p.id !== post.id));
    showToast('게시물이 삭제되었습니다.');
  };

  // MY 프로필 사진 · 아이디 · 소개 업데이트
  const handleUpdateMyProfile = async (
    nextHandle: string,
    nextBio: string,
    avatarFile: File | null,
    removeAvatar: boolean
  ) => {
    const cleanH =
      '@' +
      nextHandle
        .trim()
        .replace(/^@+/, '')
        .replace(/\s+/g, '_')
        .slice(0, 24);
    const finalHandle = cleanH.length > 1 ? cleanH : myHandle;
    const finalBio = nextBio.trim();

    let nextAvatarUrl = removeAvatar ? '' : myAvatarUrl;

    if (avatarFile) {
      try {
        const comp = await compressImageToWebP(avatarFile, 420, 0.86);
        nextAvatarUrl = comp.dataUrl;

        if (authUser && supabaseClient && comp.blob) {
          const fname = `avatar_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 6)}.${comp.ext}`;
          const sp = `${authUser.id}/${fname}`;
          const { error: upErr } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(sp, comp.blob, {
              contentType: comp.mimeType,
              cacheControl: '3600',
              upsert: false,
            });
          if (!upErr) {
            const { data: pubData } = supabaseClient.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(sp);
            if (pubData?.publicUrl) {
              nextAvatarUrl = pubData.publicUrl;
            }
          }
        }
      } catch {
        showToast('프로필 사진을 처리하지 못했습니다.');
        return;
      }
    }

    setMyHandle(finalHandle);
    setMyBio(finalBio);
    setMyAvatarUrl(nextAvatarUrl);
    try {
      localStorage.setItem(STORAGE_KEYS.MY_AVATAR, nextAvatarUrl);
    } catch {
      // ignore
    }

    // 내 기존 게시물 작성자 핸들·프로필사진 즉시 동기화
    if (authUser) {
      setStylePosts((prev) =>
        prev.map((p) =>
          p.userId === authUser.id
            ? {
                ...p,
                authorHandle: finalHandle,
                authorAvatar: nextAvatarUrl || undefined,
              }
            : p
        )
      );
    }

    if (authUser && supabaseClient) {
      const dnaArray = nextAvatarUrl
        ? ['873oc Member', `avatar:${nextAvatarUrl}`]
        : ['873oc Member'];

      const { error } = await supabaseClient.from('profiles').upsert({
        id: authUser.id,
        handle: finalHandle,
        bio: finalBio,
        style_request: finalBio,
        avatar_url: nextAvatarUrl,
        dna: dnaArray,
        is_public: true,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        // avatar_url·bio 컬럼 미적용 환경에서도 dna 백업으로 100% 저장 보장
        await supabaseClient.from('profiles').upsert({
          id: authUser.id,
          handle: finalHandle,
          style_request: finalBio,
          dna: dnaArray,
          is_public: true,
          updated_at: new Date().toISOString(),
        });
      }
    }
    showToast('프로필이 저장되었습니다.');
  };

  // 옷장 코디 슬롯 터치 선택
  const toggleTouchCloth = (itemId: number) => {
    const target = wardrobe.find((w) => w.id === itemId);
    if (!target) return;
    setSelectedClothIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      const withoutSameCat = prev.filter((id) => {
        const found = wardrobe.find((w) => w.id === id);
        return found && found.category !== target.category;
      });
      return [...withoutSameCat, itemId];
    });
  };

  const autoTouchSelectOutfit = (): number[] => {
    if (wardrobe.length === 0) {
      showToast('먼저 옷장에 의류를 등록해 주세요.');
      return [];
    }
    const cats: CategoryType[] = ['아우터', '상의', '하의', '신발', '악세사리'];
    const picked: number[] = [];
    for (let i = 0; i < cats.length; i++) {
      const pool = wardrobe.filter((w) => w.category === cats[i]);
      if (pool.length > 0) {
        const rand = pool[Math.floor(Math.random() * pool.length)];
        picked.push(rand.id);
      }
    }
    setSelectedClothIds(picked);
    return picked;
  };

  // STUDIO 모델샷 촬영
  const prepareGarmentsForLookbook = async (sourceItems: ClothItem[]) => {
    return Promise.all(
      sourceItems.map(async (it) => {
        let mainImg = it.image;
        if (
          mainImg &&
          mainImg.startsWith('data:image/') &&
          !mainImg.startsWith('data:image/svg')
        ) {
          const small = await compressDataUrlToWebP(mainImg, 768, 0.82);
          mainImg = small.dataUrl;
        }
        const rawExtras = Array.isArray(it.extraImages)
          ? it.extraImages.slice(0, 3)
          : [];
        const preparedExtras = await Promise.all(
          rawExtras.map(async (ex) => {
            if (
              ex &&
              ex.startsWith('data:image/') &&
              !ex.startsWith('data:image/svg')
            ) {
              const smallEx = await compressDataUrlToWebP(ex, 720, 0.8);
              return smallEx.dataUrl;
            }
            return ex;
          })
        );
        return {
          name: it.name,
          category: it.category,
          status: it.status,
          image: mainImg,
          sourceUrl: it.sourceUrl || '',
          photoSide: it.photoSide || 'auto',
          extraImages: preparedExtras.filter(Boolean),
        };
      })
    );
  };

  const generateLookbookPhoto = async (
    overrideItems?: ClothItem[],
    overrideGenre?: string
  ) => {
    const validSelected = wardrobe.filter((w) =>
      selectedClothIds.includes(w.id)
    );
    const sourceItems = (
      overrideItems ||
      stylistResult?.items ||
      validSelected
    ).slice(0, 5);

    if (sourceItems.length === 0) {
      showToast('먼저 코디할 의류를 1벌 이상 선택해 주세요.');
      return;
    }

    if (lookbookFitTarget === 'my_photo' && !userTryOnPhoto) {
      showToast('내 전신 · 거울샷 사진을 먼저 선택해 주세요.');
      return;
    }

    const activeGenreVal =
      overrideGenre || stylistResult?.genre || selectedGenre;

    const sessionId = Date.now();
    shootSessionRef.current = sessionId;
    setLookbookStatusHint('');
    setIsGeneratingLookbook(true);

    try {
      const preparedGarments = await prepareGarmentsForLookbook(sourceItems);
      let preparedUserPhoto: string | undefined = undefined;
      if (lookbookFitTarget === 'my_photo' && userTryOnPhoto) {
        const smallUser = await compressDataUrlToWebP(
          userTryOnPhoto,
          896,
          0.84
        );
        preparedUserPhoto = smallUser.dataUrl;
      }

      const resp = await fetch('/api/lookbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDarkMode: activeGenreVal === '서브컬처',
          concept: lookbookConcept,
          fitTarget: lookbookFitTarget,
          activeGenre: activeGenreVal,
          selectedDetails: activeDetails,
          customDetailNote: customDetailNote.trim(),
          garments: preparedGarments,
          userModelImage: preparedUserPhoto,
        }),
      });

      const json = await resp.json();
      if (shootSessionRef.current !== sessionId) return;

      if (!json?.success || typeof json.imageDataUrl !== 'string') {
        setIsGeneratingLookbook(false);
        setLookbookStatusHint(
          json?.message || '모델샷 촬영 중 오류가 발생했습니다.'
        );
        return;
      }

      const frontWebp = await compressDataUrlToWebP(
        json.imageDataUrl,
        1280,
        0.88
      );
      if (shootSessionRef.current !== sessionId) return;

      const resolvedLabel =
        typeof json.presetLabel === 'string' && json.presetLabel
          ? json.presetLabel
          : lookbookConcept === 'street'
          ? '거리샷'
          : '스튜디오 샷';
      setStylistResult((prev) =>
        prev
          ? {
              ...prev,
              lookbookImage: frontWebp.dataUrl,
              lookbookPresetLabel: resolvedLabel,
            }
          : prev
      );
      setIsGeneratingLookbook(false);
      showToast(`${resolvedLabel} 촬영이 완성되었습니다!`);
    } catch {
      if (shootSessionRef.current === sessionId) {
        setIsGeneratingLookbook(false);
        setLookbookStatusHint('모델샷 서버 연결에 실패했습니다.');
      }
    }
  };

  const generateAIOutfit = async () => {
    let targetIds = selectedClothIds.filter((id) =>
      wardrobe.some((w) => w.id === id)
    );
    if (targetIds.length === 0) {
      targetIds = autoTouchSelectOutfit();
    }
    const picked = wardrobe.filter((w) => targetIds.includes(w.id));
    if (picked.length === 0) return;

    setIsGenerating(true);
    let aiTitle = `${selectedGenre} 에디토리얼 룩`;
    let aiNote = `${picked
      .map((p) => p.name)
      .join(', ')} 조합의 실루엣과 컬러 톤을 깔끔하게 정돈한 데일리 스타일링입니다.`;
    let suggestions: MissingSuggestion[] = [];

    try {
      const resp = await fetch('/api/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDarkMode: selectedGenre === '서브컬처',
          activeGenre: selectedGenre,
          items: picked.map((p) => ({ name: p.name, category: p.category })),
          selectedDetails: activeDetails,
          customDetailNote: customDetailNote.trim(),
          budget: '합리적 매치',
        }),
      });
      const data = await resp.json();
      if (data?.usedRealApi && data?.note) {
        aiTitle = data.title || aiTitle;
        aiNote = data.note;
        if (Array.isArray(data.missingItems)) {
          suggestions = data.missingItems;
        }
      }
    } catch {
      // fallback note
    }

    setStylistResult({
      id: Date.now(),
      genreTag: selectedGenre,
      apiBadge: '873oc STUDIO',
      title: aiTitle,
      note: aiNote,
      items: picked,
      suggestions,
      filterSummary: activeDetails.join(', '),
      mode: selectedGenre === '서브컬처' ? 'NIGHT' : 'DAY',
      genre: selectedGenre,
    });
    setIsGenerating(false);

    if (autoShootLookbook) {
      void generateLookbookPhoto(picked, selectedGenre);
    }
  };

  const handleSaveCurrentLook = async () => {
    if (!stylistResult || isSavingLookbook) return;
    setIsSavingLookbook(true);
    try {
      let persistedCoverUrl = stylistResult.lookbookImage;
      if (persistedCoverUrl && persistedCoverUrl.startsWith('data:image/')) {
        const compressed = await compressDataUrlToWebP(
          persistedCoverUrl,
          1100,
          0.84
        );
        persistedCoverUrl = compressed.dataUrl;
        if (authUser && supabaseClient && compressed.blob) {
          const fileName = `lookbook_${Date.now()}_front_${Math.random()
            .toString(36)
            .slice(2, 6)}.${compressed.ext}`;
          const storagePath = `${authUser.id}/${fileName}`;
          const { error: upErr } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, compressed.blob, {
              contentType: compressed.mimeType,
              cacheControl: '3600',
              upsert: false,
            });
          if (!upErr) {
            const { data: pubData } = supabaseClient.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              persistedCoverUrl = pubData.publicUrl;
            }
          }
        }
      }

      const labelToSave =
        stylistResult.lookbookPresetLabel ||
        (lookbookConcept === 'street' ? '거리샷' : '스튜디오 샷');

      if (authUser && supabaseClient) {
        const payload = persistedCoverUrl
          ? {
              items: stylistResult.items,
              lookbookImage: persistedCoverUrl,
              stylePresetLabel: labelToSave,
            }
          : stylistResult.items;

        const { data } = await supabaseClient
          .from('saved_looks')
          .insert({
            user_id: authUser.id,
            genre: stylistResult.genre,
            mode: stylistResult.mode,
            title: stylistResult.title,
            items_json: payload,
            note: stylistResult.note,
          })
          .select('*')
          .maybeSingle();

        if (data) {
          setSavedLooks((prev) => [
            {
              id: Number(data.id),
              genre: data.genre,
              mode: data.mode as 'DAY' | 'NIGHT',
              title: data.title,
              items: stylistResult.items,
              note: data.note,
              lookbookImage: persistedCoverUrl,
              stylePresetLabel: labelToSave,
            },
            ...prev,
          ]);
          showToast('마이페이지 저장된 룩북에 보관되었습니다!');
          return;
        }
      }

      setSavedLooks((prev) => [
        {
          id: Date.now(),
          genre: stylistResult.genre,
          mode: stylistResult.mode,
          title: stylistResult.title,
          items: stylistResult.items,
          note: stylistResult.note,
          lookbookImage: persistedCoverUrl,
          stylePresetLabel: labelToSave,
        },
        ...prev,
      ]);
      showToast('저장된 룩북에 보관되었습니다!');
    } finally {
      setIsSavingLookbook(false);
    }
  };

  const handleDeleteSavedLook = async (lookId: number) => {
    if (authUser && supabaseClient) {
      await supabaseClient
        .from('saved_looks')
        .delete()
        .eq('id', lookId)
        .eq('user_id', authUser.id);
    }
    setSavedLooks((prev) => prev.filter((l) => l.id !== lookId));
  };

  // 의류 추가 · URL 추출 · 사후 수정 · 삭제
  const insertClothItem = async (
    draft: Omit<ClothItem, 'id'>
  ): Promise<ClothItem> => {
    const cleanSource = stripWardrobeMetaHash(draft.sourceUrl);
    const encodedSource = encodeWardrobeSourceMeta(
      cleanSource,
      draft.photoSide,
      draft.extraImages
    );

    if (authUser && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('wardrobe_items')
        .insert({
          user_id: authUser.id,
          name: draft.name,
          category: draft.category,
          season: draft.season,
          status: draft.status,
          source_url: encodedSource,
          image_url: draft.image,
        })
        .select('*')
        .single();

      if (!error && data) {
        const meta = decodeWardrobeSourceMeta(data.source_url);
        return {
          id: Number(data.id),
          name: data.name,
          category: data.category as CategoryType,
          season: data.season,
          status: data.status as ClothStatus,
          sourceUrl: meta.cleanUrl,
          photoSide: meta.photoSide,
          extraImages: meta.extraImages,
          image: data.image_url,
        };
      }
    }

    return { ...draft, id: Date.now(), sourceUrl: cleanSource };
  };

  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const comp = await compressImageToWebP(file, 1280, 0.84);
      setPhotoDataUrl(comp.dataUrl);
      setPhotoBlob(comp.blob);
      setPhotoExt(comp.ext);
      setPhotoMime(comp.mimeType);
      const compKb = Math.max(1, Math.round(comp.compressedBytes / 1024));
      setPhotoCompressInfo(`${comp.ext.toUpperCase()} 최적화 (${compKb}KB)`);
    } catch {
      showToast('이미지를 읽지 못했습니다.');
    }
  };

  const handleClothUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl || !photoName.trim() || isUploadingCloth) return;
    setIsUploadingCloth(true);
    try {
      let finalImg = photoDataUrl;
      if (authUser && supabaseClient && photoBlob) {
        const uniqueName = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}.${photoExt}`;
        const storagePath = `${authUser.id}/${uniqueName}`;
        const { error: upErr } = await supabaseClient.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, photoBlob, {
            contentType: photoMime,
            cacheControl: '3600',
            upsert: false,
          });
        if (!upErr) {
          const { data: pubData } = supabaseClient.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);
          if (pubData?.publicUrl) finalImg = pubData.publicUrl;
        }
      }

      const created = await insertClothItem({
        name: photoName.trim(),
        category: photoCategory,
        season: photoSeason,
        status: photoStatus,
        sourceUrl: photoSourceUrlInput.trim(),
        photoSide: photoSideInput,
        image: finalImg,
      });

      setWardrobe((prev) => [created, ...prev]);
      setPhotoName('');
      setPhotoDataUrl('');
      setPhotoBlob(null);
      setPhotoCompressInfo('');
      setPhotoSideInput('auto');
      setPhotoSourceUrlInput('');
      setUploadModalOpen(false);
      showToast(`'${created.name}' 아이템이 옷장에 등록되었습니다.`);
    } finally {
      setIsUploadingCloth(false);
    }
  };

  const fetchUrlMetadata = async (preset?: UrlPreviewData) => {
    setUrlCustomBlob(null);
    const trimmed = (preset?.url || shopUrlInput).trim();
    if (!trimmed) {
      showToast('상품 링크를 입력해 주세요.');
      return;
    }

    setIsFetchingUrl(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json();
      if (json?.success && json?.name) {
        const cleanPageUrl =
          typeof json.cleanUrl === 'string' && json.cleanUrl
            ? json.cleanUrl
            : trimmed;
        const serverDataUrl =
          typeof json.imageDataUrl === 'string' ? json.imageDataUrl.trim() : '';
        const rawImg = typeof json.image === 'string' ? json.image.trim() : '';

        let readyDisplayUrl = '';
        if (serverDataUrl.startsWith('data:image/')) {
          try {
            const respBlob = await (await fetch(serverDataUrl)).blob();
            const f = new File([respBlob], 'product.jpg', {
              type: respBlob.type || 'image/jpeg',
            });
            const comp = await compressImageToWebP(f, 1080, 0.84);
            readyDisplayUrl = comp.dataUrl;
            setUrlCustomBlob(comp.blob);
            setUrlCustomExt(comp.ext);
            setUrlCustomMime(comp.mimeType);
          } catch {
            readyDisplayUrl = serverDataUrl;
          }
        } else if (rawImg && /^https?:\/\//i.test(rawImg)) {
          readyDisplayUrl = `/api/scrape?imageUrl=${encodeURIComponent(
            rawImg
          )}&referer=${encodeURIComponent(cleanPageUrl)}`;
        }

        const fallbackSvg = createMinimalPlaceholderSvg(
          json.store || 'ITEM',
          '873oc'
        );

        setShopUrlInput(cleanPageUrl);
        setUrlPreview({
          url: cleanPageUrl,
          store: json.store || 'STORE',
          name: json.name,
          price: json.price || '상품 링크 연동 완료',
          category: (json.category as CategoryType) || '상의',
          season: json.season || '사계절',
          image: readyDisplayUrl || fallbackSvg,
          rawImageUrl: readyDisplayUrl || fallbackSvg,
          galleryUrls: Array.isArray(json.galleryUrls) ? json.galleryUrls : [],
          galleryDataUrls: Array.isArray(json.galleryDataUrls)
            ? json.galleryDataUrls
            : [],
          autoExtracted: true,
        });
        setIsFetchingUrl(false);
        return;
      }
    } catch {
      // fallback
    }

    setUrlPreview({
      url: trimmed,
      store: 'STORE',
      name: '',
      price: '상품명과 사진을 직접 입력해 등록할 수 있습니다.',
      category: '상의',
      season: '사계절',
      image: createMinimalPlaceholderSvg('DIRECT', '873oc'),
      autoExtracted: false,
    });
    setIsFetchingUrl(false);
  };

  const handleSelectUrlGalleryThumb = async (dataOrHttpUrl: string) => {
    if (!urlPreview) return;
    try {
      if (dataOrHttpUrl.startsWith('data:image/')) {
        const respBlob = await (await fetch(dataOrHttpUrl)).blob();
        const f = new File([respBlob], 'thumb.jpg', {
          type: respBlob.type || 'image/jpeg',
        });
        const comp = await compressImageToWebP(f, 1080, 0.84);
        setUrlCustomBlob(comp.blob);
        setUrlCustomExt(comp.ext);
        setUrlCustomMime(comp.mimeType);
        setUrlPreview({ ...urlPreview, image: comp.dataUrl });
      } else {
        setUrlPreview({ ...urlPreview, image: dataOrHttpUrl });
      }
    } catch {
      // ignore
    }
  };

  const handleUrlCustomPhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !urlPreview) return;
    try {
      const comp = await compressImageToWebP(file, 1080, 0.84);
      setUrlCustomBlob(comp.blob);
      setUrlCustomExt(comp.ext);
      setUrlCustomMime(comp.mimeType);
      setUrlPreview({ ...urlPreview, image: comp.dataUrl });
    } catch {
      showToast('사진을 변경하지 못했습니다.');
    }
  };

  const confirmUrlClothUpload = async () => {
    if (!urlPreview || !urlPreview.name.trim()) {
      showToast('상품명을 입력해 주세요.');
      return;
    }
    setIsUploadingCloth(true);
    try {
      let finalImageUrl =
        urlPreview.image || createMinimalPlaceholderSvg(urlPreview.store);
      if (authUser && supabaseClient) {
        let blobToUpload = urlCustomBlob;
        let extToUpload = urlCustomExt;
        let mimeToUpload = urlCustomMime;

        if (
          !blobToUpload &&
          urlPreview.image.startsWith('/api/scrape?imageUrl=')
        ) {
          try {
            const imgResp = await fetch(urlPreview.image);
            if (imgResp.ok) {
              const b = await imgResp.blob();
              const f = new File([b], 'scraped.jpg', {
                type: b.type || 'image/jpeg',
              });
              const comp = await compressImageToWebP(f, 1280, 0.84);
              blobToUpload = comp.blob;
              extToUpload = comp.ext;
              mimeToUpload = comp.mimeType;
            }
          } catch {
            // keep proxy URL
          }
        }

        if (blobToUpload) {
          const uniqueName = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}.${extToUpload}`;
          const storagePath = `${authUser.id}/${uniqueName}`;
          const { error: upErr } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, blobToUpload, {
              contentType: mimeToUpload,
              cacheControl: '3600',
              upsert: false,
            });
          if (!upErr) {
            const { data: pubData } = supabaseClient.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(storagePath);
            if (pubData?.publicUrl) finalImageUrl = pubData.publicUrl;
          }
        }
      }

      const created = await insertClothItem({
        name: urlPreview.name.trim(),
        category: urlPreview.category,
        season: urlPreview.season,
        status: urlStatus,
        sourceUrl: urlPreview.url,
        photoSide: 'auto',
        extraImages: Array.isArray(urlPreview.galleryUrls)
          ? urlPreview.galleryUrls.slice(0, 4)
          : [],
        image: finalImageUrl,
      });

      setWardrobe((prev) => [created, ...prev]);
      setUrlPreview(null);
      setUrlCustomBlob(null);
      setShopUrlInput('');
      setUploadModalOpen(false);
      showToast(`'${created.name}' 상품이 내 옷장에 추가되었습니다.`);
    } finally {
      setIsUploadingCloth(false);
    }
  };

  const openEditClothModal = (item: ClothItem) => {
    setEditingCloth(item);
    setEditClothName(item.name);
    setEditClothCategory(item.category);
    setEditClothSeason(item.season || '사계절');
    setEditClothStatus(item.status || '보유 중');
    setEditClothSourceUrl(item.sourceUrl || '');
    setEditClothPhotoSide(item.photoSide || 'auto');
    setEditClothExtraImages(
      Array.isArray(item.extraImages) ? item.extraImages : []
    );
  };

  const handleUploadExtraAngleInEdit = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingExtraAngle(true);
    try {
      const comp = await compressImageToWebP(file, 1080, 0.84);
      let finalExtra = comp.dataUrl;
      if (authUser && supabaseClient && comp.blob) {
        const fname = `extra_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 6)}.${comp.ext}`;
        const sp = `${authUser.id}/${fname}`;
        const { error: upErr } = await supabaseClient.storage
          .from(STORAGE_BUCKET)
          .upload(sp, comp.blob, {
            contentType: comp.mimeType,
            cacheControl: '3600',
            upsert: false,
          });
        if (!upErr) {
          const { data: pubData } = supabaseClient.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(sp);
          if (pubData?.publicUrl) finalExtra = pubData.publicUrl;
        }
      }
      setEditClothExtraImages((prev) => [...prev.slice(0, 2), finalExtra]);
    } finally {
      setIsUploadingExtraAngle(false);
    }
  };

  const handleSaveClothEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCloth || isSavingClothEdit) return;
    const cleanName = editClothName.trim() || editingCloth.name;
    const cleanSource = stripWardrobeMetaHash(editClothSourceUrl);
    const encodedSource = encodeWardrobeSourceMeta(
      cleanSource,
      editClothPhotoSide,
      editClothExtraImages
    );
    setIsSavingClothEdit(true);
    try {
      if (authUser && supabaseClient) {
        const { error } = await supabaseClient
          .from('wardrobe_items')
          .update({
            name: cleanName,
            category: editClothCategory,
            season: editClothSeason,
            status: editClothStatus,
            source_url: encodedSource,
          })
          .eq('id', editingCloth.id)
          .eq('user_id', authUser.id);

        if (error) {
          showToast(`수정 실패: ${error.message}`);
          return;
        }
      }

      setWardrobe((prev) =>
        prev.map((w) =>
          w.id === editingCloth.id
            ? {
                ...w,
                name: cleanName,
                category: editClothCategory,
                season: editClothSeason,
                status: editClothStatus,
                sourceUrl: cleanSource,
                photoSide: editClothPhotoSide,
                extraImages: editClothExtraImages,
              }
            : w
        )
      );
      setEditingCloth(null);
      showToast('의류 정보가 수정되었습니다.');
    } finally {
      setIsSavingClothEdit(false);
    }
  };

  const deleteCloth = async (id: number) => {
    const target = wardrobe.find((w) => w.id === id);
    if (authUser && supabaseClient) {
      const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
      if (target?.image && target.image.includes(marker)) {
        const rawPath = target.image.split(marker)[1]?.split('?')[0];
        if (rawPath) {
          await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .remove([decodeURIComponent(rawPath)]);
        }
      }
      await supabaseClient
        .from('wardrobe_items')
        .delete()
        .eq('id', id)
        .eq('user_id', authUser.id);
    }
    setWardrobe((prev) => prev.filter((w) => w.id !== id));
    setSelectedClothIds((prev) => prev.filter((cid) => cid !== id));
    showToast('의류가 삭제되었습니다.');
  };

  // 타 사용자 옷장 코디 제안 전송 & 사용자당 공감 하트 토글 & 코디 제안 답글 등록/삭제
  const persistProposalEnvelope = async (
    propId: string,
    items: ClothItem[],
    likedUserIds: string[],
    replies: ProposalReply[],
    proposerAvatar?: string
  ) => {
    if (!supabaseClient || propId.startsWith('prop_')) return;
    await supabaseClient
      .from('outfit_proposals')
      .update({
        likes: likedUserIds.length,
        items_snapshot: {
          items,
          likedUserIds,
          replies,
          proposerAvatar: proposerAvatar || '',
        },
      })
      .eq('id', propId);
  };

  const handleSubmitProposalToUser = async (
    targetUser: CommunityUser,
    pickedIds: number[],
    note: string
  ) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    const cleanNote =
      note.trim() || '옷장 아이템들의 실루엣과 컬러 밸런스가 돋보이는 조합입니다!';
    const snapshot = targetUser.closet.filter((c) => pickedIds.includes(c.id));
    let propId = `prop_${Date.now()}`;

    const envelope = {
      items: snapshot,
      likedUserIds: [] as string[],
      replies: [] as ProposalReply[],
      proposerAvatar: myAvatarUrl || '',
    };

    if (supabaseClient) {
      const { data } = await supabaseClient
        .from('outfit_proposals')
        .insert({
          target_user_id: targetUser.id,
          proposer_user_id: authUser.id,
          proposer_handle: myHandle,
          note: cleanNote,
          item_ids: pickedIds,
          items_snapshot: envelope,
          likes: 0,
        })
        .select('id')
        .maybeSingle();
      if (data?.id) propId = String(data.id);
    }

    const newProposal: Proposal = {
      id: propId,
      proposer: myHandle,
      proposerUserId: authUser.id,
      proposerAvatar: myAvatarUrl || undefined,
      note: cleanNote,
      itemIds: pickedIds,
      itemsSnapshot: snapshot,
      likedUserIds: [],
      replies: [],
      likes: 0,
      createdAt: '방금 전',
    };

    setCommunityUsers((prev) =>
      prev.map((u) =>
        u.id === targetUser.id
          ? { ...u, proposals: [newProposal, ...u.proposals] }
          : u
      )
    );
    setOtherSubTab('proposals');
    showToast(`${targetUser.handle} 님에게 코디 제안을 보냈습니다!`);
  };

  const handleToggleLikeProposal = async (
    targetUserId: string,
    prop: Proposal
  ) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    if (likingProposalSetRef.current.has(prop.id)) return;
    likingProposalSetRef.current.add(prop.id);

    const alreadyLiked = prop.likedUserIds.includes(authUser.id);
    const nextSet = new Set(prop.likedUserIds);
    if (alreadyLiked) {
      nextSet.delete(authUser.id);
    } else {
      nextSet.add(authUser.id);
    }
    const nextLikedIds = Array.from(nextSet);

    const updateList = (list: Proposal[]) =>
      list.map((p) =>
        p.id === prop.id
          ? { ...p, likedUserIds: nextLikedIds, likes: nextLikedIds.length }
          : p
      );

    setCommunityUsers((prev) =>
      prev.map((u) =>
        u.id === targetUserId || (targetUserId === 'me' && u.id === 'me')
          ? { ...u, proposals: updateList(u.proposals) }
          : u
      )
    );

    try {
      await persistProposalEnvelope(
        prop.id,
        prop.itemsSnapshot || [],
        nextLikedIds,
        prop.replies,
        prop.proposerAvatar
      );
    } finally {
      likingProposalSetRef.current.delete(prop.id);
    }
  };

  const handleAddProposalReply = async (
    targetUserId: string,
    prop: Proposal,
    replyText: string
  ) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    const newReply: ProposalReply = {
      id: `prep_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      userId: authUser.id,
      authorHandle: myHandle,
      authorAvatar: myAvatarUrl || undefined,
      body: replyText,
      createdAt: '방금 전',
    };
    const nextReplies = [...prop.replies, newReply];

    setCommunityUsers((prev) =>
      prev.map((u) =>
        u.id === targetUserId || (targetUserId === 'me' && u.id === 'me')
          ? {
              ...u,
              proposals: u.proposals.map((p) =>
                p.id === prop.id ? { ...p, replies: nextReplies } : p
              ),
            }
          : u
      )
    );

    await persistProposalEnvelope(
      prop.id,
      prop.itemsSnapshot || [],
      prop.likedUserIds,
      nextReplies,
      prop.proposerAvatar
    );
  };

  const handleDeleteProposalReply = async (
    targetUserId: string,
    prop: Proposal,
    reply: ProposalReply
  ) => {
    if (!authUser || reply.userId !== authUser.id) return;
    const nextReplies = prop.replies.filter((r) => r.id !== reply.id);

    setCommunityUsers((prev) =>
      prev.map((u) =>
        u.id === targetUserId || (targetUserId === 'me' && u.id === 'me')
          ? {
              ...u,
              proposals: u.proposals.map((p) =>
                p.id === prop.id ? { ...p, replies: nextReplies } : p
              ),
            }
          : u
      )
    );

    await persistProposalEnvelope(
      prop.id,
      prop.itemsSnapshot || [],
      prop.likedUserIds,
      nextReplies,
      prop.proposerAvatar
    );
    showToast('답글이 삭제되었습니다.');
  };

  const handleDeleteProposal = async (
    targetUserId: string,
    prop: Proposal
  ) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    const canDelete =
      targetUserId === 'me' ||
      targetUserId === authUser.id ||
      prop.proposerUserId === authUser.id;
    if (!canDelete) return;

    setCommunityUsers((prev) =>
      prev.map((u) =>
        u.id === targetUserId || (targetUserId === 'me' && u.id === 'me')
          ? { ...u, proposals: u.proposals.filter((p) => p.id !== prop.id) }
          : u
      )
    );

    if (supabaseClient && !prop.id.startsWith('prop_')) {
      const { data: delData, error: delErr } = await supabaseClient
        .from('outfit_proposals')
        .delete()
        .eq('id', prop.id)
        .select('id');

      if (delErr || !Array.isArray(delData) || delData.length === 0) {
        await supabaseClient
          .from('outfit_proposals')
          .update({
            likes: 0,
            items_snapshot: {
              deleted: true,
              items: [],
              likedUserIds: [],
              replies: [],
            },
          })
          .eq('id', prop.id);
      }
    }
    showToast('코디 제안이 삭제되었습니다.');
  };

  const handleAdoptProposalToSaved = async (prop: Proposal) => {
    const matchedItems =
      prop.itemsSnapshot && prop.itemsSnapshot.length > 0
        ? prop.itemsSnapshot
        : wardrobe.filter((c) => prop.itemIds.includes(c.id));

    if (authUser && supabaseClient) {
      const { data } = await supabaseClient
        .from('saved_looks')
        .insert({
          user_id: authUser.id,
          genre: `${prop.proposer} 제안 코디`,
          mode: 'DAY',
          title: `${prop.proposer} 님의 코디 제안`,
          items_json: matchedItems,
          note: prop.note,
        })
        .select('*')
        .maybeSingle();
      if (data) {
        setSavedLooks((prev) => [
          {
            id: Number(data.id),
            genre: data.genre,
            mode: 'DAY',
            title: data.title,
            items: matchedItems,
            note: data.note,
          },
          ...prev,
        ]);
        showToast('제안받은 코디가 내 룩북에 저장되었습니다.');
        return;
      }
    }
  };

  const handleUserTryOnPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const comp = await compressImageToWebP(file, 1024, 0.84);
      setUserTryOnPhoto(comp.dataUrl);
      setLookbookFitTarget('my_photo');
      const kb = Math.max(1, Math.round(comp.compressedBytes / 1024));
      setUserTryOnInfo(`${comp.ext.toUpperCase()} · ${kb}KB 준비 완료`);
    } catch {
      showToast('피팅 사진을 불러오지 못했습니다.');
    }
  };

  const downloadImage = (dataOrHttpUrl: string, title: string) => {
    try {
      const a = document.createElement('a');
      a.href = dataOrHttpUrl;
      const safe = title.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 28);
      a.download = `873oc_${safe || 'Look'}.webp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(dataOrHttpUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 유저 ID -> 핸들 & 프로필 사진 맵
  const handleByUserId = useMemo(() => {
    const map = new Map<string, string>();
    if (authUser) map.set(authUser.id, myHandle);
    communityUsers.forEach((u) => {
      if (u.id !== 'me') map.set(u.id, u.handle);
    });
    stylePosts.forEach((p) => {
      if (!map.has(p.userId)) map.set(p.userId, p.authorHandle);
    });
    return map;
  }, [authUser, myHandle, communityUsers, stylePosts]);

  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string>();
    if (authUser && myAvatarUrl) map.set(authUser.id, myAvatarUrl);
    communityUsers.forEach((u) => {
      if (u.id !== 'me' && u.avatarUrl) map.set(u.id, u.avatarUrl);
    });
    stylePosts.forEach((p) => {
      if (p.authorAvatar && !map.has(p.userId)) {
        map.set(p.userId, p.authorAvatar);
      }
    });
    return map;
  }, [authUser, myAvatarUrl, communityUsers, stylePosts]);

  const myUserId = authUser?.id ?? null;

  const myFollowerUsers = useMemo(() => {
    if (!myUserId) return [];
    return followEdges
      .filter((f) => f.followingId === myUserId)
      .map((f) => ({
        id: f.followerId,
        handle: handleByUserId.get(f.followerId) || '@873oc_user',
        avatarUrl: avatarByUserId.get(f.followerId),
      }));
  }, [followEdges, myUserId, handleByUserId, avatarByUserId]);

  const myFollowingUsers = useMemo(() => {
    if (!myUserId) return [];
    return followEdges
      .filter((f) => f.followerId === myUserId)
      .map((f) => ({
        id: f.followingId,
        handle: handleByUserId.get(f.followingId) || '@873oc_user',
        avatarUrl: avatarByUserId.get(f.followingId),
      }));
  }, [followEdges, myUserId, handleByUserId, avatarByUserId]);

  const myProfileObject: CommunityUser = useMemo(() => {
    const meComm = communityUsers.find((u) => u.id === 'me');
    return {
      id: 'me',
      handle: myHandle,
      avatarUrl: myAvatarUrl,
      bio: myBio,
      isPublic: true,
      isLiveCloudUser: Boolean(authUser),
      closet: wardrobe,
      proposals: meComm?.proposals || [],
    };
  }, [communityUsers, myHandle, myAvatarUrl, myBio, authUser, wardrobe]);

  const viewingProfileUser: CommunityUser | null = useMemo(() => {
    if (!viewingUserId) return null;
    const found = communityUsers.find((u) => u.id === viewingUserId);
    if (found) return found;
    return {
      id: viewingUserId,
      handle: handleByUserId.get(viewingUserId) || '@873oc_user',
      avatarUrl: avatarByUserId.get(viewingUserId) || '',
      bio: '옷장 아이템을 터치해 어울리는 코디를 제안해 주세요!',
      isPublic: true,
      closet: [],
      proposals: [],
    };
  }, [viewingUserId, communityUsers, handleByUserId, avatarByUserId]);

  const otherFollowerUsers = useMemo(() => {
    if (!viewingUserId) return [];
    return followEdges
      .filter((f) => f.followingId === viewingUserId)
      .map((f) => ({
        id: f.followerId,
        handle: handleByUserId.get(f.followerId) || '@873oc_user',
        avatarUrl: avatarByUserId.get(f.followerId),
      }));
  }, [followEdges, viewingUserId, handleByUserId, avatarByUserId]);

  const otherFollowingUsers = useMemo(() => {
    if (!viewingUserId) return [];
    return followEdges
      .filter((f) => f.followerId === viewingUserId)
      .map((f) => ({
        id: f.followingId,
        handle: handleByUserId.get(f.followingId) || '@873oc_user',
        avatarUrl: avatarByUserId.get(f.followingId),
      }));
  }, [followEdges, viewingUserId, handleByUserId, avatarByUserId]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-950">
      {/* HYPEBEAST × KREAM 초미니멀 헤더 (시스템 설정 버튼 완전 제거 · 프로필 사진 표시) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#F2F2F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setCurrentTab('home')}
            className="text-2xl font-black tracking-tighter text-zinc-950 cursor-pointer shrink-0"
          >
            873oc
          </button>

          <nav className="flex items-center gap-5 sm:gap-8 h-full">
            {(
              [
                { id: 'home' as MainTab, label: 'HOME' },
                { id: 'style' as MainTab, label: 'STYLE' },
                { id: 'studio' as MainTab, label: 'STUDIO' },
                { id: 'my' as MainTab, label: 'MY' },
              ] as const
            ).map((nav) => {
              const active =
                currentTab === nav.id ||
                (currentTab === 'user_profile' && nav.id === 'style');
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setCurrentTab(nav.id)}
                  className={`h-full inline-flex items-center text-xs sm:text-sm tracking-tight transition relative cursor-pointer ${
                    active
                      ? 'font-extrabold text-zinc-950 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-zinc-950'
                      : 'font-medium text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  {nav.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              title="내 옷장에 의류 추가"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-900 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> 옷장 추가
            </button>

            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                authUser
                  ? 'bg-[#F4F4F5] text-zinc-900 hover:bg-zinc-200'
                  : 'bg-zinc-950 text-white hover:bg-zinc-800'
              }`}
            >
              {authUser && myAvatarUrl && (
                <img
                  referrerPolicy="no-referrer"
                  src={myAvatarUrl}
                  alt={myHandle}
                  className="w-4 h-4 rounded-full object-cover bg-white"
                />
              )}
              <span>{authUser ? myHandle : '로그인'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 본문 영역 */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {currentTab === 'home' && (
          <NewsletterHomeSection
            articles={newsArticles}
            isLoading={isLoadingNews}
            onRefresh={() => fetchNewsletterFeed(true)}
            bookmarkedIds={bookmarkedNewsIds}
            onToggleBookmark={(id) =>
              setBookmarkedNewsIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            activeArticle={activeArticle}
            articleDetail={articleDetail}
            isLoadingDetail={isLoadingArticleDetail}
            onOpenArticle={handleOpenArticle}
            onCloseArticle={() => {
              setActiveArticle(null);
              setArticleDetail(null);
            }}
          />
        )}

        {currentTab === 'style' && (
          <StyleFeedSection
            posts={stylePosts}
            myUserId={myUserId}
            myHandle={myHandle}
            myAvatarUrl={myAvatarUrl}
            myWardrobe={wardrobe}
            followingIds={myFollowingUsers.map((u) => u.id)}
            communityUsers={communityUsers}
            avatarByUserId={avatarByUserId}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenClothUpload={() => setUploadModalOpen(true)}
            onVisitUserProfile={handleVisitUserProfile}
            onToggleFollow={handleToggleFollow}
            onToggleLikePost={handleToggleLikePost}
            onSubmitComment={handleSubmitComment}
            onDeleteComment={handleDeleteComment}
            onDeletePost={handleDeleteStylePost}
            onCreateStylePost={handleCreateStylePost}
          />
        )}

        {currentTab === 'studio' && (
          <StudioSection
            wardrobe={wardrobe}
            selectedClothIds={selectedClothIds}
            onToggleCloth={toggleTouchCloth}
            onAutoPickOutfit={() => {
              autoTouchSelectOutfit();
            }}
            onClearSelection={() => setSelectedClothIds([])}
            selectedGenre={selectedGenre}
            onSelectGenre={setSelectedGenre}
            activeDetails={activeDetails}
            onToggleDetail={(det) =>
              setActiveDetails((prev) =>
                prev.includes(det)
                  ? prev.filter((x) => x !== det)
                  : [...prev, det]
              )
            }
            customDetailNote={customDetailNote}
            onChangeCustomDetailNote={setCustomDetailNote}
            lookbookConcept={lookbookConcept}
            onSelectConcept={setLookbookConcept}
            lookbookFitTarget={lookbookFitTarget}
            onSelectFitTarget={setLookbookFitTarget}
            userTryOnPhoto={userTryOnPhoto}
            userTryOnInfo={userTryOnInfo}
            onUploadTryOnPhoto={handleUserTryOnPhotoUpload}
            onClearTryOnPhoto={() => {
              setUserTryOnPhoto('');
              setUserTryOnInfo('');
            }}
            autoShootLookbook={autoShootLookbook}
            onToggleAutoShoot={setAutoShootLookbook}
            isGenerating={isGenerating}
            isGeneratingLookbook={isGeneratingLookbook}
            stylistResult={stylistResult}
            lookbookStatusHint={lookbookStatusHint}
            isSavingLookbook={isSavingLookbook}
            onGenerateAIOutfit={generateAIOutfit}
            onShootLookbookPhoto={() => generateLookbookPhoto()}
            onSaveLookbook={handleSaveCurrentLook}
            onDownloadImage={downloadImage}
            onZoomImage={setZoomImageUrl}
            onOpenClothUpload={() => setUploadModalOpen(true)}
          />
        )}

        {currentTab === 'my' && (
          <ProfileAndClosetSection
            mode="my"
            profileUser={myProfileObject}
            myUserId={myUserId}
            isLoggedIn={Boolean(authUser)}
            userPosts={stylePosts.filter((p) =>
              myUserId ? p.userId === myUserId : p.authorHandle === myHandle
            )}
            followerUsers={myFollowerUsers}
            followingUsers={myFollowingUsers}
            avatarByUserId={avatarByUserId}
            isFollowingTarget={false}
            mySubTab={mySubTab}
            onChangeMySubTab={setMySubTab}
            selectedClothIds={selectedClothIds}
            onToggleSelectClothForStudio={toggleTouchCloth}
            onGoToStudioWithSelected={() => setCurrentTab('studio')}
            onOpenUploadCloth={() => setUploadModalOpen(true)}
            onOpenEditCloth={openEditClothModal}
            onDeleteCloth={deleteCloth}
            savedLooks={savedLooks}
            onDeleteSavedLook={handleDeleteSavedLook}
            onZoomImage={setZoomImageUrl}
            onUpdateMyProfile={handleUpdateMyProfile}
            onOpenAuth={() => setAuthModalOpen(true)}
            onDeleteMyPost={handleDeleteStylePost}
            otherSubTab={otherSubTab}
            onChangeOtherSubTab={setOtherSubTab}
            onBackFromOtherProfile={() => setCurrentTab('style')}
            onToggleFollowTarget={() => {}}
            onVisitUserProfile={handleVisitUserProfile}
            onSubmitProposalToUser={handleSubmitProposalToUser}
            onToggleLikeProposal={handleToggleLikeProposal}
            onAddProposalReply={handleAddProposalReply}
            onDeleteProposalReply={handleDeleteProposalReply}
            onDeleteProposal={handleDeleteProposal}
            onAdoptProposalToSaved={handleAdoptProposalToSaved}
          />
        )}

        {currentTab === 'user_profile' && viewingProfileUser && (
          <ProfileAndClosetSection
            mode="other"
            profileUser={viewingProfileUser}
            myUserId={myUserId}
            isLoggedIn={Boolean(authUser)}
            userPosts={stylePosts.filter(
              (p) => p.userId === viewingProfileUser.id
            )}
            followerUsers={otherFollowerUsers}
            followingUsers={otherFollowingUsers}
            avatarByUserId={avatarByUserId}
            isFollowingTarget={Boolean(
              myUserId &&
                followEdges.some(
                  (f) =>
                    f.followerId === myUserId &&
                    f.followingId === viewingProfileUser.id
                )
            )}
            mySubTab={mySubTab}
            onChangeMySubTab={setMySubTab}
            selectedClothIds={selectedClothIds}
            onToggleSelectClothForStudio={toggleTouchCloth}
            onGoToStudioWithSelected={() => setCurrentTab('studio')}
            onOpenUploadCloth={() => setUploadModalOpen(true)}
            onOpenEditCloth={openEditClothModal}
            onDeleteCloth={deleteCloth}
            savedLooks={savedLooks}
            onDeleteSavedLook={handleDeleteSavedLook}
            onZoomImage={setZoomImageUrl}
            onUpdateMyProfile={handleUpdateMyProfile}
            onOpenAuth={() => setAuthModalOpen(true)}
            onDeleteMyPost={handleDeleteStylePost}
            otherSubTab={otherSubTab}
            onChangeOtherSubTab={setOtherSubTab}
            onBackFromOtherProfile={() =>
              setCurrentTab(
                previousTab === 'user_profile' ? 'style' : previousTab
              )
            }
            onToggleFollowTarget={() =>
              handleToggleFollow(viewingProfileUser.id)
            }
            onVisitUserProfile={handleVisitUserProfile}
            onSubmitProposalToUser={handleSubmitProposalToUser}
            onToggleLikeProposal={handleToggleLikeProposal}
            onAddProposalReply={handleAddProposalReply}
            onDeleteProposalReply={handleDeleteProposalReply}
            onDeleteProposal={handleDeleteProposal}
            onAdoptProposalToSaved={handleAdoptProposalToSaved}
          />
        )}
      </main>

      {/* 심플 푸터 */}
      <footer className="py-10 px-4 sm:px-6 text-xs text-zinc-400 border-t border-[#F4F4F5]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-semibold text-zinc-500">
            © 2026 873oc · Fashion Editorial, Style Archive & Digital Closet
          </p>
          <div className="flex items-center gap-5">
            <a href="/privacy" className="hover:text-zinc-950 font-medium">
              개인정보처리방침
            </a>
            <a href="/terms" className="hover:text-zinc-950 font-medium">
              서비스 이용약관
            </a>
          </div>
        </div>
      </footer>

      {/* 공통 모달 */}
      <AppModals
        authModalOpen={authModalOpen}
        onCloseAuthModal={() => setAuthModalOpen(false)}
        authUser={authUser}
        myHandle={myHandle}
        myAvatarUrl={myAvatarUrl}
        authMode={authMode}
        onChangeAuthMode={setAuthMode}
        authEmail={authEmail}
        onChangeAuthEmail={setAuthEmail}
        authPassword={authPassword}
        onChangeAuthPassword={setAuthPassword}
        authNickname={authNickname}
        onChangeAuthNickname={setAuthNickname}
        authLoading={authLoading}
        authMessage={authMessage}
        onEmailAuthSubmit={handleEmailAuth}
        onOAuthLogin={handleOAuthLogin}
        onSignOut={handleSignOut}
        uploadModalOpen={uploadModalOpen}
        onCloseUploadModal={() => {
          setUploadModalOpen(false);
          setUrlPreview(null);
          setShopUrlInput('');
        }}
        uploadMethod={uploadMethod}
        onChangeUploadMethod={setUploadMethod}
        photoName={photoName}
        onChangePhotoName={setPhotoName}
        photoCategory={photoCategory}
        onChangePhotoCategory={setPhotoCategory}
        photoSeason={photoSeason}
        onChangePhotoSeason={setPhotoSeason}
        photoStatus={photoStatus}
        onChangePhotoStatus={setPhotoStatus}
        photoDataUrl={photoDataUrl}
        photoCompressInfo={photoCompressInfo}
        photoSideInput={photoSideInput}
        onChangePhotoSideInput={setPhotoSideInput}
        photoSourceUrlInput={photoSourceUrlInput}
        onChangePhotoSourceUrlInput={setPhotoSourceUrlInput}
        isUploadingCloth={isUploadingCloth}
        onPhotoFileChange={handlePhotoFileChange}
        onClothUploadSubmit={handleClothUploadSubmit}
        shopUrlInput={shopUrlInput}
        onChangeShopUrlInput={setShopUrlInput}
        isFetchingUrl={isFetchingUrl}
        urlPreview={urlPreview}
        onUpdateUrlPreview={setUrlPreview}
        urlStatus={urlStatus}
        onChangeUrlStatus={setUrlStatus}
        onFetchUrlMetadata={fetchUrlMetadata}
        onSelectUrlGalleryThumb={handleSelectUrlGalleryThumb}
        onUrlCustomPhotoChange={handleUrlCustomPhotoChange}
        onConfirmUrlClothUpload={confirmUrlClothUpload}
        editingCloth={editingCloth}
        onCloseEditCloth={() => setEditingCloth(null)}
        editClothName={editClothName}
        onChangeEditClothName={setEditClothName}
        editClothCategory={editClothCategory}
        onChangeEditClothCategory={setEditClothCategory}
        editClothSeason={editClothSeason}
        onChangeEditClothSeason={setEditClothSeason}
        editClothStatus={editClothStatus}
        onChangeEditClothStatus={setEditClothStatus}
        editClothSourceUrl={editClothSourceUrl}
        onChangeEditClothSourceUrl={setEditClothSourceUrl}
        editClothPhotoSide={editClothPhotoSide}
        onChangeEditClothPhotoSide={setEditClothPhotoSide}
        editClothExtraImages={editClothExtraImages}
        onRemoveEditExtraImage={(idx) =>
          setEditClothExtraImages((prev) => prev.filter((_, i) => i !== idx))
        }
        isUploadingExtraAngle={isUploadingExtraAngle}
        onUploadExtraAngleInEdit={handleUploadExtraAngleInEdit}
        isSavingClothEdit={isSavingClothEdit}
        onSaveClothEdit={handleSaveClothEdit}
        zoomImageUrl={zoomImageUrl}
        onCloseZoomImage={() => setZoomImageUrl('')}
        onDownloadImage={downloadImage}
      />

      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="px-4 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold shadow-lg animate-fade-soft"
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
