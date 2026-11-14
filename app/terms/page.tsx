import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '서비스 이용약관 (Terms of Service) — OBLIQUE',
  description: 'OBLIQUE AI 디지털 옷장 및 스타일링 플랫폼 서비스 이용약관',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] text-zinc-900 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-zinc-200 p-6 sm:p-10 shadow-sm space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-5 gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-rose-500">
              TERMS OF SERVICE
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              OBLIQUE 서비스 이용약관
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              시행일자: 2026년 11월 15일
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:opacity-90 transition"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">제1조 (목적)</h2>
          <p>
            본 약관은 <strong>OBLIQUE</strong>(이하 &ldquo;서비스&rdquo;)가
            제공하는 AI 디지털 옷장 아카이빙, 스타일링 추천 및 오픈 옷장 커뮤니티
            기능의 이용 조건과 운영 기준을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">
            제2조 (주요 제공 기능 및 외부 쇼핑몰 링크)
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>보유 의류 및 구매 예정 위시템의 이미지·링크 등록 및 관리</li>
            <li>원터치 슬롯 기반 AI 스타일링 분석 및 코디 룩북 보관</li>
            <li>이용자 간 오픈 옷장 열람 및 코디 제안 커뮤니티</li>
            <li>
              외부 쇼핑 플랫폼(KREAM, 무신사, 에이블리, 네이버 쇼핑 등) 검색 연결은
              이용자 편의를 위한 참고 링크이며, 실제 상품 구매 계약 및 배송·환불
              책임은 각 판매 플랫폼에 있습니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">
            제3조 (회원의 의무 및 게시물 관리)
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              이용자는 타인의 권리를 침해하거나 불쾌감을 주는 불법·부적절한
              이미지를 업로드해서는 안 됩니다.
            </li>
            <li>
              이용자가 직접 등록한 의류 사진 및 코디 콘텐츠의 권리는 이용자에게
              있으며, 오픈 옷장 공개 옵션을 활성화한 경우에 한해 커뮤니티 내
              열람이 허용됩니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">
            제4조 (서비스 변경 및 문의)
          </h2>
          <p>
            서비스는 품질 향상을 위해 기능이나 UI를 개선·변경할 수 있으며, 서비스
            이용 관련 문의는 아래 이메일로 접수할 수 있습니다.
          </p>
          <p className="font-semibold text-zinc-900">
            고객지원 이메일: guswodnjs0330@gmail.com
          </p>
        </section>

        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
          <span>© 2026 OBLIQUE. All rights reserved.</span>
          <Link
            href="/privacy"
            className="text-zinc-600 hover:underline font-medium"
          >
            개인정보처리방침 보기 →
          </Link>
        </div>
      </div>
    </main>
  );
}
