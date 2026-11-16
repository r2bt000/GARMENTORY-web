'use client';

import React, { useState } from 'react';
import {
  Camera,
  Copy,
  ExternalLink,
  Heart,
  MessageCircle,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  type ClothItem,
  type CommunityUser,
  STYLE_HASH_PRESETS,
  type StylePost,
} from '../lib/socialConstants';

interface StyleFeedProps {
  posts: StylePost[];
  myUserId: string | null;
  myHandle: string;
  myWardrobe: ClothItem[];
  followingIds: string[];
  communityUsers: CommunityUser[];
  needsSocialSql: boolean;
  onCopySocialSql: () => void;
  onOpenAuth: () => void;
  onOpenClothUpload: () => void;
  onVisitUserProfile: (userId: string, handleHint?: string) => void;
  onToggleFollow: (targetUserId: string) => void;
  onToggleLikePost: (post: StylePost) => void;
  onSubmitComment: (post: StylePost, commentBody: string) => Promise<void>;
  onDeletePost: (post: StylePost) => Promise<void>;
  onCreateStylePost: (draft: {
    file: File;
    caption: string;
    styleTags: string[];
    taggedClothIds: number[];
  }) => Promise<boolean>;
}

export default function StyleFeedSection({
  posts,
  myUserId,
  myHandle,
  myWardrobe,
  followingIds,
  communityUsers,
  needsSocialSql,
  onCopySocialSql,
  onOpenAuth,
  onOpenClothUpload,
  onVisitUserProfile,
  onToggleFollow,
  onToggleLikePost,
  onSubmitComment,
  onDeletePost,
  onCreateStylePost,
}: StyleFeedProps) {
  const [selectedTag, setSelectedTag] = useState<string>('전체');
  const [userQuery, setUserQuery] = useState<string>('');
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] =
    useState<boolean>(false);

  // 새 STYLE 게시물 작성 모달 상태 (모델샷 제외, 실제 착샷 업로드 + 내 옷장 아이템 태그)
  const [uploadOpen, setUploadOpen] = useState<boolean>(false);
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreviewUrl, setPostPreviewUrl] = useState<string>('');
  const [postCaption, setPostCaption] = useState<string>('');
  const [postTags, setPostTags] = useState<string[]>(['#데일리룩']);
  const [taggedClothIds, setTaggedClothIds] = useState<number[]>([]);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const activePost = posts.find((p) => p.id === activePostId) || null;

  const cleanQuery = userQuery.trim().toLowerCase();

  const matchedUsers = communityUsers.filter((u) => {
    if (u.id === 'me') return false;
    if (!cleanQuery) return true;
    return (
      u.handle.toLowerCase().includes(cleanQuery) ||
      u.bio.toLowerCase().includes(cleanQuery)
    );
  });

  const filteredPosts = posts.filter((p) => {
    if (selectedTag === '팔로잉') {
      if (!myUserId) return false;
      if (!followingIds.includes(p.userId) && p.userId !== myUserId)
        return false;
    } else if (selectedTag !== '전체') {
      if (!p.styleTags.includes(selectedTag)) return false;
    }

    if (cleanQuery) {
      const hay = `${p.authorHandle} ${p.caption} ${p.styleTags.join(
        ' '
      )} ${p.taggedItems.map((t) => t.name).join(' ')}`.toLowerCase();
      return hay.includes(cleanQuery);
    }
    return true;
  });

  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPostFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      setPostPreviewUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(f);
  };

  const togglePostTagChip = (tag: string) => {
    setPostTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleTaggedCloth = (clothId: number) => {
    setTaggedClothIds((prev) =>
      prev.includes(clothId)
        ? prev.filter((id) => id !== clothId)
        : prev.length >= 6
        ? prev
        : [...prev, clothId]
    );
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postFile || isPublishing) return;
    setIsPublishing(true);
    try {
      const ok = await onCreateStylePost({
        file: postFile,
        caption: postCaption,
        styleTags: postTags,
        taggedClothIds,
      });
      if (ok) {
        setUploadOpen(false);
        setPostFile(null);
        setPostPreviewUrl('');
        setPostCaption('');
        setPostTags(['#데일리룩']);
        setTaggedClothIds([]);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCommentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePost || !commentInput.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      await onSubmitComment(activePost, commentInput.trim());
      setCommentInput('');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <section className="space-y-8 animate-fade-soft">
      {/* 상단 헤더 & 유저 검색 & + 스타일 올리기 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950">
            STYLE
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            데일리 착샷과 착용한 옷장 아이템을 공유하고, 아이디를 눌러 서로의 옷장을 구경해 보세요.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="@유저 아이디 · 아이템 · 태그 검색"
              className="w-full pl-9 pr-4 py-2.5 rounded-full bg-[#F4F4F5] text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!myUserId) {
                onOpenAuth();
                return;
              }
              setUploadOpen(true);
            }}
            className="px-4 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> 스타일 올리기
          </button>
        </div>
      </div>

      {/* 소셜 테이블 최초 1회 안내 배너 (테이블 미생성 시에만 노출) */}
      {needsSocialSql && (
        <div className="rounded-2xl bg-[#F7F7F8] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
          <span>
            모든 유저 간 실시간 STYLE 피드·좋아요·팔로우 동기화를 위해 Supabase SQL Editor에 소셜 테이블 SQL을 1회 실행해 주세요.
          </span>
          <button
            type="button"
            onClick={onCopySocialSql}
            className="px-3.5 py-1.5 rounded-full bg-zinc-950 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3 h-3" /> 소셜 SQL 복사
          </button>
        </div>
      )}

      {/* 탐색 가능한 873oc 멤버 스트립 (클릭 시 타 유저 프로필 → 옷장 코디 제안 이동!) */}
      {matchedUsers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            {cleanQuery ? '검색된 사용자 프로필' : '873oc 오픈 옷장 멤버'}
          </p>
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {matchedUsers.slice(0, 16).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onVisitUserProfile(u.id, u.handle)}
                className="px-3.5 py-2 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 transition inline-flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">
                  {u.handle.replace(/^@/, '').slice(0, 1).toUpperCase() || 'U'}
                </span>
                <span className="text-xs font-bold text-zinc-900">
                  {u.handle}
                </span>
                <span className="text-[11px] text-zinc-400">
                  옷장 {u.closet.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KREAM STYLE 감성 언더라인 필터 바 */}
      <div className="flex items-center gap-5 overflow-x-auto no-scrollbar border-b border-[#F1F1F3]">
        {['전체', '팔로잉', ...STYLE_HASH_PRESETS].map((tag) => {
          const active = selectedTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`pb-3 text-sm whitespace-nowrap transition relative cursor-pointer ${
                active
                  ? 'font-extrabold text-zinc-950 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-zinc-950'
                  : 'font-medium text-zinc-400 hover:text-zinc-800'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* STYLE 4열 무테두리 피드 그리드 */}
      {filteredPosts.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-sm font-semibold text-zinc-500">
            {selectedTag === '팔로잉'
              ? '팔로우한 사용자의 게시물이 아직 없습니다.'
              : '아직 등록된 스타일 게시물이 없습니다. 첫 번째 데일리 착샷을 올려보세요!'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (!myUserId) {
                onOpenAuth();
                return;
              }
              setUploadOpen(true);
            }}
            className="px-5 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition cursor-pointer"
          >
            + 첫 스타일 게시물 올리기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-9">
          {filteredPosts.map((post) => {
            const liked = Boolean(
              myUserId && post.likeUserIds.includes(myUserId)
            );
            const firstTagItem = post.taggedItems[0];
            return (
              <div key={post.id} className="space-y-2.5 group">
                <div
                  onClick={() => setActivePostId(post.id)}
                  className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#F4F4F5] cursor-pointer"
                >
                  <img
                    referrerPolicy="no-referrer"
                    src={post.imageUrl}
                    alt={post.caption || post.authorHandle}
                    loading="lazy"
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                  {post.taggedItems.length > 0 && (
                    <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-semibold backdrop-blur-sm">
                      상품 {post.taggedItems.length}
                    </span>
                  )}
                </div>

                {/* 작성자 프로필 클릭 시 타 사용자 프로필(또는 마이페이지)로 즉시 이동 */}
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      onVisitUserProfile(post.userId, post.authorHandle)
                    }
                    className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition cursor-pointer"
                  >
                    <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                      {post.authorHandle
                        .replace(/^@/, '')
                        .slice(0, 1)
                        .toUpperCase() || 'U'}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 truncate">
                      {post.authorHandle}
                    </span>
                  </button>

                  <div className="flex items-center gap-2.5 shrink-0 text-xs text-zinc-400">
                    <button
                      type="button"
                      onClick={() => onToggleLikePost(post)}
                      className={`inline-flex items-center gap-1 transition cursor-pointer ${
                        liked
                          ? 'text-zinc-950 font-bold'
                          : 'hover:text-zinc-800'
                      }`}
                    >
                      <Heart
                        className="w-3.5 h-3.5"
                        fill={liked ? 'currentColor' : 'none'}
                      />
                      <span>{post.likeUserIds.length}</span>
                    </button>
                    {post.comments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActivePostId(post.id)}
                        className="inline-flex items-center gap-1 hover:text-zinc-800 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{post.comments.length}</span>
                      </button>
                    )}
                  </div>
                </div>

                {post.caption && (
                  <p
                    onClick={() => setActivePostId(post.id)}
                    className="text-xs text-zinc-600 line-clamp-2 px-0.5 leading-relaxed cursor-pointer"
                  >
                    {post.caption}
                  </p>
                )}

                {/* KREAM STYLE 착용 아이템 미니 태그 카드 (테두리 없음) */}
                {firstTagItem && (
                  <div
                    onClick={() => setActivePostId(post.id)}
                    className="rounded-xl bg-[#F7F7F8] hover:bg-[#EFEFF1] transition p-2 flex items-center gap-2.5 cursor-pointer"
                  >
                    <img
                      referrerPolicy="no-referrer"
                      src={firstTagItem.image}
                      alt={firstTagItem.name}
                      className="w-9 h-9 rounded-lg object-cover bg-white shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-zinc-900 truncate">
                        {firstTagItem.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {firstTagItem.category}
                        {post.taggedItems.length > 1
                          ? ` 외 ${post.taggedItems.length - 1}개 착용`
                          : ''}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 새 STYLE 게시물 작성 모달 (실제 사진 업로드 + 내 옷장 아이템 태그) */}
      {uploadOpen && (
        <div
          onClick={() => setUploadOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 animate-fade-soft"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-950">
                  새 STYLE 게시물 올리기
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  직접 찍은 착샷 사진에 내 옷장 아이템을 착용 상품으로 태그해 보세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="space-y-5">
              {/* 1. 실제 착샷 사진 선택 */}
              <div>
                {postPreviewUrl ? (
                  <div className="relative aspect-[4/5] max-h-72 mx-auto rounded-2xl overflow-hidden bg-[#F4F4F5]">
                    <img
                      src={postPreviewUrl}
                      alt="업로드 미리보기"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPostFile(null);
                        setPostPreviewUrl('');
                      }}
                      className="absolute top-2.5 right-2.5 px-3 py-1 rounded-full bg-black/70 text-white text-[11px] font-bold cursor-pointer"
                    >
                      사진 변경
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-[4/3] rounded-2xl bg-[#F6F6F7] hover:bg-[#EFEFF1] transition cursor-pointer text-center p-6">
                    <Camera className="w-7 h-7 text-zinc-400 mb-2" />
                    <span className="text-xs font-bold text-zinc-900">
                      착샷 · 데일리 사진 선택하기
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-1">
                      클라우드 업로드 시 고화질 WebP로 자동 경량화됩니다
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={handlePickPhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 2. 캡션 & 스타일 해시태그 */}
              <div className="space-y-2.5">
                <textarea
                  rows={3}
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="오늘 착장에 대한 짧은 소개나 스타일링 포인트를 적어보세요..."
                  className="w-full rounded-2xl bg-[#F4F4F5] p-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                />

                <div className="flex flex-wrap gap-1.5">
                  {STYLE_HASH_PRESETS.map((tag) => {
                    const active = postTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => togglePostTagChip(tag)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                          active
                            ? 'bg-zinc-950 text-white'
                            : 'bg-[#F4F4F5] text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. KREAM STYLE 방식: 착용한 내 옷장 아이템 태그 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900">
                    착용한 내 옷장 아이템 태그 ({taggedClothIds.length}/6)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadOpen(false);
                      onOpenClothUpload();
                    }}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-950 cursor-pointer"
                  >
                    + 옷장에 새 옷 추가
                  </button>
                </div>

                {myWardrobe.length === 0 ? (
                  <div className="rounded-2xl bg-[#F7F7F8] p-4 text-center text-xs text-zinc-400">
                    아직 내 옷장에 등록된 아이템이 없습니다. 옷장에 아이템을 등록하면 게시물에 상품 태그를 달 수 있습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {myWardrobe.map((item) => {
                      const picked = taggedClothIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleTaggedCloth(item.id)}
                          className={`rounded-xl p-1.5 text-left transition cursor-pointer relative ${
                            picked
                              ? 'bg-zinc-950 text-white'
                              : 'bg-[#F6F6F7] text-zinc-900 hover:bg-[#ECECEE]'
                          }`}
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-white mb-1">
                            <img
                              referrerPolicy="no-referrer"
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] font-bold truncate">
                            {item.name}
                          </p>
                          <p
                            className={`text-[9px] ${
                              picked ? 'text-zinc-300' : 'text-zinc-400'
                            }`}
                          >
                            {item.category}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!postFile || isPublishing}
                className="w-full py-3.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-40 transition cursor-pointer"
              >
                {isPublishing
                  ? '피드에 업로드 중...'
                  : `${myHandle} 이름으로 게시하기`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STYLE 게시물 상세 모달 (착용 옷장 태그 + 작성자 프로필 이동 + 댓글) */}
      {activePost && (
        <div
          onClick={() => setActivePostId(null)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl grid grid-cols-1 md:grid-cols-12 overflow-hidden animate-fade-soft"
          >
            <div className="md:col-span-7 bg-[#F4F4F5] flex items-center justify-center max-h-[75vh]">
              <img
                referrerPolicy="no-referrer"
                src={activePost.imageUrl}
                alt={activePost.caption || activePost.authorHandle}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="md:col-span-5 p-5 sm:p-6 flex flex-col justify-between max-h-[82vh] overflow-y-auto space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePostId(null);
                      onVisitUserProfile(
                        activePost.userId,
                        activePost.authorHandle
                      );
                    }}
                    className="flex items-center gap-2 hover:opacity-75 transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-full bg-zinc-950 text-white text-xs font-bold flex items-center justify-center">
                      {activePost.authorHandle
                        .replace(/^@/, '')
                        .slice(0, 1)
                        .toUpperCase() || 'U'}
                    </span>
                    <div className="text-left">
                      <p className="text-xs font-extrabold text-zinc-950">
                        {activePost.authorHandle}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {activePost.createdAt} · 프로필 및 옷장 보기
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {myUserId && activePost.userId === myUserId ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeletePost(activePost);
                          setActivePostId(null);
                        }}
                        className="p-2 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-zinc-600 cursor-pointer"
                        title="게시물 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleFollow(activePost.userId)}
                        className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                          followingIds.includes(activePost.userId)
                            ? 'bg-[#F4F4F5] text-zinc-800'
                            : 'bg-zinc-950 text-white'
                        }`}
                      >
                        {followingIds.includes(activePost.userId)
                          ? '팔로잉'
                          : '팔로우'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActivePostId(null)}
                      className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {activePost.caption && (
                  <p className="text-xs sm:text-[13px] text-zinc-800 leading-relaxed">
                    {activePost.caption}
                  </p>
                )}

                {activePost.styleTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activePost.styleTags.map((tg) => (
                      <span
                        key={tg}
                        className="text-[11px] font-semibold text-zinc-400"
                      >
                        {tg}
                      </span>
                    ))}
                  </div>
                )}

                {/* 착용 상품 태그 리스트 */}
                {activePost.taggedItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-extrabold text-zinc-900">
                        착용 상품 {activePost.taggedItems.length}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActivePostId(null);
                          onVisitUserProfile(
                            activePost.userId,
                            activePost.authorHandle
                          );
                        }}
                        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-950 cursor-pointer"
                      >
                        옷장 전체 보기 →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {activePost.taggedItems.map((item, idx) => (
                        <div
                          key={`${item.id}_${idx}`}
                          className="rounded-2xl bg-[#F7F7F8] p-2.5 flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              referrerPolicy="no-referrer"
                              src={item.image}
                              alt={item.name}
                              className="w-11 h-11 rounded-xl object-cover bg-white shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-900 truncate">
                                {item.name}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {item.category}
                              </p>
                            </div>
                          </div>
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-full bg-white text-[10px] font-bold text-zinc-800 inline-flex items-center gap-1 shrink-0 hover:bg-zinc-100"
                            >
                              상품 <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 댓글 목록 */}
                <div className="space-y-2.5 pt-2 border-t border-[#F1F1F3]">
                  <p className="text-[11px] font-bold text-zinc-400">
                    댓글 {activePost.comments.length}
                  </p>
                  {activePost.comments.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-2">
                      첫 댓글을 남겨보세요.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {activePost.comments.map((cm) => (
                        <div key={cm.id} className="text-xs leading-relaxed">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePostId(null);
                              onVisitUserProfile(cm.userId, cm.authorHandle);
                            }}
                            className="font-extrabold text-zinc-900 mr-1.5 hover:underline cursor-pointer"
                          >
                            {cm.authorHandle}
                          </button>
                          <span className="text-zinc-700">{cm.body}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 하단 좋아요 + 댓글 입력 */}
              <div className="pt-3 border-t border-[#F1F1F3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onToggleLikePost(activePost)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 cursor-pointer"
                  >
                    <Heart
                      className="w-4 h-4"
                      fill={
                        myUserId && activePost.likeUserIds.includes(myUserId)
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                    <span>좋아요 {activePost.likeUserIds.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePostId(null);
                      onVisitUserProfile(
                        activePost.userId,
                        activePost.authorHandle
                      );
                    }}
                    className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 cursor-pointer"
                  >
                    이 유저 옷장으로 코디 제안하기 →
                  </button>
                </div>

                <form
                  onSubmit={handleCommentForm}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="댓글 달기..."
                    className="flex-1 px-3.5 py-2 rounded-full bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!commentInput.trim() || isSubmittingComment}
                    className="w-8 h-8 rounded-full bg-zinc-950 text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
