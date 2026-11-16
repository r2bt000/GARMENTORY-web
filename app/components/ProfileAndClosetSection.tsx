'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Camera,
  Check,
  ExternalLink,
  Heart,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  type CategoryType,
  type ClothItem,
  type CommunityUser,
  type MyProfileSubTab,
  type OtherProfileSubTab,
  type Proposal,
  type ProposalReply,
  type SavedLook,
  type StylePost,
} from '../lib/socialConstants';

interface ProfileAndClosetProps {
  mode: 'my' | 'other';
  profileUser: CommunityUser;
  myUserId: string | null;
  isLoggedIn: boolean;
  userPosts: StylePost[];
  followerUsers: { id: string; handle: string; avatarUrl?: string }[];
  followingUsers: { id: string; handle: string; avatarUrl?: string }[];
  avatarByUserId: Map<string, string>;
  isFollowingTarget: boolean;
  // My profile exclusive props
  mySubTab: MyProfileSubTab;
  onChangeMySubTab: (tab: MyProfileSubTab) => void;
  selectedClothIds: number[];
  onToggleSelectClothForStudio: (id: number) => void;
  onGoToStudioWithSelected: () => void;
  onOpenUploadCloth: () => void;
  onOpenEditCloth: (item: ClothItem) => void;
  onDeleteCloth: (id: number) => void;
  savedLooks: SavedLook[];
  onDeleteSavedLook: (id: number) => void;
  onZoomImage: (url: string) => void;
  onUpdateMyProfile: (
    nextHandle: string,
    nextBio: string,
    avatarFile: File | null,
    removeAvatar: boolean
  ) => Promise<void>;
  onOpenAuth: () => void;
  onDeleteMyPost: (post: StylePost) => Promise<void>;
  // Other user profile & proposal props
  otherSubTab: OtherProfileSubTab;
  onChangeOtherSubTab: (tab: OtherProfileSubTab) => void;
  onBackFromOtherProfile: () => void;
  onToggleFollowTarget: () => void;
  onVisitUserProfile: (userId: string, handleHint?: string) => void;
  onSubmitProposalToUser: (
    targetUser: CommunityUser,
    pickedIds: number[],
    note: string
  ) => Promise<void>;
  onToggleLikeProposal: (targetUserId: string, prop: Proposal) => Promise<void>;
  onAddProposalReply: (
    targetUserId: string,
    prop: Proposal,
    replyText: string
  ) => Promise<void>;
  onDeleteProposalReply: (
    targetUserId: string,
    prop: Proposal,
    reply: ProposalReply
  ) => Promise<void>;
  onDeleteProposal: (targetUserId: string, prop: Proposal) => Promise<void>;
  onAdoptProposalToSaved: (prop: Proposal) => Promise<void>;
}

const CLOSET_FILTERS: (CategoryType | '전체' | '구매 예정')[] = [
  '전체',
  '아우터',
  '상의',
  '하의',
  '신발',
  '악세사리',
  '구매 예정',
];

const FOLLOW_BATCH_SIZE = 20;

function ProfileAvatar({
  avatarUrl,
  handle,
  sizeClass,
}: {
  avatarUrl?: string;
  handle: string;
  sizeClass: string;
}) {
  if (avatarUrl) {
    return (
      <img
        referrerPolicy="no-referrer"
        src={avatarUrl}
        alt={handle}
        className={`${sizeClass} rounded-full object-cover bg-[#F4F4F5] shrink-0`}
      />
    );
  }
  const initials =
    handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '87';
  return (
    <div
      className={`${sizeClass} rounded-full bg-zinc-950 text-white flex items-center justify-center font-black tracking-tight shrink-0 select-none`}
    >
      {initials}
    </div>
  );
}

