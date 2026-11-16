'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
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
  type StyleComment,
  type StylePost,
} from '../lib/socialConstants';

interface StyleFeedProps {
  posts: StylePost[];
  myUserId: string | null;
  myHandle: string;
  myAvatarUrl: string;
  myWardrobe: ClothItem[];
  followingIds: string[];
  communityUsers: CommunityUser[];
  avatarByUserId: Map<string, string>;
  onOpenAuth: () => void;
  onOpenClothUpload: () => void;
  onVisitUserProfile: (userId: string, handleHint?: string) => void;
  onToggleFollow: (targetUserId: string) => void;
  onToggleLikePost: (post: StylePost) => void;
  onSubmitComment: (post: StylePost, commentBody: string) => Promise<void>;
  onDeleteComment: (post: StylePost, comment: StyleComment) => Promise<void>;
  onDeletePost: (post: StylePost) => Promise<void>;
  onCreateStylePost: (draft: {
    file: File;
    caption: string;
    styleTags: string[];
    taggedClothIds: number[];
  }) => Promise<boolean>;
}

function AvatarBadge({
  avatarUrl,
  handle,
  sizeClass = 'w-6 h-6 text-[10px]',
}: {
  avatarUrl?: string;
  handle: string;
  sizeClass?: string;
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
  const initial =
    handle.replace(/^@/, '').slice(0, 1).toUpperCase() || 'U';
  return (
    <span
      className={`${sizeClass} rounded-full bg-zinc-900 text-white font-bold flex items-center justify-center shrink-0 select-none`}
    >
      {initial}
    </span>
  );
}

export default function StyleFeedSection({
  posts,
  myUserId,
  myHandle,
  myWardrobe,
  followingIds,
  communityUsers,
  avatarByUserId,
  onOpenAuth,
  onOpenClothUpload,
  onVisitUserProfile,
  onToggleFollow,
  onToggleLikePost,
  onSubmitComment,
  onDeleteComment,
  onDeletePost,
  onCreateStylePost,
}: StyleFeedProps) {
  const [portalReady, setPortalReady] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<string>('전체');
  const [userQuery, setUserQuery] = useState<string>('');
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] =
    useState<boolean>(false);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  // 인라인 카드 빠른 댓글 입력 상태
  const [inlineCommentPostId, setInlineCommentPostId] = useState<number | null>(
    null
  );
  const [inlineCommentText, setInlineCommentText] = useState<string>('');

  // 새 STYLE 게시물 작성 모달 상태
  const [uploadOpen, setUploadOpen] = useState<boolean>(false);
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreviewUrl, setPostPreviewUrl] = useState<string>('');
  const [postCaption, setPostCaption] = useState<string>('');
  const [postTags, setPostTags] = useState<string[]>(['#데일리룩']);
  const [taggedClothIds, setTaggedClothIds] = useState<number[]>([]);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const activePost = posts.find((p) => p.id === activePostId) || null;
  const cleanQuery = userQuery.trim().toLowerCase();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!uploadOpen && !activePost) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [uploadOpen, activePost]);

  // 유저 목록은 평소에 노출하지 않고, 직접 아이디를 검색했을 때만 표시!
  const searchedUsers =
    cleanQuery.length > 0
      ? communityUsers.filter((u) => {
          if (u.id === 'me') return false;
          const normHandle = u.handle.toLowerCase();
          const withoutAt = normHandle.replace(/^@/, '');
          const qWithoutAt = cleanQuery.replace(/^@/, '');
          return (
            normHandle.includes(cleanQuery) ||
            (qWithoutAt.length > 0 && withoutAt.includes(qWithoutAt))
          );
        })
      : [];

  // 게시물은 KREAM처럼 모르는 사람(비로그인·미팔로우 포함)의 게시물도 '전체' 탭에서 모두 공개 열람!
  const filteredPosts = posts.filter((p) => {
    if (selectedTag === '팔로잉') {
      if (!myUserId) return false;
      if (!followingIds.includes(p.userId) && p.userId !== myUserId) {
        return false;
      }
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

  const handleInlineCommentSubmit = async (
    e: React.FormEvent,
    post: StylePost
  ) => {
    e.preventDefault();
    if (!inlineCommentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      await onSubmitComment(post, inlineCommentText.trim());
      setInlineCommentText('');
      setInlineCommentPostId(null);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const openPostAndFocusComment = (postId: number) => {
    setActivePostId(postId);
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 120);
  };

  return (
    <section className="space-y-8 animate-fade-soft">
      {/* 상단 헤더 & 유저 아이디 검색 & + 스타일 올리기 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950">
            STYLE
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            모두의 데일리 착샷과 착용 아이템을 구경하고, 유저 아이디를 검색해 팔로우하거나 옷장을 방문해 보세요.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-68">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="@유저 아이디 검색 (팔로우 · 옷장 방문)"
              className="w-full pl-9 pr-8 py-2.5 rounded-full bg-[#F4F4F5] text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
            {userQuery && (
              <button
                type="button"
                onClick={() => setUserQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
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

      {/* 직접 유저 아이디를 검색했을 때만 나타나는 유저 검색 결과 패널 */}
      {cleanQuery.length > 0 && (
        <div className="rounded-2xl bg-[#F7F7F8] p-4 space-y-3 animate-fade-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-zinc-900">
              사용자 검색 결과 ({searchedUsers.length})
            </p>
          </div>
          {searchedUsers.length === 0 ? (
            <p className="text-xs text-zinc-400 py-1">
              &apos;{userQuery}&apos; 아이디와 일치하는 사용자가 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {searchedUsers.slice(0, 12).map((u) => {
                const isFollowing = followingIds.includes(u.id);
                const av = u.avatarUrl || avatarByUserId.get(u.id);
                return (
                  <div
                    key={u.id}
                    className="rounded-2xl bg-white p-3 flex items-center justify-between gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => onVisitUserProfile(u.id, u.handle)}
                      className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-75 transition cursor-pointer"
                    >
                      <AvatarBadge
                        avatarUrl={av}
                        handle={u.handle}
                        sizeClass="w-9 h-9 text-xs"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-zinc-950 truncate">
                          {u.handle}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          옷장 {u.closet.length}벌 보러가기
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleFollow(u.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition cursor-pointer ${
                        isFollowing
                          ? 'bg-[#F4F4F5] text-zinc-800 hover:bg-zinc-200'
                          : 'bg-zinc-950 text-white hover:bg-zinc-800'
                      }`}
                    >
                      {isFollowing ? '팔로잉' : '팔로우'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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

      {/* KREAM STYLE 4열 무테두리 오픈 피드 그리드 (누구나 전체 열람 가능!) */}
      {filteredPosts.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-sm font-semibold text-zinc-500">
            {selectedTag === '팔로잉'
              ? '아직 팔로우한 사용자의 게시물이 없습니다. 상단 검색창에서 아이디를 검색해 팔로우해 보세요!'
              : '아직 등록된 스타일 게시물이 없습니다. 첫 번째 데일리 착샷을 올려보세요!'}
          </p>
          {selectedTag !== '팔로잉' && (
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
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
          {filteredPosts.map((post) => {
            const liked = Boolean(
              myUserId && post.likeUserIds.includes(myUserId)
            );
            const firstTagItem = post.taggedItems[0];
            const authorAvatar =
              post.authorAvatar || avatarByUserId.get(post.userId);
            const lastComment =
              post.comments.length > 0
                ? post.comments[post.comments.length - 1]
                : null;

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

                {/* 작성자 프로필 + 하트 토글 + 댓글 버튼 (항상 표시) */}
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      onVisitUserProfile(post.userId, post.authorHandle)
                    }
                    className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition cursor-pointer"
                  >
                    <AvatarBadge
                      avatarUrl={authorAvatar}
                      handle={post.authorHandle}
                      sizeClass="w-5 h-5 text-[9px]"
                    />
                    <span className="text-xs font-bold text-zinc-900 truncate">
                      {post.authorHandle}
                    </span>
                  </button>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => onToggleLikePost(post)}
                      aria-label="좋아요 토글"
                      className={`inline-flex items-center gap-1 transition cursor-pointer ${
                        liked
                          ? 'text-rose-500 font-bold'
                          : 'text-zinc-400 hover:text-zinc-800'
                      }`}
                    >
                      <Heart
                        className="w-3.5 h-3.5"
                        fill={liked ? 'currentColor' : 'none'}
                      />
                      <span className="tabular-nums">
                        {post.likeUserIds.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!myUserId) {
                          openPostAndFocusComment(post.id);
                          return;
                        }
                        setInlineCommentPostId((prev) =>
                          prev === post.id ? null : post.id
                        );
                        setInlineCommentText('');
                      }}
                      aria-label="댓글 달기"
                      className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-900 transition cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="tabular-nums">
                        {post.comments.length}
                      </span>
                    </button>
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

                {/* 최신 댓글 미리보기 & 인라인 빠른 댓글창 */}
                {lastComment && (
                  <div
                    onClick={() => openPostAndFocusComment(post.id)}
                    className="px-0.5 text-[11px] text-zinc-500 truncate cursor-pointer"
                  >
                    <strong className="font-bold text-zinc-800 mr-1">
                      {lastComment.authorHandle}
                    </strong>
                    <span>{lastComment.body}</span>
                  </div>
                )}

                {inlineCommentPostId === post.id && (
                  <form
                    onSubmit={(e) => handleInlineCommentSubmit(e, post)}
                    className="flex items-center gap-1.5 pt-0.5"
                  >
                    <input
                      type="text"
                      value={inlineCommentText}
                      onChange={(e) => setInlineCommentText(e.target.value)}
                      placeholder="댓글 입력..."
                      autoFocus
                      className="flex-1 px-3 py-1.5 rounded-full bg-[#F4F4F5] text-[11px] text-zinc-900 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!inlineCommentText.trim() || isSubmittingComment}
                      className="w-7 h-7 rounded-full bg-zinc-950 text-white flex items-center justify-center disabled:opacity-30 cursor-pointer shrink-0"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </form>
                )}

                {/* 착용 아이템 태그 카드 */}
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

      {/* 새 STYLE 게시물 작성 모달 (포털 + 상단 출발 무색 블러 배경) */}
      {portalReady &&
        uploadOpen &&
        createPortal(
          <div
            onClick={() => setUploadOpen(false)}
            className="fixed inset-0 z-[100] bg-transparent backdrop-blur-md overflow-y-auto overscroll-contain flex items-start justify-center pt-12 sm:pt-16 pb-16 px-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-[0_24px_70px_rgba(0,0,0,0.14)] ring-1 ring-black/5 space-y-5 animate-fade-soft"
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
                        누구나 STYLE 탭에서 볼 수 있도록 게시됩니다
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
          </div>,
          document.body
        )}

      {/* STYLE 게시물 상세 모달 (포털 + 상단 출발 무색 블러 배경) */}
      {portalReady &&
        activePost &&
        createPortal(
          <div
            onClick={() => setActivePostId(null)}
            className="fixed inset-0 z-[100] bg-transparent backdrop-blur-md overflow-y-auto overscroll-contain flex items-start justify-center pt-10 sm:pt-14 pb-16 px-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl rounded-3xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.16)] ring-1 ring-black/5 grid grid-cols-1 md:grid-cols-12 overflow-hidden animate-fade-soft"
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
                      className="flex items-center gap-2.5 hover:opacity-75 transition cursor-pointer"
                    >
                      <AvatarBadge
                        avatarUrl={
                          activePost.authorAvatar ||
                          avatarByUserId.get(activePost.userId)
                        }
                        handle={activePost.authorHandle}
                        sizeClass="w-9 h-9 text-xs"
                      />
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

                  {/* 댓글 목록 (아바타 · 시간 · 본인 댓글 삭제 지원) */}
                  <div className="space-y-3 pt-3 border-t border-[#F1F1F3]">
                    <p className="text-xs font-extrabold text-zinc-900">
                      댓글 {activePost.comments.length}
                    </p>
                    {activePost.comments.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-2">
                        첫 번째 댓글을 남겨보세요.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {activePost.comments.map((cm) => {
                          const cmAvatar =
                            cm.authorAvatar || avatarByUserId.get(cm.userId);
                          const isMyComment = Boolean(
                            myUserId && cm.userId === myUserId
                          );
                          return (
                            <div
                              key={cm.id}
                              className="flex items-start justify-between gap-2 text-xs"
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePostId(null);
                                    onVisitUserProfile(
                                      cm.userId,
                                      cm.authorHandle
                                    );
                                  }}
                                  className="shrink-0 mt-0.5 cursor-pointer"
                                >
                                  <AvatarBadge
                                    avatarUrl={cmAvatar}
                                    handle={cm.authorHandle}
                                    sizeClass="w-6 h-6 text-[10px]"
                                  />
                                </button>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePostId(null);
                                        onVisitUserProfile(
                                          cm.userId,
                                          cm.authorHandle
                                        );
                                      }}
                                      className="font-extrabold text-zinc-900 hover:underline cursor-pointer"
                                    >
                                      {cm.authorHandle}
                                    </button>
                                    <span className="text-[10px] text-zinc-400">
                                      {cm.createdAt}
                                    </span>
                                  </div>
                                  <p className="text-zinc-700 leading-relaxed break-words mt-0.5">
                                    {cm.body}
                                  </p>
                                </div>
                              </div>

                              {isMyComment && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteComment(activePost, cm)}
                                  title="댓글 삭제"
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
                </div>

                {/* 하단 하트 토글 + 댓글 입력 */}
                <div className="pt-3 border-t border-[#F1F1F3] space-y-2.5">
                  <div className="flex items-center justify-between">
                    {(() => {
                      const isLiked = Boolean(
                        myUserId && activePost.likeUserIds.includes(myUserId)
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => onToggleLikePost(activePost)}
                          className={`inline-flex items-center gap-1.5 text-xs font-bold transition cursor-pointer ${
                            isLiked ? 'text-rose-500' : 'text-zinc-900'
                          }`}
                        >
                          <Heart
                            className="w-4 h-4"
                            fill={isLiked ? 'currentColor' : 'none'}
                          />
                          <span>좋아요 {activePost.likeUserIds.length}</span>
                        </button>
                      );
                    })()}

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
                      작성자 옷장 구경하기 →
                    </button>
                  </div>

                  <form
                    onSubmit={handleCommentForm}
                    className="flex items-center gap-2"
                  >
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder={
                        myUserId
                          ? '댓글을 입력하세요...'
                          : '로그인 후 댓글을 남길 수 있습니다'
                      }
                      onFocus={() => {
                        if (!myUserId) onOpenAuth();
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-full bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!commentInput.trim() || isSubmittingComment}
                      className="w-9 h-9 rounded-full bg-zinc-950 text-white flex items-center justify-center disabled:opacity-30 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
