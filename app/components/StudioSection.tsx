'use client';

import React from 'react';
import {
  Bookmark,
  Camera,
  Check,
  Download,
  RefreshCw,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  type ClothItem,
  LOOKBOOK_CONCEPTS,
  type LookbookConceptId,
  LOOKBOOK_FIT_TARGETS,
  type LookbookFitTarget,
  SLOT_CATEGORIES,
  STUDIO_DETAILS,
  STUDIO_GENRES,
  type StylistResult,
} from '../lib/socialConstants';

interface StudioSectionProps {
  wardrobe: ClothItem[];
  selectedClothIds: number[];
  onToggleCloth: (id: number) => void;
  onAutoPickOutfit: () => void;
  onClearSelection: () => void;
  selectedGenre: string;
  onSelectGenre: (g: string) => void;
  activeDetails: string[];
  onToggleDetail: (d: string) => void;
  lookbookConcept: LookbookConceptId;
  onSelectConcept: (c: LookbookConceptId) => void;
  lookbookFitTarget: LookbookFitTarget;
  onSelectFitTarget: (t: LookbookFitTarget) => void;
  userTryOnPhoto: string;
  userTryOnInfo: string;
  onUploadTryOnPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearTryOnPhoto: () => void;
  autoShootLookbook: boolean;
  onToggleAutoShoot: (v: boolean) => void;
  isGenerating: boolean;
  isGeneratingLookbook: boolean;
  stylistResult: StylistResult | null;
  lookbookStatusHint: string;
  lookbookMissingKey: boolean;
  isSavingLookbook: boolean;
  onGenerateAIOutfit: () => void;
  onShootLookbookPhoto: () => void;
  onSaveLookbook: () => void;
  onDownloadImage: (url: string, title: string) => void;
  onZoomImage: (url: string) => void;
  onOpenApiModal: () => void;
  onOpenClothUpload: () => void;
}

