import React from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AuraFit — AI 원터치 옷장 & 듀얼 페르소나 스타일링 플랫폼',
  description:
    '내 옷장 원터치 코디 슬롯, DAY/NIGHT 듀얼 패션 엔진, 쇼핑몰 링크 시뮬레이션 및 오픈 옷장 커뮤니티 플랫폼',
  openGraph: {
    title: 'AuraFit — AI 원터치 옷장 & 듀얼 페르소나 스타일링 플랫폼',
    description:
      '카드를 한 번 터치해 내 옷장 코디를 완성하고 KREAM·무신사 매칭 아이템까지 디깅해 보세요.',
    type: 'website',
    locale: 'ko_KR',
  },
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
      </head>
      <body>{children}</body>
    </html>
  );
}
