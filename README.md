# OBLIQUE — AI 디지털 옷장 & 핀터레스트 Style-Lock 착장 화보 플랫폼 (Step 5 완성본)

[Next.js App Router](https://nextjs.org/docs/app)(`14.2.35`), [Vercel 서울 리전(`icn1`)](https://vercel.com/docs/regions), [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/creating-buckets) WebP 자동 경량화, 4단계 쇼핑몰 링크 실물 이미지 파서(`/api/scrape`), 그리고 5단계 [Gemini 2.5 Flash Image](https://aistudio.google.com/docs/image-generation) 기반 **핀터레스트 무드 고정(Style-Lock) AI 착장 화보 & 내 사진 가상 피팅 스튜디오(`/api/lookbook`)**가 통합된 프로덕션 코드베이스입니다.

## 핵심 구성 및 배포 순서

1. **GitHub 덮어쓰기 업로드**: 압축 해제 후 폴더 안의 파일들을 `r2bt000/GARMENTORY-web` 저장소 루트에 업로드하고 `Commit changes`를 클릭하면 [Vercel GitHub 연동](https://vercel.com/docs/git/vercel-for-github)으로 자동 배포됩니다.
2. **`GEMINI_API_KEY` 등록**: [Google AI Studio API Key 문서](https://aistudio.google.com/docs/api-key) 안내에 따라 발급한 키를 [Vercel Environment Variables](https://vercel.com/docs/environment-variables/managing-environment-variables)에 `GEMINI_API_KEY` 이름으로 추가한 뒤 1회 **Redeploy**하면 AI 코디 노트와 실사 착장 화보·내 사진 가상 피팅이 즉시 활성화됩니다.
3. **추가 DB 작업 불필요**: 생성된 AI 착장 화보는 기존 3단계 `wardrobe-images` 버킷([Supabase Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control))에 WebP로 자동 업로드되며 `saved_looks.items_json`에 영구 기록됩니다.