export default function StudioSection({
  wardrobe,
  selectedClothIds,
  onToggleCloth,
  onAutoPickOutfit,
  onClearSelection,
  selectedGenre,
  onSelectGenre,
  activeDetails,
  onToggleDetail,
  lookbookConcept,
  onSelectConcept,
  lookbookFitTarget,
  onSelectFitTarget,
  userTryOnPhoto,
  userTryOnInfo,
  onUploadTryOnPhoto,
  onClearTryOnPhoto,
  autoShootLookbook,
  onToggleAutoShoot,
  isGenerating,
  isGeneratingLookbook,
  stylistResult,
  lookbookStatusHint,
  lookbookMissingKey,
  isSavingLookbook,
  onGenerateAIOutfit,
  onShootLookbookPhoto,
  onSaveLookbook,
  onDownloadImage,
  onZoomImage,
  onOpenApiModal,
  onOpenClothUpload,
}: StudioSectionProps) {
  const validSelectedIds = selectedClothIds.filter((id) =>
    wardrobe.some((w) => w.id === id)
  );

  return (
    <section className="space-y-8 animate-fade-soft">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950">
            STUDIO
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            내 옷장 아이템을 조합해 거리샷 또는 화이트 스튜디오 모델샷으로 촬영해 보세요.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenClothUpload}
          className="px-4 py-2 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-900 transition cursor-pointer"
        >
          + 옷장에 의류 추가
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* 좌측: 무테두리 소프트 그레이 스튜디오 컨트롤 */}
        <div className="lg:col-span-4 rounded-3xl bg-[#F7F7F8] p-5 sm:p-6 space-y-6">
          <div className="space-y-2.5">
            <p className="text-xs font-extrabold text-zinc-900">스타일 무드</p>
            <div className="grid grid-cols-3 gap-1.5">
              {STUDIO_GENRES.map((g) => {
                const active = selectedGenre === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onSelectGenre(g)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white'
                        : 'bg-white text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-extrabold text-zinc-900">핏 · 디테일</p>
            <div className="flex flex-wrap gap-1.5">
              {STUDIO_DETAILS.map((det) => {
                const active = activeDetails.includes(det);
                return (
                  <button
                    key={det}
                    type="button"
                    onClick={() => onToggleDetail(det)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white'
                        : 'bg-white text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    {det}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-zinc-200/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-zinc-900">
                촬영 컨셉 선택
              </span>
              <span className="text-[10px] font-bold text-zinc-400">
                정면 단독 샷
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {LOOKBOOK_CONCEPTS.map((c) => {
                const active = lookbookConcept === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectConcept(c.id)}
                    className={`py-2.5 px-3 rounded-xl text-left transition cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white'
                        : 'bg-white text-zinc-700 hover:text-zinc-950'
                    }`}
                  >
                    <span className="block text-xs font-extrabold">
                      {c.label}
                    </span>
                    <span
                      className={`block text-[10px] mt-0.5 ${
                        active ? 'text-zinc-300' : 'text-zinc-400'
                      }`}
                    >
                      {c.sub}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-extrabold text-zinc-900 pt-1">
              실사 모델 선택
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {LOOKBOOK_FIT_TARGETS.map((t) => {
                const active = lookbookFitTarget === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectFitTarget(t.id)}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white'
                        : 'bg-white text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {lookbookFitTarget === 'my_photo' && (
              <div className="rounded-2xl bg-white p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-800">
                    내 전신 · 거울샷 사진
                  </span>
                  {userTryOnPhoto && (
                    <button
                      type="button"
                      onClick={onClearTryOnPhoto}
                      className="text-[10px] text-zinc-400 hover:text-zinc-900 cursor-pointer"
                    >
                      제거
                    </button>
                  )}
                </div>

                {userTryOnPhoto ? (
                  <div className="flex items-center gap-2.5">
                    <img
                      referrerPolicy="no-referrer"
                      src={userTryOnPhoto}
                      alt="내 피팅 사진"
                      className="w-12 h-16 rounded-xl object-cover bg-[#F4F4F5]"
                    />
                    <p className="text-[11px] text-zinc-600 leading-snug">
                      {userTryOnInfo || '피팅 사진 준비 완료'}
                    </p>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center py-4 rounded-xl bg-[#F7F7F8] hover:bg-zinc-200/70 transition cursor-pointer text-center">
                    <Upload className="w-4 h-4 text-zinc-500 mb-1" />
                    <span className="text-[11px] font-bold text-zinc-800">
                      전신 사진 선택하기
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onUploadTryOnPhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}

            <label className="flex items-center justify-between pt-1 cursor-pointer select-none">
              <span className="text-[11px] font-medium text-zinc-600">
                코디 생성 시 정면 모델샷 자동 촬영
              </span>
              <input
                type="checkbox"
                checked={autoShootLookbook}
                onChange={(e) => onToggleAutoShoot(e.target.checked)}
                className="w-4 h-4 accent-zinc-950 rounded cursor-pointer"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={onGenerateAIOutfit}
            className="w-full py-3.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Wand2 className="w-4 h-4" />
            <span>
              {isGenerating
                ? '코디 분석 중...'
                : '선택한 조합으로 코디 & 모델샷 생성'}
            </span>
          </button>
        </div>

        {/* 우측: 슬롯 트레이 + 정면 화이트 스튜디오 결과 */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-3xl bg-[#F7F7F8] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">
                  원터치 코디 슬롯 ({validSelectedIds.length}개 선택됨)
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  아래 옷장 아이템을 터치하면 카테고리별 슬롯에 바로 장착됩니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAutoPickOutfit}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 자동 조합
                </button>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-100 text-xs font-medium text-zinc-500 cursor-pointer"
                >
                  초기화
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {SLOT_CATEGORIES.map((slot) => {
                const matched = wardrobe.find(
                  (w) =>
                    validSelectedIds.includes(w.id) && w.category === slot.key
                );
                if (matched) {
                  return (
                    <div
                      key={slot.key}
                      onClick={() => onToggleCloth(matched.id)}
                      className="rounded-2xl bg-white p-2.5 text-center cursor-pointer ring-2 ring-zinc-950 transition"
                    >
                      <img
                        referrerPolicy="no-referrer"
                        src={matched.image}
                        alt={matched.name}
                        className="w-full h-20 object-cover rounded-xl bg-[#F4F4F5] mb-1.5"
                      />
                      <span className="block text-[10px] font-extrabold text-zinc-950">
                        {slot.label}
                      </span>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {matched.name}
                      </p>
                    </div>
                  );
                }
                return (
                  <div
                    key={slot.key}
                    className="rounded-2xl bg-white/70 p-3 flex flex-col items-center justify-center text-center min-h-[118px] text-zinc-400"
                  >
                    <span className="text-lg mb-1 opacity-60">{slot.icon}</span>
                    <span className="text-[11px] font-bold">{slot.label}</span>
                  </div>
                );
              })}
            </div>

            {wardrobe.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto pr-1 pt-2">
                {wardrobe.map((item) => {
                  const picked = validSelectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleCloth(item.id)}
                      className={`rounded-2xl p-2 text-left transition cursor-pointer relative ${
                        picked
                          ? 'bg-zinc-950 text-white'
                          : 'bg-white text-zinc-900 hover:bg-zinc-100'
                      }`}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-[#F4F4F5] mb-1.5 relative">
                        <img
                          referrerPolicy="no-referrer"
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        {picked && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-zinc-950 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
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

          {/* 정면 화이트 스튜디오 모델샷 & 스타일링 리포트 */}
          {stylistResult && (
            <div className="rounded-3xl bg-[#F7F7F8] p-5 sm:p-6 space-y-5 animate-fade-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    {stylistResult.genre} · {stylistResult.lookbookPresetLabel || (lookbookConcept === 'street' ? '거리샷' : '스튜디오 샷')}
                  </span>
                  <h3 className="text-lg font-extrabold text-zinc-950 mt-0.5">
                    {stylistResult.title}
                  </h3>
                </div>

                <button
                  type="button"
                  disabled={isSavingLookbook}
                  onClick={onSaveLookbook}
                  className="px-4 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>
                    {isSavingLookbook ? '저장 중...' : '룩북에 저장'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-5 space-y-2.5">
                  {isGeneratingLookbook ? (
                    <div className="aspect-[3/4] rounded-2xl bg-white flex flex-col items-center justify-center p-6 text-center space-y-3">
                      <div className="w-9 h-9 border-3 border-zinc-200 border-t-zinc-950 rounded-full animate-spin" />
                      <p className="text-xs font-bold text-zinc-900">
                        {lookbookConcept === 'street' ? '성수·한남 거리샷 스냅 촬영 중...' : '화이트 스튜디오 모델샷 촬영 중...'}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {lookbookConcept === 'street' ? '자연광 스트릿 배경에서 실사 모델 착장을 촬영하고 있습니다 (약 8~12초)' : '순백색 호리존 조명에서 실사 모델 착장을 촬영하고 있습니다 (약 8~12초)'}
                      </p>
                    </div>
                  ) : stylistResult.lookbookImage ? (
                    <div className="space-y-2.5">
                      <div
                        onClick={() =>
                          onZoomImage(stylistResult.lookbookImage || '')
                        }
                        className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white cursor-zoom-in group"
                      >
                        <img
                          referrerPolicy="no-referrer"
                          src={stylistResult.lookbookImage}
                          alt={stylistResult.title}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.01]"
                        />
                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-semibold">
                          확대 ⤢
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onShootLookbookPhoto}
                          className="flex-1 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> 다시 촬영
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onDownloadImage(
                              stylistResult.lookbookImage || '',
                              stylistResult.title
                            )
                          }
                          className="px-4 py-2.5 rounded-full bg-white text-zinc-900 text-xs font-bold hover:bg-zinc-100 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> 저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[3/4] rounded-2xl bg-white p-5 flex flex-col items-center justify-center text-center space-y-3">
                      <button
                        type="button"
                        onClick={onShootLookbookPhoto}
                        className="px-4 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" /> 정면 모델샷 촬영하기
                      </button>

                      {lookbookStatusHint && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            {lookbookStatusHint}
                          </p>
                          {lookbookMissingKey && (
                            <button
                              type="button"
                              onClick={onOpenApiModal}
                              className="text-[11px] font-bold text-zinc-950 underline cursor-pointer"
                            >
                              API 설정 열기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-7 space-y-4">
                  <div className="rounded-2xl bg-white p-4 space-y-2">
                    <p className="text-xs font-extrabold text-zinc-950">
                      스타일링 디렉팅 노트
                    </p>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {stylistResult.note}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-extrabold text-zinc-900">
                      착장 구성 아이템 ({stylistResult.items.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {stylistResult.items.map((it) => (
                        <div
                          key={it.id}
                          className="rounded-2xl bg-white p-2.5 flex items-center gap-2.5"
                        >
                          <img
                            referrerPolicy="no-referrer"
                            src={it.image}
                            alt={it.name}
                            className="w-11 h-11 rounded-xl object-cover bg-[#F4F4F5] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-zinc-900 truncate">
                              {it.name}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {it.category}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {stylistResult.suggestions.length > 0 && (
                    <div className="rounded-2xl bg-white p-4 space-y-2">
                      <p className="text-xs font-extrabold text-zinc-900">
                        함께 매치하기 좋은 추천 아이템
                      </p>
                      <div className="space-y-1.5">
                        {stylistResult.suggestions.map((sg, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-bold text-zinc-900">
                              {sg.name}
                            </span>
                            <span className="text-zinc-500">
                              {' '}
                              — {sg.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
