import React from 'react';
import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = 'https://873oc.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '873oc — AI 디지털 옷장 & 코디 스타일링 플랫폼',
    template: '%s | 873oc',
  },
  description:
    '873oc는 내 옷장 아카이브, 쇼핑몰 링크(무신사·KREAM·29CM) 자동 등록, 화이트 스튜디오 AI 정면 모델샷 및 오픈 옷장 코디를 지원하는 AI 디지털 옷장 플랫폼입니다.',
  applicationName: '873oc',
  keywords: [
    '873oc',
    '873OC',
    '873oc 옷장',
    '873oc 코디',
    'AI 디지털 옷장',
    'AI 코디 추천',
    '온라인 옷장 정리',
    'AI 가상 피팅',
    '룩북 아카이브',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'yPywHl0eiTa5szSUpU6Qg3Z5ksfi1SMkvZ0RhBRqzqQ',
  },
  openGraph: {
    title: '873oc — AI 디지털 옷장 & 코디 스타일링 플랫폼',
    description:
      '무신사·KREAM 링크와 사진으로 나만의 클라우드 옷장을 만들고 화이트 스튜디오 AI 정면 모델샷으로 코디를 완성해 보세요.',
    url: SITE_URL,
    siteName: '873oc',
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '873oc — AI 디지털 옷장 & 코디 스타일링',
    description:
      '나만의 클라우드 디지털 옷장과 화이트 스튜디오 AI 정면 모델샷 플랫폼, 873oc.',
  },
};

const structuredDataJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: '873oc',
      alternateName: ['873OC', '873oc 옷장', '873oc Closet'],
      url: SITE_URL,
      inLanguage: 'ko-KR',
    },
    {
      '@type': 'WebApplication',
      name: '873oc',
      alternateName: '873oc AI 옷장',
      url: SITE_URL,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      description:
        '쇼핑몰 링크 자동 파싱과 화이트 스튜디오 AI 정면 착장 모델샷을 지원하는 클라우드 디지털 옷장 플랫폼',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,600;1,600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredDataJsonLd),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
