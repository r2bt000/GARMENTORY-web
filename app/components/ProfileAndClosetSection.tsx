'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Heart,
  Pencil,
  Plus,
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
  type SavedLook,
  type StylePost,
} from '../lib/socialConstants';

interface ProfileAndClosetProps {
  mode: 'my' | 'other';
  profileUser: CommunityUser;
  myUserId: string | null;
  isLoggedIn: boolean;
  userPosts: StylePost[];
  followerUsers: { id: string; handle: string }[];
  followingUsers: { id: string; handle: string }[];
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
  onUpdateMyProfile: (nextHandle: string, nextBio: string) => Promise<void>;
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
  onLikeProposal: (targetUserId: string, prop: Proposal) => Promise<void>;
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

export default function ProfileAndClosetSection({
  mode,
  profileUser,
  myUserId,
  isLoggedIn,
  userPosts,
  followerUsers,
  followingUsers,
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
  onLikeProposal,
  onAdoptProposalToSaved,
}: ProfileAndClosetProps) {
  const [closetFilter, setClosetFilter] =
    useState<CategoryType | '전체' | '구매 예정'>('전체');
  const [editProfileOpen, setEditProfileOpen] = useState<boolean>(false);
  const [handleDraft, setHandleDraft] = useState<string>(profileUser.handle);
  const [bioDraft, setBioDraft] = useState<string>(profileUser.bio);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // 팔로워 / 팔로잉 리스트 모달
  const [followModalType, setFollowModalType] = useState<
    'followers' | 'following' | null
  >(null);

  // 타 사용자 옷장 코디 제안 선택 상태
  const [proposalIds, setProposalIds] = useState<number[]>([]);
  const [proposalNote, setProposalNote] = useState<string>('');
  const [isSendingProposal, setIsSendingProposal] = useState<boolean>(false);

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

  const handleSaveProfileForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      await onUpdateMyProfile(handleDraft, bioDraft);
      setEditProfileOpen(false);
    } finally {
      setIsSavingProfile(false);
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

      {/* 1. 인스타 × KREAM 감성 무테두리 프로필 헤더 (게시물 수 · 팔로워 · 팔로잉 · 옷장) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-[#F1F1F3]">
        <div className="flex items-start sm:items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-950 text-white flex items-center justify-center text-xl sm:text-2xl font-black tracking-tight shrink-0 select-none">
            {profileUser.handle.replace(/^@/, '').slice(0, 2).toUpperCase() ||
              '87'}
          </div>

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
                      setHandleDraft(profileUser.handle);
                      setBioDraft(profileUser.bio);
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
                      클라우드 로그인
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

      {/* 내 프로필 인라인 편집 패널 */}
      {mode === 'my' && editProfileOpen && (
        <form
          onSubmit={handleSaveProfileForm}
          className="rounded-2xl bg-[#F7F7F8] p-5 space-y-4 max-w-xl"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-zinc-900">
              프로필 아이디 및 소개 수정
            </p>
            <button
              type="button"
              onClick={() => setEditProfileOpen(false)}
              className="text-xs text-zinc-400 hover:text-zinc-900 cursor-pointer"
            >
              닫기
            </button>
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
                className="w-full px-3.5 py-2 rounded-xl bg-white text-xs font-bold text-zinc-900 focus:outline-none"
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
                className="w-full px-3.5 py-2 rounded-xl bg-white text-xs text-zinc-900 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isSavingProfile ? '저장 중...' : '프로필 저장'}
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
                { id: 'posts' as MyProfileSubTab, label: `게시물 ${userPosts.length}` },
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
                    <span className="shrink-0 inline-flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {p.likeUserIds.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3B. 옷장 서브 뷰 (마이페이지 내 옷장 OR 타 사용자 옷장에서 코디 제안하기!) */}
      {activeClosetView && (
        <div className="space-y-6">
          {/* 타 사용자 프로필일 때: 프로필 내 옷장에서 직접 코디 조합 제안하기 트레이 */}
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

          {/* 카테고리 필터 칩 */}
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

          {/* KREAM 상품 카드 스타일 무테두리 옷장 그리드 */}
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

      {/* 3C. 저장된 룩북 서브 뷰 (마이페이지) */}
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

      {/* 3D. 받은 코디 제안 서브 뷰 */}
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
                return (
                  <div
                    key={prop.id}
                    className="rounded-3xl bg-[#F7F7F8] p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
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
                        className="text-xs font-extrabold text-zinc-950 hover:underline cursor-pointer"
                      >
                        {prop.proposer} 님의 코디 제안
                      </button>
                      <span className="text-[11px] text-zinc-400">
                        {prop.createdAt}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {snapItems.map((it) => (
                        <div key={it.id} className="space-y-1">
                          <img
                            referrerPolicy="no-referrer"
                            src={it.image}
                            alt={it.name}
                            className="aspect-square rounded-xl object-cover bg-white"
                          />
                          <p className="text-[10px] font-semibold text-zinc-700 truncate">
                            {it.name}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {prop.note}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => onLikeProposal(profileUser.id, prop)}
                        className="px-3 py-1.5 rounded-full bg-white text-xs font-bold text-zinc-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Heart className="w-3.5 h-3.5" /> 공감 {prop.likes}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 팔로워 / 팔로잉 유저 목록 모달 */}
      {followModalType && (
        <div
          onClick={() => setFollowModalType(null)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-fade-soft"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-zinc-950">
                {followModalType === 'followers' ? '팔로워' : '팔로잉'}
              </h3>
              <button
                type="button"
                onClick={() => setFollowModalType(null)}
                className="w-8 h-8 rounded-full bg-[#F4F4F5] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(followModalType === 'followers'
              ? followerUsers
              : followingUsers
            ).length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">
                {followModalType === 'followers'
                  ? '아직 팔로워가 없습니다.'
                  : '아직 팔로우한 사용자가 없습니다.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(followModalType === 'followers'
                  ? followerUsers
                  : followingUsers
                ).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setFollowModalType(null);
                      onVisitUserProfile(u.id, u.handle);
                    }}
                    className="w-full p-2.5 rounded-2xl hover:bg-[#F7F7F8] flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-zinc-950 text-white text-xs font-bold flex items-center justify-center">
                        {u.handle.replace(/^@/, '').slice(0, 1).toUpperCase() ||
                          'U'}
                      </span>
                      <span className="text-xs font-bold text-zinc-900">
                        {u.handle}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      옷장 보기 →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
