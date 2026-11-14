# AuraFit — AI 원터치 옷장 & 듀얼 페르소나 스타일링 플랫폼 (Step 2: Supabase Auth & RLS)

[Next.js App Router](https://nextjs.org/docs/app) 및 [Supabase Auth](https://supabase.com/docs/guides/auth) · [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)가 적용된 멀티유저 버전입니다.

## 빠른 시작 순서

1. Supabase 프로젝트의 **SQL Editor**에서 `supabase/schema_step2.sql` 전체 내용을 붙여넣고 **Run**을 실행합니다.
2. [Vercel 환경변수](https://vercel.com/docs/environment-variables)(또는 로컬 `.env.local`)에 아래 값을 설정합니다:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (선택)
3. 로컬 테스트 시 `npm install && npm run dev`로 실행하거나 GitHub에 커밋해 [Vercel](https://vercel.com/docs/git/vercel-for-github)에 자동 배포합니다.
