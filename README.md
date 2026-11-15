# OBLIQUE (AuraFit) — AI 원터치 옷장 & 듀얼 페르소나 스타일링 플랫폼 (Step 3: Supabase Storage & WebP)

[Next.js App Router](https://nextjs.org/docs/app)(보안 패치 `14.2.35`), [Supabase Auth](https://supabase.com/docs/guides/auth)(이메일 · Google · Kakao), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), 그리고 3단계 [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/creating-buckets) + 브라우저 WebP 자동 압축 업로드가 적용된 프로덕션 버전입니다.

## 빠른 시작 및 업데이트 순서

1. **2단계 테이블 생성 (완료된 경우 생략)**: Supabase 프로젝트의 **SQL Editor**에서 `supabase/schema_step2.sql`을 실행합니다.
2. **3단계 의류 이미지 스토리지 버킷 생성**: Supabase **SQL Editor**에서 `supabase/schema_step3_storage.sql` 전체 내용을 붙여넣고 **Run**을 클릭하면 `wardrobe-images` 버킷과 폴더별 [스토리지 RLS 정책](https://supabase.com/docs/guides/storage/security/access-control)이 한 번에 생성됩니다.
3. **환경변수 확인**: [Vercel 환경변수](https://vercel.com/docs/environment-variables/managing-environment-variables)에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 등록되어 있으면 별도 추가 환경변수 없이 즉시 클라우드 이미지 스토리지가 작동합니다.
4. **배포**: 파일들을 GitHub 저장소(`r2bt000/GARMENTORY-web`)에 덮어써서 커밋하면 [Vercel](https://vercel.com/docs/git/vercel-for-github)이 자동으로 최신 버전을 빌드·배포합니다.