export default function ProfileAndClosetSection({
  mode,
  profileUser,
  myUserId,
  isLoggedIn,
  userPosts,
  followerUsers,
  followingUsers,
  avatarByUserId,
  isFollowingTarget,
  mySubTab,
  onChangeMySubTab,
  selectedClothIds,
  onToggleSelectClothForStudio,
  onGoToStudioWithSelected,
  onOpenUploadCloth,
  onOpenEditCloth,
  onDeleteCloth,
  savedLooks,
  onDeleteSavedLook,
  onZoomImage,
  onUpdateMyProfile,
  onOpenAuth,
  onDeleteMyPost,
  otherSubTab,
  onChangeOtherSubTab,
  onBackFromOtherProfile,
  onToggleFollowTarget,
  onVisitUserProfile,
  onSubmitProposalToUser,
  onToggleLikeProposal,
  onAddProposalReply,
  onDeleteProposalReply,
  onDeleteProposal,
  onAdoptProposalToSaved,
}: ProfileAndClosetProps) {
  const [portalReady, setPortalReady] = useState<boolean>(false);
  const [closetFilter, setClosetFilter] =
    useState<CategoryType | '전체' | '구매 예정'>('전체');
  const [editProfileOpen, setEditProfileOpen] = useState<boolean>(false);
  const [handleDraft, setHandleDraft] = useState<string>(profileUser.handle);
  const [bioDraft, setBioDraft] = useState<string>(profileUser.bio);
  const [avatarDraftFile, setAvatarDraftFile] = useState<File | null>(null);
  const [avatarDraftPreview, setAvatarDraftPreview] = useState<string>(
    profileUser.avatarUrl || ''
  );
  const [removeAvatarFlag, setRemoveAvatarFlag] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // 팔로워 / 팔로잉 리스트 모달 (상단 고정 출발 + 무한 스크롤 + 무색 블러)
  const [followModalType, setFollowModalType] = useState<
    'followers' | 'following' | null
  >(null);
  const [visibleFollowCount, setVisibleFollowCount] =
    useState<number>(FOLLOW_BATCH_SIZE);
  const [followFilterQuery, setFollowFilterQuery] = useState<string>('');
  const followOverlayRef = useRef<HTMLDivElement | null>(null);
  const followSentinelRef = useRef<HTMLDivElement | null>(null);

  // 타 사용자 옷장 코디 제안 선택 상태
  const [proposalIds, setProposalIds] = useState<number[]>([]);
  const [proposalNote, setProposalNote] = useState<string>('');
  const [isSendingProposal, setIsSendingProposal] = useState<boolean>(false);

  // 코디 제안 답글 입력 상태 (제안 ID별 입력값)
  const [replyDraftMap, setReplyDraftMap] = useState<Record<string, string>>(
    {}
  );
  const [submittingReplyPropId, setSubmittingReplyPropId] = useState<
    string | null
  >(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const rawFollowList =
    followModalType === 'followers' ? followerUsers : followingUsers;

  const filteredFollowList = useMemo(() => {
    const q = followFilterQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return rawFollowList;
    return rawFollowList.filter((u) =>
      u.handle.toLowerCase().replace(/^@/, '').includes(q)
    );
  }, [rawFollowList, followFilterQuery]);

  const visibleFollowList = useMemo(
    () => filteredFollowList.slice(0, visibleFollowCount),
    [filteredFollowList, visibleFollowCount]
  );

  // 모달 열릴 때 항상 화면 최상단부터 시작 + 배경 페이지 스크롤 잠금
  useEffect(() => {
    if (!followModalType) return;
    setVisibleFollowCount(FOLLOW_BATCH_SIZE);
    setFollowFilterQuery('');
    if (followOverlayRef.current) {
      followOverlayRef.current.scrollTop = 0;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setFollowModalType(null);
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [followModalType]);

  useEffect(() => {
    setVisibleFollowCount(FOLLOW_BATCH_SIZE);
  }, [followFilterQuery]);

  // IntersectionObserver 기반 자동 무한 스크롤
  useEffect(() => {
    if (!followModalType) return;
    const sentinel = followSentinelRef.current;
    if (!sentinel) return;
    if (visibleFollowCount >= filteredFollowList.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleFollowCount((prev) =>
            Math.min(prev + FOLLOW_BATCH_SIZE, filteredFollowList.length)
          );
        }
      },
      {
        root: followOverlayRef.current,
        rootMargin: '200px',
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [followModalType, visibleFollowCount, filteredFollowList.length]);

  const handleFollowOverlayScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (
      visibleFollowCount < filteredFollowList.length &&
      el.scrollTop + el.clientHeight >= el.scrollHeight - 200
    ) {
      setVisibleFollowCount((prev) =>
        Math.min(prev + FOLLOW_BATCH_SIZE, filteredFollowList.length)
      );
    }
  };

  const filteredCloset = profileUser.closet.filter((item) => {
    if (closetFilter === '전체') return true;
    if (closetFilter === '구매 예정') return item.status === '구매 예정';
    return item.category === closetFilter;
  });

  const toggleOtherClosetPick = (itemId: number) => {
    setProposalIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : prev.length >= 5
        ? prev
        : [...prev, itemId]
    );
  };

  const handleSendProposalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proposalIds.length < 2 || isSendingProposal) return;
    setIsSendingProposal(true);
    try {
      await onSubmitProposalToUser(profileUser, proposalIds, proposalNote);
      setProposalIds([]);
      setProposalNote('');
    } finally {
      setIsSendingProposal(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarDraftFile(f);
    setRemoveAvatarFlag(false);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarDraftPreview(String(reader.result || ''));
    };
    reader.readAsDataURL(f);
  };

  const handleSaveProfileForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      await onUpdateMyProfile(
        handleDraft,
        bioDraft,
        avatarDraftFile,
        removeAvatarFlag
      );
      setAvatarDraftFile(null);
      setRemoveAvatarFlag(false);
      setEditProfileOpen(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, prop: Proposal) => {
    e.preventDefault();
    const txt = (replyDraftMap[prop.id] || '').trim();
    if (!txt || submittingReplyPropId) return;
    setSubmittingReplyPropId(prop.id);
    try {
      await onAddProposalReply(profileUser.id, prop, txt);
      setReplyDraftMap((prev) => ({ ...prev, [prop.id]: '' }));
    } finally {
      setSubmittingReplyPropId(null);
    }
  };

  const activePostsView =
    (mode === 'my' && mySubTab === 'posts') ||
    (mode === 'other' && otherSubTab === 'posts');
  const activeClosetView =
    (mode === 'my' && mySubTab === 'closet') ||
    (mode === 'other' && otherSubTab === 'closet');
  const activeProposalsView =
    (mode === 'my' && mySubTab === 'proposals') ||
    (mode === 'other' && otherSubTab === 'proposals');
  const activeSavedView = mode === 'my' && mySubTab === 'saved';

  const validSelectedStudioCount = profileUser.closet.filter((c) =>
    selectedClothIds.includes(c.id)
  ).length;

  return (
    <section className="space-y-9 animate-fade-soft">
      {/* 타 사용자 프로필 방문 시 상단 뒤로가기 */}
      {mode === 'other' && (
        <div>
          <button
            type="button"
            onClick={onBackFromOtherProfile}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-950 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> 이전 화면으로 돌아가기
          </button>
        </div>
      )}

      {/* 1. 프로필 헤더 (프로필 사진 · 게시물 수 · 팔로워 · 팔로잉 · 옷장) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-[#F1F1F3]">
        <div className="flex items-start sm:items-center gap-5">
          <ProfileAvatar
            avatarUrl={profileUser.avatarUrl}
            handle={profileUser.handle}
            sizeClass="w-16 h-16 sm:w-20 sm:h-20 text-xl sm:text-2xl"
          />

          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-950">
                {profileUser.handle}
              </h2>

              {mode === 'my' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLoggedIn) {
                        onOpenAuth();
                        return;
                      }
                      setHandleDraft(profileUser.handle);
                      setBioDraft(profileUser.bio);
                      setAvatarDraftFile(null);
                      setRemoveAvatarFlag(false);
                      setAvatarDraftPreview(profileUser.avatarUrl || '');
                      setEditProfileOpen((v) => !v);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-800 transition cursor-pointer"
                  >
                    프로필 편집
                  </button>
                  {!isLoggedIn && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="px-3.5 py-1.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition cursor-pointer"
                    >
                      로그인
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={onToggleFollowTarget}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    isFollowingTarget
                      ? 'bg-[#F4F4F5] text-zinc-800 hover:bg-zinc-200'
                      : 'bg-zinc-950 text-white hover:bg-zinc-800'
                  }`}
                >
                  {isFollowingTarget ? '팔로잉 ✓' : '팔로우'}
                </button>
              )}
            </div>

            {/* 핵심 지표 4종: 게시물 · 팔로워 · 팔로잉 · 옷장 */}
            <div className="flex items-center gap-5 sm:gap-7 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() =>
                  mode === 'my'
                    ? onChangeMySubTab('posts')
                    : onChangeOtherSubTab('posts')
                }
                className="inline-flex items-center gap-1.5 hover:opacity-70 cursor-pointer"
              >
                <span className="text-zinc-400 font-medium">게시물</span>
                <strong className="font-extrabold text-zinc-950 tabular-nums">
                  {userPosts.length}
                </strong>
              </button>

              <button
                type="button"
                onClick={() => setFollowModalType('followers')}
                className="inline-flex items-center gap-1.5 hover:opacity-70 cursor-pointer"
              >
                <span className="text-zinc-400 font-medium">팔로워</span>
                <strong className="font-extrabold text-zinc-950 tabular-nums">
                  {followerUsers.length}
                </strong>
              </button>

              <button
                type="button"
                onClick={() => setFollowModalType('following')}
                className="inline-flex items-center gap-1.5 hover:opacity-70 cursor-pointer"
              >
                <span className="text-zinc-400 font-medium">팔로잉</span>
                <strong className="font-extrabold text-zinc-950 tabular-nums">
                  {followingUsers.length}
                </strong>
              </button>

              <button
                type="button"
                onClick={() =>
                  mode === 'my'
                    ? onChangeMySubTab('closet')
                    : onChangeOtherSubTab('closet')
                }
                className="inline-flex items-center gap-1.5 hover:opacity-70 cursor-pointer"
              >
                <span className="text-zinc-400 font-medium">옷장</span>
                <strong className="font-extrabold text-zinc-950 tabular-nums">
                  {profileUser.closet.length}
                </strong>
              </button>
            </div>

            <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
              {profileUser.bio ||
                '옷장 아이템을 터치해 어울리는 코디를 자유롭게 조합해 보세요.'}
            </p>
          </div>
        </div>

        {/* 마이페이지 우측 빠른 액션 */}
        {mode === 'my' && (
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {validSelectedStudioCount > 0 && (
              <button
                type="button"
                onClick={onGoToStudioWithSelected}
                className="px-4 py-2.5 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-zinc-900 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> 스튜디오 코디 (
                {validSelectedStudioCount})
              </button>
            )}
            <button
              type="button"
              onClick={onOpenUploadCloth}
              className="px-4 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> 의류 등록
            </button>
          </div>
        )}
      </div>

      {/* 내 프로필 편집 패널 (프로필 사진 업로드 · 아이디 · 소개 수정) */}
      {mode === 'my' && editProfileOpen && (
        <form
          onSubmit={handleSaveProfileForm}
          className="rounded-3xl bg-[#F7F7F8] p-5 sm:p-6 space-y-5 max-w-xl animate-fade-soft"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-zinc-950">
              프로필 사진 및 정보 편집
            </p>
            <button
              type="button"
              onClick={() => setEditProfileOpen(false)}
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-900 cursor-pointer"
            >
              닫기
            </button>
          </div>

          {/* 프로필 사진 선택 영역 */}
          <div className="flex items-center gap-4">
            <ProfileAvatar
              avatarUrl={removeAvatarFlag ? '' : avatarDraftPreview}
              handle={handleDraft || profileUser.handle}
              sizeClass="w-16 h-16 text-lg"
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="px-3.5 py-1.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 inline-flex items-center gap-1.5 cursor-pointer">
                  <Camera className="w-3.5 h-3.5" /> 프로필 사진 변경
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
                {(avatarDraftPreview || profileUser.avatarUrl) &&
                  !removeAvatarFlag && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarDraftFile(null);
                        setAvatarDraftPreview('');
                        setRemoveAvatarFlag(true);
                      }}
                      className="px-3 py-1.5 rounded-full bg-white text-xs font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer"
                    >
                      기본 아이콘으로
                    </button>
                  )}
              </div>
              <p className="text-[11px] text-zinc-400">
                정사각형 비율로 자동 크롭 및 WebP 경량화되어 저장됩니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                프로필 아이디 (@핸들)
              </label>
              <input
                type="text"
                value={handleDraft}
                onChange={(e) => setHandleDraft(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white text-xs font-bold text-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                한 줄 소개 · 코디 요청 메시지
              </label>
              <input
                type="text"
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white text-xs text-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditProfileOpen(false)}
              className="px-4 py-2 rounded-full bg-white text-xs font-bold text-zinc-600 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isSavingProfile ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        </form>
      )}

      {/* 2. 프로필 하단 서브 탭 바 */}
      <div className="flex items-center gap-7 overflow-x-auto no-scrollbar border-b border-[#F1F1F3]">
        {mode === 'my' ? (
          <>
            {(
              [
                {
                  id: 'posts' as MyProfileSubTab,
                  label: `게시물 ${userPosts.length}`,
                },
                {
                  id: 'closet' as MyProfileSubTab,
                  label: `옷장 ${profileUser.closet.length}`,
                },
                {
                  id: 'saved' as MyProfileSubTab,
                  label: `저장된 룩북 ${savedLooks.length}`,
                },
                {
                  id: 'proposals' as MyProfileSubTab,
                  label: `받은 코디 제안 ${profileUser.proposals.length}`,
                },
              ] as const
            ).map((t) => {
              const active = mySubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeMySubTab(t.id)}
                  className={`pb-3.5 text-sm whitespace-nowrap transition relative cursor-pointer ${
                    active
                      ? 'font-extrabold text-zinc-950 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-zinc-950'
                      : 'font-medium text-zinc-400 hover:text-zinc-800'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </>
        ) : (
          <>
            {(
              [
                {
                  id: 'closet' as OtherProfileSubTab,
                  label: `옷장 · 코디 제안하기 ${profileUser.closet.length}`,
                },
                {
                  id: 'posts' as OtherProfileSubTab,
                  label: `게시물 ${userPosts.length}`,
                },
                {
                  id: 'proposals' as OtherProfileSubTab,
                  label: `받은 코디 제안 ${profileUser.proposals.length}`,
                },
              ] as const
            ).map((t) => {
              const active = otherSubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeOtherSubTab(t.id)}
                  className={`pb-3.5 text-sm whitespace-nowrap transition relative cursor-pointer ${
                    active
                      ? 'font-extrabold text-zinc-950 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-zinc-950'
                      : 'font-medium text-zinc-400 hover:text-zinc-800'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* 3A. 게시물 서브 뷰 */}
      {activePostsView && (
        <div>
          {userPosts.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-sm font-semibold text-zinc-400">
                {mode === 'my'
                  ? '아직 올린 STYLE 게시물이 없습니다. 상단 STYLE 탭에서 첫 착샷을 공유해 보세요!'
                  : '아직 등록된 게시물이 없습니다.'}
              </p>
              {mode === 'my' && profileUser.closet.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeMySubTab('closet')}
                  className="px-4 py-2 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-900 cursor-pointer"
                >
                  내 옷장 아이템({profileUser.closet.length}벌) 보러가기 →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
              {userPosts.map((p) => (
                <div key={p.id} className="space-y-2 group">
                  <div
                    onClick={() => onZoomImage(p.imageUrl)}
                    className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#F4F4F5] cursor-zoom-in"
                  >
                    <img
                      referrerPolicy="no-referrer"
                      src={p.imageUrl}
                      alt={p.caption || p.authorHandle}
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                    {mode === 'my' && myUserId && p.userId === myUserId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteMyPost(p);
                        }}
                        title="게시물 삭제"
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 px-0.5">
                    <span className="truncate text-zinc-700 font-medium">
                      {p.caption || '데일리 스타일'}
                    </span>
                    <div className="shrink-0 flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {p.likeUserIds.length}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />{' '}
                        {p.comments.length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3B. 옷장 서브 뷰 */}
      {activeClosetView && (
        <div className="space-y-6">
          {mode === 'other' && (
            <form
              onSubmit={handleSendProposalForm}
              className="rounded-3xl bg-[#F7F7F8] p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-zinc-950">
                    {profileUser.handle} 님의 옷장으로 코디 조합 제안하기
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    아래 옷장 카드를 2벌 이상 터치해 고른 뒤 한 줄 코멘트와 함께 코디 제안을 보내보세요.
                  </p>
                </div>
                {proposalIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setProposalIds([])}
                    className="text-xs font-semibold text-zinc-400 hover:text-zinc-900 cursor-pointer"
                  >
                    선택 초기화 ({proposalIds.length})
                  </button>
                )}
              </div>

              {proposalIds.length > 0 && (
                <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                  {profileUser.closet
                    .filter((c) => proposalIds.includes(c.id))
                    .map((picked) => (
                      <div
                        key={picked.id}
                        onClick={() => toggleOtherClosetPick(picked.id)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white shrink-0 cursor-pointer"
                      >
                        <img
                          referrerPolicy="no-referrer"
                          src={picked.image}
                          alt={picked.name}
                          className="w-8 h-8 rounded-lg object-cover bg-[#F4F4F5]"
                        />
                        <span className="text-xs font-bold text-zinc-900 max-w-[120px] truncate">
                          {picked.name}
                        </span>
                        <X className="w-3 h-3 text-zinc-400" />
                      </div>
                    ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={proposalNote}
                  onChange={(e) => setProposalNote(e.target.value)}
                  placeholder="예: 이 쉘 자켓에 와이드 팬츠랑 슬립온 매치하면 깔끔해요!"
                  className="flex-1 px-4 py-2.5 rounded-full bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={proposalIds.length < 2 || isSendingProposal}
                  className="px-5 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-35 inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSendingProposal
                      ? '전송 중...'
                      : `코디 제안 보내기 (${proposalIds.length})`}
                  </span>
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {CLOSET_FILTERS.map((cat) => {
                const active = closetFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setClosetFilter(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white'
                        : 'bg-[#F4F4F5] text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {mode === 'my' && (
              <p className="text-[11px] text-zinc-400">
                카드를 터치하면 STUDIO 코디 슬롯에 담깁니다
              </p>
            )}
          </div>

          {filteredCloset.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-sm font-semibold text-zinc-400">
                {mode === 'my'
                  ? '등록된 의류가 없습니다. 직접 찍은 사진이나 무신사·KREAM 링크로 옷장을 채워보세요.'
                  : '아직 이 카테고리에 등록된 의류가 없습니다.'}
              </p>
              {mode === 'my' && (
                <button
                  type="button"
                  onClick={onOpenUploadCloth}
                  className="px-5 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold cursor-pointer"
                >
                  + 첫 의류 등록하기
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-9">
              {filteredCloset.map((item) => {
                const isSelected =
                  mode === 'my'
                    ? selectedClothIds.includes(item.id)
                    : proposalIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      mode === 'my'
                        ? onToggleSelectClothForStudio(item.id)
                        : toggleOtherClosetPick(item.id)
                    }
                    className="group cursor-pointer space-y-2.5 select-none"
                  >
                    <div
                      className={`relative aspect-square rounded-2xl overflow-hidden bg-[#F4F4F5] transition ${
                        isSelected ? 'ring-2 ring-zinc-950' : ''
                      }`}
                    >
                      <img
                        referrerPolicy="no-referrer"
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />

                      {isSelected && (
                        <span className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-zinc-950 text-white flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}

                      {item.photoSide === 'back' && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/65 text-white text-[9px] font-bold">
                          뒷면 사진
                        </span>
                      )}

                      {mode === 'my' && (
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenEditCloth(item);
                            }}
                            title="카테고리·정보 수정"
                            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-zinc-800 flex items-center justify-center shadow-sm cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCloth(item.id);
                            }}
                            title="삭제"
                            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-zinc-800 flex items-center justify-center shadow-sm cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 px-0.5">
                      <div className="flex items-center justify-between gap-1 text-[11px] text-zinc-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (mode === 'my') {
                              e.stopPropagation();
                              onOpenEditCloth(item);
                            }
                          }}
                          className={`font-bold text-zinc-800 ${
                            mode === 'my' ? 'hover:underline cursor-pointer' : ''
                          }`}
                        >
                          {item.category}
                        </button>
                        <span>
                          {item.status === '구매 예정' ? '위시' : item.season}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-zinc-950 truncate">
                        {item.name}
                      </p>

                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-900"
                        >
                          <span>원본 상품</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3C. 저장된 룩북 서브 뷰 */}
      {activeSavedView && (
        <div>
          {savedLooks.length === 0 ? (
            <div className="py-16 text-center text-sm font-semibold text-zinc-400">
              아직 STUDIO에서 저장한 코디 룩북이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {savedLooks.map((look) => (
                <div key={look.id} className="space-y-3">
                  {look.lookbookImage && (
                    <div
                      onClick={() => onZoomImage(look.lookbookImage || '')}
                      className="aspect-[3/4] rounded-2xl overflow-hidden bg-[#F4F4F5] cursor-zoom-in"
                    >
                      <img
                        referrerPolicy="no-referrer"
                        src={look.lookbookImage}
                        alt={look.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-zinc-400">
                        {look.genre} · {look.stylePresetLabel || '스튜디오 샷'}
                      </p>
                      <h4 className="text-sm font-extrabold text-zinc-950">
                        {look.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedLook(look.id)}
                      className="text-xs text-zinc-400 hover:text-zinc-950 cursor-pointer"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {look.items.slice(0, 4).map((it) => (
                      <img
                        key={it.id}
                        referrerPolicy="no-referrer"
                        src={it.image}
                        alt={it.name}
                        className="aspect-square rounded-xl object-cover bg-[#F4F4F5]"
                      />
                    ))}
                  </div>
                  {look.note && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      {look.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3D. 받은 코디 제안 서브 뷰 (1인 1회 하트 토글 + 답글 + 받은 코디 제안 삭제 버튼!) */}
      {activeProposalsView && (
        <div>
          {profileUser.proposals.length === 0 ? (
            <div className="py-16 text-center text-sm font-semibold text-zinc-400">
              아직 도착한 코디 제안이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profileUser.proposals.map((prop) => {
                const snapItems =
                  prop.itemsSnapshot && prop.itemsSnapshot.length > 0
                    ? prop.itemsSnapshot
                    : profileUser.closet.filter((c) =>
                        prop.itemIds.includes(c.id)
                      );
                const isLikedByMe = Boolean(
                  myUserId && prop.likedUserIds.includes(myUserId)
                );
                const propAvatar =
                  prop.proposerAvatar ||
                  (prop.proposerUserId
                    ? avatarByUserId.get(prop.proposerUserId)
                    : undefined);
                const canDeleteThisProposal = Boolean(
                  mode === 'my' ||
                    (myUserId && prop.proposerUserId === myUserId)
                );

                return (
                  <div
                    key={prop.id}
                    className="rounded-3xl bg-[#F7F7F8] p-5 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (prop.proposerUserId) {
                              onVisitUserProfile(
                                prop.proposerUserId,
                                prop.proposer
                              );
                            }
                          }}
                          className="inline-flex items-center gap-2 text-xs font-extrabold text-zinc-950 hover:opacity-75 cursor-pointer min-w-0"
                        >
                          <ProfileAvatar
                            avatarUrl={propAvatar}
                            handle={prop.proposer}
                            sizeClass="w-6 h-6 text-[10px]"
                          />
                          <span className="truncate">
                            {prop.proposer} 님의 코디 제안
                          </span>
                        </button>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] text-zinc-400">
                            {prop.createdAt}
                          </span>
                          {canDeleteThisProposal && (
                            <button
                              type="button"
                              onClick={() =>
                                void onDeleteProposal(profileUser.id, prop)
                              }
                              title="코디 제안 삭제"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white hover:bg-zinc-200/80 text-[11px] font-semibold text-zinc-500 hover:text-zinc-950 transition cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>삭제</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {snapItems.map((it) => (
                          <div key={it.id} className="space-y-1">
                            <img
                              referrerPolicy="no-referrer"
                              src={it.image}
                              alt={it.name}
                              className="aspect-square rounded-xl object-cover bg-[#F4F4F5]"
                            />
                            <p className="text-[10px] font-semibold text-zinc-700 truncate">
                              {it.name}
                            </p>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-zinc-700 leading-relaxed">
                        {prop.note}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleLikeProposal(profileUser.id, prop)
                          }
                          className={`px-3.5 py-1.5 rounded-full bg-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                            isLikedByMe
                              ? 'text-rose-500'
                              : 'text-zinc-700 hover:text-zinc-950'
                          }`}
                        >
                          <Heart
                            className="w-3.5 h-3.5"
                            fill={isLikedByMe ? 'currentColor' : 'none'}
                          />
                          <span className="tabular-nums">
                            공감 {prop.likes}
                          </span>
                        </button>

                        {mode === 'my' && (
                          <button
                            type="button"
                            onClick={() => onAdoptProposalToSaved(prop)}
                            className="px-3.5 py-1.5 rounded-full bg-zinc-950 text-white text-xs font-bold cursor-pointer"
                          >
                            내 룩북에 저장
                          </button>
                        )}
                      </div>

                      {/* 코디 제안 답글 목록 */}
                      {prop.replies.length > 0 && (
                        <div className="rounded-2xl bg-white p-3.5 space-y-2.5">
                          {prop.replies.map((rep) => {
                            const repAv =
                              rep.authorAvatar ||
                              avatarByUserId.get(rep.userId);
                            const isMine = Boolean(
                              myUserId && rep.userId === myUserId
                            );
                            return (
                              <div
                                key={rep.id}
                                className="flex items-start justify-between gap-2 text-xs"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <ProfileAvatar
                                    avatarUrl={repAv}
                                    handle={rep.authorHandle}
                                    sizeClass="w-5 h-5 text-[9px]"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-extrabold text-zinc-900 mr-1.5">
                                      {rep.authorHandle}
                                    </span>
                                    <span className="text-zinc-700 break-words">
                                      {rep.body}
                                    </span>
                                  </div>
                                </div>

                                {isMine && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDeleteProposalReply(
                                        profileUser.id,
                                        prop,
                                        rep
                                      )
                                    }
                                    className="text-[10px] text-zinc-400 hover:text-zinc-900 shrink-0 cursor-pointer"
                                  >
                                    삭제
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 코디 제안 간단 답글 입력창 */}
                    <form
                      onSubmit={(e) => handleReplySubmit(e, prop)}
                      className="flex items-center gap-2 pt-2 border-t border-zinc-200/60"
                    >
                      <input
                        type="text"
                        value={replyDraftMap[prop.id] || ''}
                        onChange={(e) =>
                          setReplyDraftMap((prev) => ({
                            ...prev,
                            [prop.id]: e.target.value,
                          }))
                        }
                        placeholder="코디 제안에 답글 남기기..."
                        onFocus={() => {
                          if (!myUserId) onOpenAuth();
                        }}
                        className="flex-1 px-3.5 py-2 rounded-full bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={
                          !(replyDraftMap[prop.id] || '').trim() ||
                          submittingReplyPropId === prop.id
                        }
                        className="w-8 h-8 rounded-full bg-zinc-950 text-white flex items-center justify-center disabled:opacity-30 cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 팔로워 / 팔로잉 유저 목록 모달 — document.body 포털로 화면 최상단부터 즉시 노출 + 무색 블러 + 무한 스크롤! */}
      {portalReady &&
        followModalType &&
        createPortal(
          <div
            ref={followOverlayRef}
            onScroll={handleFollowOverlayScroll}
            onClick={() => setFollowModalType(null)}
            className="fixed inset-0 z-[100] bg-transparent backdrop-blur-md overflow-y-auto overscroll-contain flex items-start justify-center pt-14 sm:pt-20 pb-16 px-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)] ring-1 ring-black/5 animate-fade-soft"
            >
              {/* 상단 고정 헤더: 팔로워 · 팔로잉 즉시 전환 및 닫기 */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm rounded-t-3xl px-6 pt-5 pb-3.5 border-b border-[#F4F4F5] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-5">
                    <button
                      type="button"
                      onClick={() => setFollowModalType('followers')}
                      className={`text-sm sm:text-base transition cursor-pointer ${
                        followModalType === 'followers'
                          ? 'font-extrabold text-zinc-950'
                          : 'font-semibold text-zinc-400 hover:text-zinc-800'
                      }`}
                    >
                      팔로워{' '}
                      <span className="tabular-nums">
                        {followerUsers.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFollowModalType('following')}
                      className={`text-sm sm:text-base transition cursor-pointer ${
                        followModalType === 'following'
                          ? 'font-extrabold text-zinc-950'
                          : 'font-semibold text-zinc-400 hover:text-zinc-800'
                      }`}
                    >
                      팔로잉{' '}
                      <span className="tabular-nums">
                        {followingUsers.length}
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFollowModalType(null)}
                    aria-label="목록 닫기"
                    className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {rawFollowList.length >= 6 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={followFilterQuery}
                      onChange={(e) => setFollowFilterQuery(e.target.value)}
                      placeholder="@아이디 검색"
                      className="w-full pl-9 pr-8 py-2 rounded-full bg-[#F4F4F5] text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                    />
                    {followFilterQuery && (
                      <button
                        type="button"
                        onClick={() => setFollowFilterQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 무한 스크롤 유저 목록 */}
              <div className="px-4 py-3">
                {filteredFollowList.length === 0 ? (
                  <p className="py-10 text-center text-xs text-zinc-400">
                    {followFilterQuery.trim()
                      ? `'${followFilterQuery}' 아이디와 일치하는 사용자가 없습니다.`
                      : followModalType === 'followers'
                      ? '아직 팔로워가 없습니다.'
                      : '아직 팔로우한 사용자가 없습니다.'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {visibleFollowList.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setFollowModalType(null);
                          onVisitUserProfile(u.id, u.handle);
                        }}
                        className="w-full p-2.5 rounded-2xl hover:bg-[#F7F7F8] flex items-center justify-between transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ProfileAvatar
                            avatarUrl={u.avatarUrl || avatarByUserId.get(u.id)}
                            handle={u.handle}
                            sizeClass="w-9 h-9 text-xs"
                          />
                          <span className="text-xs sm:text-[13px] font-bold text-zinc-900 truncate">
                            {u.handle}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-zinc-400 shrink-0 ml-2">
                          프로필 보기 →
                        </span>
                      </button>
                    ))}

                    {visibleFollowCount < filteredFollowList.length && (
                      <div
                        ref={followSentinelRef}
                        className="py-3 text-center text-[11px] text-zinc-400"
                      >
                        목록 불러오는 중...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
