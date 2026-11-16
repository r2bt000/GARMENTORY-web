# 873oc — AI 디지털 옷장 & 정면 화이트 스튜디오 모델샷 플랫폼

[Next.js App Router](https://nextjs.org/docs/app)(`14.2.35`), [Vercel 서울 리전(`icn1`)](https://vercel.com/docs/regions), [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/creating-buckets) WebP 자동 경량화, 쇼핑몰 링크 실물 이미지 파서(`/api/scrape`), 의류 등록 후 카테고리·정보·앞뒷면 방향 수정 기능, 그리고 [Gemini 2.5 Flash Image](https://aistudio.google.com/docs/image-generation) 기반 **정면 화이트 호리존 스튜디오 AI 클린 모델샷 & 내 사진 가상 피팅 엔진(`/api/lookbook`)**이 통합된 `873oc` 공식 코드베이스입니다.

## 핵심 구성 및 배포 순서

1. **GitHub 덮어쓰기 업로드**: 압축 해제 후 폴더 안의 파일들을 `r2bt000/GARMENTORY-web` 저장소 루트에 업로드하고 `Commit changes`를 클릭하면 [Vercel GitHub 연동](https://vercel.com/docs/git/vercel-for-github)으로 자동 배포됩니다.
2. **`873oc.vercel.app` 도메인 연결**: [Vercel Domains 설정](https://vercel.com/docs/domains/working-with-domains/add-a-domain)에서 `873oc.vercel.app`을 추가하고, [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) 및 Kakao Developers 플랫폼 Web 도메인에 `https://873oc.vercel.app`을 추가합니다.
3. **추가 DB 작업 불필요**: 기존 클라우드 옷장에 등록된 모든 의류(`wardrobe_items`)와 `wardrobe-images` 버킷 데이터는 도메인·브랜드 변경 후에도 그대로 유지됩니다.
