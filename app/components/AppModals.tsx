'use client';

import React from 'react';
import { type User } from '@supabase/supabase-js';
import {
  Camera,
  Copy,
  Download,
  Link2,
  LogOut,
  Upload,
  X,
} from 'lucide-react';
import {
  type ApiConfig,
  type CategoryType,
  type ClothItem,
  type ClothStatus,
  type PhotoSideType,
  SAMPLE_SHOP_PRESETS,
  SLOT_CATEGORIES,
  type UrlPreviewData,
} from '../lib/socialConstants';

interface AppModalsProps {
  // 1. Auth Modal
  authModalOpen: boolean;
  onCloseAuthModal: () => void;
  authUser: User | null;
  myHandle: string;
  authMode: 'login' | 'signup';
  onChangeAuthMode: (m: 'login' | 'signup') => void;
  authEmail: string;
  onChangeAuthEmail: (v: string) => void;
  authPassword: string;
  onChangeAuthPassword: (v: string) => void;
  authNickname: string;
  onChangeAuthNickname: (v: string) => void;
  authLoading: boolean;
  authMessage: string;
  onEmailAuthSubmit: (e: React.FormEvent) => void;
  onOAuthLogin: (provider: 'google' | 'kakao') => void;
  onSignOut: () => void;

  // 2. Upload Cloth Modal
  uploadModalOpen: boolean;
  onCloseUploadModal: () => void;
  uploadMethod: 'photo' | 'url';
  onChangeUploadMethod: (m: 'photo' | 'url') => void;
  photoName: string;
  onChangePhotoName: (v: string) => void;
  photoCategory: CategoryType;
  onChangePhotoCategory: (c: CategoryType) => void;
  photoSeason: string;
  onChangePhotoSeason: (v: string) => void;
  photoStatus: ClothStatus;
  onChangePhotoStatus: (s: ClothStatus) => void;
  photoDataUrl: string;
  photoCompressInfo: string;
  photoSideInput: PhotoSideType;
  onChangePhotoSideInput: (s: PhotoSideType) => void;
  photoSourceUrlInput: string;
  onChangePhotoSourceUrlInput: (v: string) => void;
  isUploadingCloth: boolean;
  onPhotoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClothUploadSubmit: (e: React.FormEvent) => void;

  shopUrlInput: string;
  onChangeShopUrlInput: (v: string) => void;
  isFetchingUrl: boolean;
  urlPreview: UrlPreviewData | null;
  onUpdateUrlPreview: (next: UrlPreviewData | null) => void;
  urlStatus: ClothStatus;
  onChangeUrlStatus: (s: ClothStatus) => void;
  onFetchUrlMetadata: (preset?: UrlPreviewData) => void;
  onSelectUrlGalleryThumb: (url: string) => void;
  onUrlCustomPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmUrlClothUpload: () => void;

  // 3. Edit Cloth Modal
  editingCloth: ClothItem | null;
  onCloseEditCloth: () => void;
  editClothName: string;
  onChangeEditClothName: (v: string) => void;
  editClothCategory: CategoryType;
  onChangeEditClothCategory: (c: CategoryType) => void;
  editClothSeason: string;
  onChangeEditClothSeason: (v: string) => void;
  editClothStatus: ClothStatus;
  onChangeEditClothStatus: (s: ClothStatus) => void;
  editClothSourceUrl: string;
  onChangeEditClothSourceUrl: (v: string) => void;
  editClothPhotoSide: PhotoSideType;
  onChangeEditClothPhotoSide: (s: PhotoSideType) => void;
  editClothExtraImages: string[];
  onRemoveEditExtraImage: (idx: number) => void;
  isUploadingExtraAngle: boolean;
  onUploadExtraAngleInEdit: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSavingClothEdit: boolean;
  onSaveClothEdit: (e: React.FormEvent) => void;

  // 4. Settings & SQL Modal
  apiModalOpen: boolean;
  onCloseApiModal: () => void;
  cfgForm: ApiConfig;
  onChangeCfgForm: (next: ApiConfig) => void;
  onSaveApiConfig: (e: React.FormEvent) => void;
  onCopySocialSql: () => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // 5. Lightbox
  zoomImageUrl: string;
  onCloseZoomImage: () => void;
  onDownloadImage: (url: string, title: string) => void;
}

