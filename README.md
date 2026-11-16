# OBLIQUE — AI 디지털 옷장 & 화이트 스튜디오 클린 모델샷 플랫폼 (Step 5 완성본)

[Next.js App Router](https://nextjs.org/docs/app)(`14.2.35`), [Vercel 서울 리전(`icn1`)](https://vercel.com/docs/regions), [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/creating-buckets) WebP 자동 경량화, 쇼핑몰 링크 실물 이미지 파서(`/api/scrape`), 의류 등록 후 카테고리·정보 수정 기능, 그리고 5단계 [Gemini 2.5 Flash Image](https://aistudio.google.com/docs/image-generation) 기반 **화이트 호리존 스튜디오 AI 클린 모델샷 & 내 사진 가상 피팅 엔진(`/api/lookbook`)**이 통합된 프로덕션 코드베이스입니다.

## 핵심 구성 및 배포 순서

1. **GitHub 덮어쓰기 업로드**: 압축 해제 후 폴더 안의 파일들을 `r2bt000/GARMENTORY-web` 저장소 루트에 업로드하고 `Commit changes`를 클릭하면 [Vercel GitHub 연동](https://vercel.com/docs/git/vercel-for-github)으로 자동 배포됩니다.
2. **`GEMINI_API_KEY` 등록**: [Google AI Studio API Key 문서](https://aistudio.google.com/docs/api-key) 안내에 따라 발급한 키를 [Vercel Environment Variables](https://vercel.com/docs/environment-variables/managing-environment-variables)에 `GEMINI_API_KEY` 이름으로 추가한 뒤 1회 **Redeploy**하면 AI 코디 노트와 화이트 스튜디오 클린 모델샷이 즉시 활성화됩니다.
3. **추가 DB 작업 불필요**: 생성된 스튜디오 모델샷은 기존 3단계 `wardrobe-images` 버킷([Supabase Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control))에 WebP로 자동 업로드되며 `saved_looks`에 영구 보관됩니다.
