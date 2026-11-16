'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ExternalLink,
  RefreshCw,
  X,
  Globe,
} from 'lucide-react';
import {
  type ArticleReaderDetail,
  type NewsletterArticle,
  formatRelativeTime,
} from '../lib/socialConstants';

interface NewsletterHomeProps {
  articles: NewsletterArticle[];
  isLoading: boolean;
  onRefresh: () => void;
  bookmarkedIds: string[];
  onToggleBookmark: (id: string) => void;
  activeArticle: NewsletterArticle | null;
  articleDetail: ArticleReaderDetail | null;
  isLoadingDetail: boolean;
  onOpenArticle: (article: NewsletterArticle) => void;
  onCloseArticle: () => void;
}

type NewsFilter = '최신' | '패션' | '스니커즈' | '글로벌 번역' | '컬처·라이프' | '북마크';

const NEWS_FILTERS: NewsFilter[] = [
  '최신',
  '패션',
  '스니커즈',
  '글로벌 번역',
  '컬처·라이프',
  '북마크',
];

export default function NewsletterHomeSection({
  articles,
  isLoading,
  onRefresh,
  bookmarkedIds,
  onToggleBookmark,
  activeArticle,
  articleDetail,
  isLoadingDetail,
  onOpenArticle,
  onCloseArticle,
}: NewsletterHomeProps) {
  const [activeFilter, setActiveFilter] = useState<NewsFilter>('최신');
  const [heroIndex, setHeroIndex] = useState<number>(0);

  const heroPool = articles.slice(0, 5);
  const safeHeroIdx =
    heroPool.length > 0 ? heroIndex % heroPool.length : 0;
  const currentHero = heroPool[safeHeroIdx] || null;

  const filteredArticles = articles.filter((art) => {
    if (activeFilter === '최신') return true;
    if (activeFilter === '패션') return art.category === '패션';
    if (activeFilter === '스니커즈') return art.category === '스니커즈';
    if (activeFilter === '글로벌 번역')
      return art.sourceRegion === 'GLOBAL' || art.isTranslated;
    if (activeFilter === '컬처·라이프')
      return art.category === '컬처' || art.category === '라이프스타일';
    if (activeFilter === '북마크') return bookmarkedIds.includes(art.id);
    return true;
  });

  const gridArticles =
    activeFilter === '최신' && currentHero
      ? filteredArticles.filter((a) => a.id !== currentHero.id)
      : filteredArticles;

  return (
    <section className="space-y-12 animate-fade-soft">
      {/* 1. HYPEBEAST × KREAM 스타일 보더리스 히어로 쇼케이스 */}
      {isLoading && articles.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <div className="h-3.5 w-28 rounded-full bg-[#F4F4F5] animate-pulse" />
            <div className="h-9 w-full rounded-xl bg-[#F4F4F5] animate-pulse" />
            <div className="h-9 w-4/5 rounded-xl bg-[#F4F4F5] animate-pulse" />
            <div className="h-4 w-full rounded-lg bg-[#F4F4F5] animate-pulse" />
            <div className="h-4 w-2/3 rounded-lg bg-[#F4F4F5] animate-pulse" />
          </div>
          <div className="lg:col-span-7 aspect-[16/10] rounded-2xl bg-[#F4F4F5] animate-pulse" />
        </div>
      ) : currentHero ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-5 space-y-4 order-2 lg:order-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-zinc-400">
              <span className="text-zinc-900 font-bold">
                {currentHero.category}
              </span>
              <span>·</span>
              <span>{currentHero.sourceName}</span>
              {currentHero.isTranslated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4F4F5] text-zinc-700 text-[10px] font-semibold normal-case">
                  <Globe className="w-2.5 h-2.5" /> 한국어 AI 번역
                </span>
              )}
            </div>

            <h2
              onClick={() => onOpenArticle(currentHero)}
              className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.2] text-zinc-950 cursor-pointer hover:opacity-75 transition"
            >
              {currentHero.title}
            </h2>

            {currentHero.summary && (
              <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3">
                {currentHero.summary}
              </p>
            )}

            <div className="pt-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenArticle(currentHero)}
                  className="px-5 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition cursor-pointer"
                >
                  뉴스레터 읽기
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(currentHero.id)}
                  aria-label="북마크"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                    bookmarkedIds.includes(currentHero.id)
                      ? 'bg-zinc-950 text-white'
                      : 'bg-[#F4F4F5] text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
              </div>

              {heroPool.length > 1 && (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex(
                        (prev) => (prev - 1 + heroPool.length) % heroPool.length
                      )
                    }
                    className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-zinc-800 flex items-center justify-center transition cursor-pointer"
                    aria-label="이전 배너"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="tabular-nums text-[11px] text-zinc-600 min-w-[38px] text-center">
                    {safeHeroIdx + 1} / {heroPool.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex((prev) => (prev + 1) % heroPool.length)
                    }
                    className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-zinc-800 flex items-center justify-center transition cursor-pointer"
                    aria-label="다음 배너"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            onClick={() => onOpenArticle(currentHero)}
            className="lg:col-span-7 order-1 lg:order-2 relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#F4F4F5] cursor-pointer group"
          >
            <img
              referrerPolicy="no-referrer"
              src={currentHero.image}
              alt={currentHero.title}
              className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.02]"
            />
          </div>
        </div>
      ) : null}

      {/* 2. 미니멀 카테고리 탭 바 (테두리 최소화 · 하단 얇은 헤어라인만 유지) */}
      <div className="flex items-center justify-between gap-4 border-b border-[#F1F1F3]">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {NEWS_FILTERS.map((tab) => {
            const active = activeFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFilter(tab)}
                className={`pb-3.5 text-sm whitespace-nowrap transition relative cursor-pointer ${
                  active
                    ? 'font-extrabold text-zinc-950 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-zinc-950'
                    : 'font-medium text-zinc-400 hover:text-zinc-800'
                }`}
              >
                {tab}
                {tab === '북마크' && bookmarkedIds.length > 0
                  ? ` (${bookmarkedIds.length})`
                  : ''}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="pb-3.5 text-xs font-semibold text-zinc-400 hover:text-zinc-900 inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">피드 업데이트</span>
        </button>
      </div>

      {/* 3. HYPEBEAST 스타일 4열 무테두리(Borderless) 에디토리얼 그리드 */}
      {isLoading && articles.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div key={n} className="space-y-3">
              <div className="aspect-[16/11] rounded-xl bg-[#F4F4F5] animate-pulse" />
              <div className="h-3 w-20 rounded bg-[#F4F4F5] animate-pulse" />
              <div className="h-5 w-full rounded bg-[#F4F4F5] animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-[#F4F4F5] animate-pulse" />
            </div>
          ))}
        </div>
      ) : gridArticles.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <p className="text-sm font-semibold text-zinc-500">
            {activeFilter === '북마크'
              ? '아직 저장한 뉴스레터 기사가 없습니다.'
              : '해당 카테고리의 최신 기사를 불러오는 중입니다.'}
          </p>
          {activeFilter !== '최신' && (
            <button
              type="button"
              onClick={() => setActiveFilter('최신')}
              className="text-xs font-bold text-zinc-900 underline cursor-pointer"
            >
              전체 최신 기사로 돌아가기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-11">
          {gridArticles.map((art) => {
            const saved = bookmarkedIds.includes(art.id);
            return (
              <article
                key={art.id}
                onClick={() => onOpenArticle(art)}
                className="group cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="space-y-3">
                  <div className="relative aspect-[16/11] rounded-xl overflow-hidden bg-[#F4F4F5]">
                    <img
                      referrerPolicy="no-referrer"
                      src={art.image}
                      alt={art.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    {art.isTranslated && (
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold backdrop-blur-sm">
                        한국어 번역
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-400">
                      <span className="truncate">
                        <strong className="text-zinc-800 font-bold">
                          {art.category}
                        </strong>{' '}
                        · {art.sourceName}
                      </span>
                      <span className="shrink-0">
                        {formatRelativeTime(art.publishedAt)}
                      </span>
                    </div>

                    <h3 className="text-[15px] font-bold tracking-tight leading-snug text-zinc-950 line-clamp-2 group-hover:opacity-70 transition">
                      {art.title}
                    </h3>

                    {art.summary && (
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                        {art.summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="group-hover:text-zinc-900 font-medium transition">
                    아티클 읽기
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark(art.id);
                    }}
                    aria-label="기사 저장"
                    className={`p-1 rounded-full transition cursor-pointer ${
                      saved
                        ? 'text-zinc-950'
                        : 'text-zinc-300 hover:text-zinc-700'
                    }`}
                  >
                    <Bookmark
                      className="w-3.5 h-3.5"
                      fill={saved ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 4. 인앱 한국어 번역 매거진 리더 모달 */}
      {activeArticle && (
        <div
          onClick={onCloseArticle}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-soft"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <span className="text-zinc-950 font-bold">
                  {activeArticle.category}
                </span>
                <span>·</span>
                <span>{activeArticle.sourceName}</span>
                {(activeArticle.isTranslated ||
                  articleDetail?.isTranslated) && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F4F4F5] text-zinc-800 text-[10px] font-bold">
                    영문 기사 → 한국어 자동 번역
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onCloseArticle}
                className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 flex items-center justify-center text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug text-zinc-950">
                {articleDetail?.titleKo || activeArticle.title}
              </h3>
              {activeArticle.originalTitle &&
                activeArticle.originalTitle !==
                  (articleDetail?.titleKo || activeArticle.title) && (
                  <p className="text-xs text-zinc-400">
                    원제: {activeArticle.originalTitle}
                  </p>
                )}
            </div>

            <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-[#F4F4F5]">
              <img
                referrerPolicy="no-referrer"
                src={articleDetail?.heroImage || activeArticle.image}
                alt={activeArticle.title}
                className="w-full h-full object-cover"
              />
            </div>

            {isLoadingDetail ? (
              <div className="py-8 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    원문 본문을 읽어 한국어 뉴스레터로 번역·정리하고 있습니다...
                  </span>
                </div>
                <div className="h-4 w-full rounded bg-[#F4F4F5] animate-pulse" />
                <div className="h-4 w-11/12 rounded bg-[#F4F4F5] animate-pulse" />
                <div className="h-4 w-4/5 rounded bg-[#F4F4F5] animate-pulse" />
              </div>
            ) : (
              <div className="space-y-5">
                {articleDetail &&
                  articleDetail.highlightsKo &&
                  articleDetail.highlightsKo.length > 0 && (
                    <div className="rounded-2xl bg-[#F7F7F8] p-4 space-y-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                        KEY BRIEFING
                      </p>
                      <ul className="space-y-1.5 text-xs sm:text-[13px] font-medium text-zinc-800 leading-relaxed">
                        {articleDetail.highlightsKo.map((pt, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-zinc-400 select-none">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="space-y-4 text-sm text-zinc-700 leading-[1.8]">
                  {(articleDetail && articleDetail.paragraphsKo.length > 0
                    ? articleDetail.paragraphsKo
                    : [activeArticle.summary]
                  )
                    .filter(Boolean)
                    .map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                </div>
              </div>
            )}

            <div className="pt-3 flex items-center justify-between gap-3 border-t border-[#F1F1F3]">
              <button
                type="button"
                onClick={() => onToggleBookmark(activeArticle.id)}
                className="px-4 py-2.5 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                {bookmarkedIds.includes(activeArticle.id)
                  ? '북마크됨'
                  : '북마크 저장'}
              </button>

              <a
                href={activeArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 inline-flex items-center gap-1.5"
              >
                <span>원문 매거진 보기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