export default function AppModals({
  authModalOpen,
  onCloseAuthModal,
  authUser,
  myHandle,
  authMode,
  onChangeAuthMode,
  authEmail,
  onChangeAuthEmail,
  authPassword,
  onChangeAuthPassword,
  authNickname,
  onChangeAuthNickname,
  authLoading,
  authMessage,
  onEmailAuthSubmit,
  onOAuthLogin,
  onSignOut,

  uploadModalOpen,
  onCloseUploadModal,
  uploadMethod,
  onChangeUploadMethod,
  photoName,
  onChangePhotoName,
  photoCategory,
  onChangePhotoCategory,
  photoSeason,
  onChangePhotoSeason,
  photoStatus,
  onChangePhotoStatus,
  photoDataUrl,
  photoCompressInfo,
  photoSideInput,
  onChangePhotoSideInput,
  photoSourceUrlInput,
  onChangePhotoSourceUrlInput,
  isUploadingCloth,
  onPhotoFileChange,
  onClothUploadSubmit,

  shopUrlInput,
  onChangeShopUrlInput,
  isFetchingUrl,
  urlPreview,
  onUpdateUrlPreview,
  urlStatus,
  onChangeUrlStatus,
  onFetchUrlMetadata,
  onSelectUrlGalleryThumb,
  onUrlCustomPhotoChange,
  onConfirmUrlClothUpload,

  editingCloth,
  onCloseEditCloth,
  editClothName,
  onChangeEditClothName,
  editClothCategory,
  onChangeEditClothCategory,
  editClothSeason,
  onChangeEditClothSeason,
  editClothStatus,
  onChangeEditClothStatus,
  editClothSourceUrl,
  onChangeEditClothSourceUrl,
  editClothPhotoSide,
  onChangeEditClothPhotoSide,
  editClothExtraImages,
  onRemoveEditExtraImage,
  isUploadingExtraAngle,
  onUploadExtraAngleInEdit,
  isSavingClothEdit,
  onSaveClothEdit,

  apiModalOpen,
  onCloseApiModal,
  cfgForm,
  onChangeCfgForm,
  onSaveApiConfig,
  onCopySocialSql,
  onExportBackup,
  onImportBackup,

  zoomImageUrl,
  onCloseZoomImage,
  onDownloadImage,
}: AppModalsProps) {
  return (
    <>
      {/* 1. 로그인 · 회원가입 모달 */}
      {authModalOpen && (
        <div
          onClick={onCloseAuthModal}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 animate-fade-soft"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-950">
                  {authUser ? '내 계정 정보' : '873oc 로그인 · 가입'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  옷장 아카이브와 STYLE 게시물이 클라우드에 동기화됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseAuthModal}
                className="w-8 h-8 rounded-full bg-[#F4F4F5] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authUser ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#F7F7F8] p-4 space-y-1">
                  <p className="text-sm font-extrabold text-zinc-950">
                    {myHandle}
                  </p>
                  <p className="text-xs text-zinc-500">{authUser.email}</p>
                </div>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full py-3 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-900 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> 로그아웃
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => onOAuthLogin('kakao')}
                    className="w-full py-3 rounded-full bg-[#FEE500] hover:opacity-95 text-[#191919] text-xs font-extrabold transition cursor-pointer"
                  >
                    카카오로 3초 만에 시작하기
                  </button>
                  <button
                    type="button"
                    onClick={() => onOAuthLogin('google')}
                    className="w-full py-3 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition cursor-pointer"
                  >
                    Google 계정으로 계속하기
                  </button>
                </div>

                <div className="relative py-1 text-center">
                  <span className="text-[11px] text-zinc-400">
                    또는 이메일로 계속하기
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#F4F4F5]">
                  <button
                    type="button"
                    onClick={() => onChangeAuthMode('login')}
                    className={`py-2 rounded-full text-xs font-bold transition cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-white text-zinc-950 shadow-sm'
                        : 'text-zinc-500'
                    }`}
                  >
                    로그인
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAuthMode('signup')}
                    className={`py-2 rounded-full text-xs font-bold transition cursor-pointer ${
                      authMode === 'signup'
                        ? 'bg-white text-zinc-950 shadow-sm'
                        : 'text-zinc-500'
                    }`}
                  >
                    회원가입
                  </button>
                </div>

                <form onSubmit={onEmailAuthSubmit} className="space-y-3">
                  {authMode === 'signup' && (
                    <input
                      type="text"
                      value={authNickname}
                      onChange={(e) => onChangeAuthNickname(e.target.value)}
                      placeholder="사용할 닉네임 (예: 딸기맛초코2)"
                      className="w-full px-4 py-3 rounded-2xl bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
                    />
                  )}
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => onChangeAuthEmail(e.target.value)}
                    placeholder="이메일 주소"
                    className="w-full px-4 py-3 rounded-2xl bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
                  />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => onChangeAuthPassword(e.target.value)}
                    placeholder="비밀번호 (6자 이상)"
                    className="w-full px-4 py-3 rounded-2xl bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
                  />

                  {authMessage && (
                    <p className="text-xs text-zinc-600 px-1">{authMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    {authLoading
                      ? '처리 중...'
                      : authMode === 'login'
                      ? '이메일로 로그인'
                      : '회원가입 완료'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. 내 옷장 새 의류 추가 모달 */}
      {uploadModalOpen && (
        <div
          onClick={onCloseUploadModal}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 animate-fade-soft"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-950">
                  내 옷장에 아이템 추가
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  직접 찍은 사진이나 무신사 · KREAM 상품 링크로 등록하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseUploadModal}
                className="w-8 h-8 rounded-full bg-[#F4F4F5] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#F4F4F5]">
              <button
                type="button"
                onClick={() => onChangeUploadMethod('photo')}
                className={`py-2 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  uploadMethod === 'photo'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500'
                }`}
              >
                <Camera className="w-3.5 h-3.5" /> 사진 업로드
              </button>
              <button
                type="button"
                onClick={() => onChangeUploadMethod('url')}
                className={`py-2 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  uploadMethod === 'url'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" /> 쇼핑몰 링크 등록
              </button>
            </div>

            {uploadMethod === 'photo' ? (
              <form onSubmit={onClothUploadSubmit} className="space-y-4">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={onPhotoFileChange}
                    className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-zinc-950 file:text-white cursor-pointer"
                  />
                  {photoDataUrl && (
                    <div className="mt-3 rounded-2xl bg-[#F7F7F8] p-3 flex items-center gap-3">
                      <img
                        referrerPolicy="no-referrer"
                        src={photoDataUrl}
                        alt="미리보기"
                        className="w-12 h-12 rounded-xl object-cover bg-white shrink-0"
                      />
                      <p className="text-[11px] font-medium text-zinc-600">
                        {photoCompressInfo || 'WebP 최적화 완료'}
                      </p>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  required
                  value={photoName}
                  onChange={(e) => onChangePhotoName(e.target.value)}
                  placeholder="아이템 이름 (예: 워싱 와이드 데님 팬츠)"
                  className="w-full px-4 py-3 rounded-2xl bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
                />

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={photoCategory}
                    onChange={(e) =>
                      onChangePhotoCategory(e.target.value as CategoryType)
                    }
                    className="px-3 py-2.5 rounded-2xl bg-[#F4F4F5] text-xs font-bold text-zinc-900 focus:outline-none"
                  >
                    <option value="상의">상의</option>
                    <option value="하의">하의</option>
                    <option value="아우터">아우터</option>
                    <option value="신발">신발</option>
                    <option value="악세사리">악세사리</option>
                  </select>

                  <select
                    value={photoSeason}
                    onChange={(e) => onChangePhotoSeason(e.target.value)}
                    className="px-3 py-2.5 rounded-2xl bg-[#F4F4F5] text-xs font-bold text-zinc-900 focus:outline-none"
                  >
                    <option value="사계절">사계절</option>
                    <option value="봄/가을">봄/가을</option>
                    <option value="여름">여름</option>
                    <option value="겨울">겨울</option>
                  </select>

                  <select
                    value={photoStatus}
                    onChange={(e) =>
                      onChangePhotoStatus(e.target.value as ClothStatus)
                    }
                    className="px-3 py-2.5 rounded-2xl bg-[#F4F4F5] text-xs font-bold text-zinc-900 focus:outline-none"
                  >
                    <option value="보유 중">보유 중</option>
                    <option value="구매 예정">구매 예정</option>
                  </select>
                </div>

                <div className="rounded-2xl bg-[#F7F7F8] p-3.5 space-y-2.5">
                  <p className="text-[11px] font-bold text-zinc-700">
                    사진 앞 · 뒤 방향 (등판 사진의 앞면 오인 방지)
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'auto' as PhotoSideType, label: '자동 판별' },
                        { id: 'front' as PhotoSideType, label: '앞면 사진' },
                        {
                          id: 'back' as PhotoSideType,
                          label: '뒷면(등판) 사진',
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangePhotoSideInput(opt.id)}
                        className={`py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                          photoSideInput === opt.id
                            ? 'bg-zinc-950 text-white'
                            : 'bg-white text-zinc-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="url"
                    value={photoSourceUrlInput}
                    onChange={(e) => onChangePhotoSourceUrlInput(e.target.value)}
                    placeholder="원본 쇼핑몰 링크 (선택)"
                    className="w-full px-3.5 py-2 rounded-xl bg-white text-xs text-zinc-900 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUploadingCloth}
                  className="w-full py-3.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                >
                  {isUploadingCloth ? '저장 중...' : '내 옷장에 등록하기'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={shopUrlInput}
                    onChange={(e) => onChangeShopUrlInput(e.target.value)}
                    placeholder="https://kream.co.kr/products/... 또는 무신사·29CM 링크"
                    className="flex-1 px-4 py-3 rounded-full bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isFetchingUrl}
                    onClick={() => onFetchUrlMetadata()}
                    className="px-5 py-3 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {isFetchingUrl ? '추출 중...' : '불러오기'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_SHOP_PRESETS.map((pr) => (
                    <button
                      key={pr.url}
                      type="button"
                      onClick={() => {
                        onChangeShopUrlInput(pr.url);
                      }}
                      className="px-3 py-1 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-[11px] font-semibold text-zinc-600 cursor-pointer"
                    >
                      {pr.store} · {pr.name.slice(0, 22)}
                    </button>
                  ))}
                </div>

                {urlPreview && (
                  <div className="rounded-3xl bg-[#F7F7F8] p-4 space-y-4">
                    <div className="flex items-start gap-3.5">
                      <div className="space-y-1.5 shrink-0 text-center">
                        <img
                          referrerPolicy="no-referrer"
                          src={urlPreview.image}
                          alt={urlPreview.name || '상품 이미지'}
                          className="w-20 h-20 rounded-2xl object-cover bg-white"
                        />
                        <label className="block text-[10px] font-bold text-zinc-600 hover:text-zinc-950 cursor-pointer">
                          사진 변경
                          <input
                            type="file"
                            accept="image/*"
                            onChange={onUrlCustomPhotoChange}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-950 text-white text-[10px] font-bold">
                          {urlPreview.store}
                        </span>
                        <input
                          type="text"
                          value={urlPreview.name}
                          onChange={(e) =>
                            onUpdateUrlPreview({
                              ...urlPreview,
                              name: e.target.value,
                            })
                          }
                          placeholder="상품명을 입력하세요"
                          className="w-full px-3 py-2 rounded-xl bg-white text-xs font-bold text-zinc-900 focus:outline-none"
                        />
                        <p className="text-[11px] text-zinc-500">
                          {urlPreview.price}
                        </p>
                      </div>
                    </div>

                    {urlPreview.galleryDataUrls &&
                      urlPreview.galleryDataUrls.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                          {urlPreview.galleryDataUrls.map((gUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => onSelectUrlGalleryThumb(gUrl)}
                              className="w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 cursor-pointer hover:ring-2 hover:ring-zinc-950"
                            >
                              <img
                                referrerPolicy="no-referrer"
                                src={gUrl}
                                alt={`상품컷 ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}

                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={urlPreview.category}
                        onChange={(e) =>
                          onUpdateUrlPreview({
                            ...urlPreview,
                            category: e.target.value as CategoryType,
                          })
                        }
                        className="px-3 py-2 rounded-xl bg-white text-xs font-bold text-zinc-900 focus:outline-none"
                      >
                        <option value="상의">상의</option>
                        <option value="하의">하의</option>
                        <option value="아우터">아우터</option>
                        <option value="신발">신발</option>
                        <option value="악세사리">악세사리</option>
                      </select>

                      <select
                        value={urlPreview.season}
                        onChange={(e) =>
                          onUpdateUrlPreview({
                            ...urlPreview,
                            season: e.target.value,
                          })
                        }
                        className="px-3 py-2 rounded-xl bg-white text-xs font-bold text-zinc-900 focus:outline-none"
                      >
                        <option value="사계절">사계절</option>
                        <option value="봄/가을">봄/가을</option>
                        <option value="여름">여름</option>
                        <option value="겨울">겨울</option>
                      </select>

                      <select
                        value={urlStatus}
                        onChange={(e) =>
                          onChangeUrlStatus(e.target.value as ClothStatus)
                        }
                        className="px-3 py-2 rounded-xl bg-white text-xs font-bold text-zinc-900 focus:outline-none"
                      >
                        <option value="보유 중">보유 중</option>
                        <option value="구매 예정">구매 예정</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={isUploadingCloth}
                      onClick={onConfirmUrlClothUpload}
                      className="w-full py-3.5 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                    >
                      {isUploadingCloth
                        ? '저장 중...'
                        : '이 상품 내 옷장에 추가하기'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 등록된 의류 사후 수정 모달 */}
      {editingCloth && (
        <div
          onClick={onCloseEditCloth}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 animate-fade-soft"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-zinc-950">
                의류 정보 수정
              </h3>
              <button
                type="button"
                onClick={onCloseEditCloth}
                className="w-8 h-8 rounded-full bg-[#F4F4F5] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSaveClothEdit} className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl bg-[#F7F7F8] p-3">
                <img
                  referrerPolicy="no-referrer"
                  src={editingCloth.image}
                  alt={editingCloth.name}
                  className="w-14 h-14 rounded-xl object-cover bg-white shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-900 truncate">
                    {editingCloth.name}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    현재 카테고리: {editingCloth.category}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-700 mb-1.5">
                  카테고리 변경
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {SLOT_CATEGORIES.map((cat) => {
                    const active = editClothCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => onChangeEditClothCategory(cat.key)}
                        className={`py-2.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                          active
                            ? 'bg-zinc-950 text-white'
                            : 'bg-[#F4F4F5] text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <input
                type="text"
                value={editClothName}
                onChange={(e) => onChangeEditClothName(e.target.value)}
                placeholder="아이템 이름"
                className="w-full px-4 py-3 rounded-2xl bg-[#F4F4F5] text-xs font-bold text-zinc-900 focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editClothSeason}
                  onChange={(e) => onChangeEditClothSeason(e.target.value)}
                  className="px-3.5 py-2.5 rounded-2xl bg-[#F4F4F5] text-xs font-bold text-zinc-900 focus:outline-none"
                >
                  <option value="사계절">사계절</option>
                  <option value="봄/가을">봄/가을</option>
                  <option value="여름">여름</option>
                  <option value="겨울">겨울</option>
                </select>

                <select
                  value={editClothStatus}
                  onChange={(e) =>
                    onChangeEditClothStatus(e.target.value as ClothStatus)
                  }
                  className="px-3.5 py-2.5 rounded-2xl bg-[#F4F4F5] text-xs font-bold text-zinc-900 focus:outline-none"
                >
                  <option value="보유 중">보유 중</option>
                  <option value="구매 예정">구매 예정</option>
                </select>
              </div>

              <div className="rounded-2xl bg-[#F7F7F8] p-3.5 space-y-3">
                <div>
                  <p className="text-[11px] font-bold text-zinc-700 mb-1.5">
                    대표 사진 앞 · 뒤 방향 지정
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'auto' as PhotoSideType, label: '자동 판별' },
                        { id: 'front' as PhotoSideType, label: '앞면 사진' },
                        {
                          id: 'back' as PhotoSideType,
                          label: '뒷면(등판) 사진',
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeEditClothPhotoSide(opt.id)}
                        className={`py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                          editClothPhotoSide === opt.id
                            ? 'bg-zinc-950 text-white'
                            : 'bg-white text-zinc-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="url"
                  value={editClothSourceUrl}
                  onChange={(e) => onChangeEditClothSourceUrl(e.target.value)}
                  placeholder="원본 상품 링크"
                  className="w-full px-3.5 py-2 rounded-xl bg-white text-xs text-zinc-900 focus:outline-none"
                />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-zinc-700">
                      앞면 보조 사진 추가 ({editClothExtraImages.length}/3)
                    </span>
                    {editClothExtraImages.length < 3 && (
                      <label className="text-[10px] font-bold text-zinc-900 underline cursor-pointer">
                        {isUploadingExtraAngle
                          ? '업로드 중...'
                          : '+ 앞면 사진 추가'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onUploadExtraAngleInEdit}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  {editClothExtraImages.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      {editClothExtraImages.map((ex, idx) => (
                        <div
                          key={idx}
                          className="relative w-12 h-14 rounded-xl overflow-hidden bg-white"
                        >
                          <img
                            referrerPolicy="no-referrer"
                            src={ex}
                            alt={`보조 ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => onRemoveEditExtraImage(idx)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[9px] flex items-center justify-center cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onCloseEditCloth}
                  className="px-4 py-2.5 rounded-full bg-[#F4F4F5] text-xs font-bold text-zinc-700 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSavingClothEdit}
                  className="px-5 py-2.5 rounded-full bg-zinc-950 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isSavingClothEdit ? '저장 중...' : '변경 사항 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. 클라우드 소셜 SQL · API · 백업 설정 모달 */}
      {apiModalOpen && (
        <div
          onClick={onCloseApiModal}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 animate-fade-soft"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-950">
                  873oc 시스템 설정
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  소셜 테이블 SQL 복사 · API 키 · 옷장 데이터 백업
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseApiModal}
                className="w-8 h-8 rounded-full bg-[#F4F4F5] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F7F7F8] p-4 space-y-2.5">
              <p className="text-xs font-extrabold text-zinc-950">
                소셜 업데이트 SQL (STYLE 피드 · 옷장 태그 · 팔로우 · 전체공개)
              </p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                아래 버튼으로 SQL을 복사한 뒤 Supabase SQL Editor에 붙여넣고 Run을 한 번만 눌러주시면 모든 유저 간 피드와 팔로우가 실시간 연동됩니다.
              </p>
              <button
                type="button"
                onClick={onCopySocialSql}
                className="px-4 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> 소셜 테이블 SQL 복사하기
              </button>
            </div>

            <form onSubmit={onSaveApiConfig} className="space-y-3">
              <p className="text-xs font-extrabold text-zinc-900">
                선택 설정: 브라우저 개인 API 키 (서버 환경변수 미설정 시 보조용)
              </p>
              <input
                type="password"
                value={cfgForm.geminiKey}
                onChange={(e) =>
                  onChangeCfgForm({ ...cfgForm, geminiKey: e.target.value })
                }
                placeholder="Gemini API Key (Vercel 환경변수 등록 시 비워두세요)"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F4F4F5] text-xs text-zinc-900 focus:outline-none"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-full bg-zinc-950 text-white text-xs font-bold cursor-pointer"
              >
                설정 저장
              </button>
            </form>

            <div className="pt-3 border-t border-[#F1F1F3] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="flex-1 py-2.5 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> JSON 백업
              </button>
              <label className="flex-1 py-2.5 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-xs font-bold text-zinc-800 inline-flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> JSON 복원
                <input
                  type="file"
                  accept=".json"
                  onChange={onImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 5. 고해상도 이미지 확대 뷰어 (Lightbox) */}
      {zoomImageUrl && (
        <div
          onClick={onCloseZoomImage}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-3.5 shadow-2xl space-y-3 animate-fade-soft"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-zinc-950">
                873oc VIEWER
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDownloadImage(zoomImageUrl, '873oc_Image')}
                  className="px-3 py-1.5 rounded-full bg-[#F4F4F5] hover:bg-zinc-200 text-[11px] font-bold text-zinc-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" /> 저장
                </button>
                <button
                  type="button"
                  onClick={onCloseZoomImage}
                  className="w-7 h-7 rounded-full bg-[#F4F4F5] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <img
              referrerPolicy="no-referrer"
              src={zoomImageUrl}
              alt="확대 보기"
              className="w-full max-h-[76vh] object-contain rounded-2xl bg-[#F4F4F5]"
            />
          </div>
        </div>
      )}
    </>
  );
}
