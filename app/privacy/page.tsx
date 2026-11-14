import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보처리방침 (Privacy Policy) — OBLIQUE',
  description: 'OBLIQUE AI 디지털 옷장 및 스타일링 플랫폼 개인정보처리방침',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] text-zinc-900 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-zinc-200 p-6 sm:p-10 shadow-sm space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-5 gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-rose-500">
              PRIVACY POLICY
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              OBLIQUE 개인정보처리방침
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
          <p>
            <strong>OBLIQUE</strong>(이하 &ldquo;서비스&rdquo;, 도메인:{' '}
            <code>https://garmentory-web.vercel.app</code>)는 이용자의
            개인정보를 중요시하며 관련 법령 및 Google OAuth 2.0 사용자 데이터
            보호 정책을 준수합니다. 본 방침은 서비스가 어떤 정보를 수집하고
            어떻게 활용·보호하는지 안내합니다.
          </p>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">
            1. 수집하는 개인정보 항목 및 수집 방법
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>회원가입 및 소셜 로그인(Google, 카카오, 이메일)</strong>:
              이메일 주소, 기본 프로필 이름(닉네임), 프로필 이미지 URL(선택),
              고유 계정 식별자(UID)
            </li>
            <li>
              <strong>서비스 이용 과정 생성 데이터</strong>: 이용자가 직접
              등록한 의류 이미지, 쇼핑몰 상품 URL, 저장한 코디 룩북 및 오픈 옷장
              코디 제안 내역
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">
            2. 개인정보의 수집 및 이용 목적 (Google User Data Disclosure)
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>이용자 본인 식별, 계정 로그인 유지 및 기기 간 디지털 옷장 동기화</li>
            <li>AI 코디 스타일링 분석 및 맞춤형 착장 추천 제공</li>
            <li>이용자가 공개 설정한 오픈 옷장 커뮤니티 프로필 표시</li>
            <li>
              <strong>Google 사용자 데이터 보호 원칙</strong>: Google 로그인을
              통해 전달받은 이메일 및 기본 프로필 정보는 오직 계정 인증과 서비스
              내 프로필 표시 목적으로만 사용되며, 제3자에게 판매하거나 광고
              타겟팅 목적으로 공유하지 않습니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">
            3. 개인정보의 보관 기간 및 파기 절차
          </h2>
          <p>
            이용자의 개인정보 및 옷장 데이터는 회원 탈퇴 시 또는 이용자의 삭제
            요청 시 지체 없이 영구 파기됩니다. 서비스 내에 등록한 개별 의류 및
            룩북 데이터는 이용자가 언제든지 직접 삭제할 수 있습니다.
          </p>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700">
          <h2 className="text-base font-bold text-zinc-900">
            4. 데이터 보안 및 클라우드 위탁 안내
          </h2>
          <p>
            서비스는 안전한 인증 및 데이터베이스 보관을 위해 암호화 통신(HTTPS)과
            행 단위 접근 제어(Supabase Row Level Security)를 적용하여 본인 외
            무단 수정 및 삭제를 차단합니다.
          </p>
        </section>

        <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-700 border-t border-zinc-200 pt-5">
          <h2 className="text-base font-bold text-zinc-900">
            5. 개인정보 보호 문의처
          </h2>
          <p>
            서비스 이용 중 개인정보 열람·정정·삭제 요청 및 관련 문의는 아래
            연락처로 접수해 주시면 신속히 안내해 드립니다.
          </p>
          <p className="font-semibold text-zinc-900">
            문의 이메일: guswodnjs0330@gmail.com
          </p>
        </section>

        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
          <span>© 2026 OBLIQUE. All rights reserved.</span>
          <Link href="/terms" className="text-zinc-600 hover:underline font-medium">
            서비스 이용약관 보기 →
          </Link>
        </div>
      </div>
    </main>
  );
}
