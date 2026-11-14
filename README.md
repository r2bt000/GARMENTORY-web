# AuraFit — 1단계 Next.js 정식 전환 & Vercel 실서버 배포 가이드

이 프로젝트는 **AuraFit(AI 원터치 옷장 & 듀얼 페르소나 스타일링 플랫폼)**을 모듈 경로 에러 없이 바로 빌드·배포할 수 있도록 구성한 [Next.js App Router](https://nextjs.org/docs/app) 정식 프로젝트입니다.

기존 단일 HTML 프로토타입과 달리 아래 실서비스용 구조가 미리 반영되어 있습니다:

- **백엔드 API 키 보안 분리 (`app/api/stylist/route.ts`)**: 브라우저에 [Gemini API 키](https://aistudio.google.com/docs/api-key)를 노출하지 않고 서버 환경변수(`GEMINI_API_KEY`)에서만 안전하게 호출합니다(키 미입력 시 무료 내장 코디 엔진으로 자동 작동).
- **쇼핑몰 링크 서버 추출기 (`app/api/scrape/route.ts`)**: 브라우저 보안 차단을 피해 서버가 직접 무신사·KREAM·29CM·ZARA 상품의 제목, 썸네일, 가격, 카테고리를 자동 분류합니다.
- **SNS 공유 메타데이터 (`app/layout.tsx`)**: 카카오톡·인스타그램에 사이트 주소를 공유할 때 제목과 설명 카드가 깔끔하게 표시됩니다.

## 프로젝트 폴더 구조

| 경로 | 역할 |
| :--- | :--- |
| `package.json` | [Next.js 14](https://nextjs.org/docs), React 18, Tailwind CSS, Lucide 아이콘, Supabase 패키지 목록 |
| `next.config.mjs` | [Vercel 배포 환경](https://vercel.com/docs/frameworks/full-stack/nextjs) 빌드 안정성 설정 |
| `app/layout.tsx` | 전역 폰트 로드 및 오픈그래프 공유 메타데이터 설정 |
| `app/page.tsx` | 메인 진입 페이지 |
| `app/AuraFitClient.tsx` | 내 옷장, 원터치 슬롯, DAY/NIGHT 전환, 커뮤니티 프로필 전체 UI |
| `app/api/stylist/route.ts` | 서버 전용 AI 코디 디렉터 분석 엔드포인트 |
| `app/api/scrape/route.ts` | 쇼핑몰 URL 메타데이터 및 카테고리 자동 파싱 서버 엔드포인트 |
| `.env.example` | 서버 환경변수 이름 참고용 템플릿 |

## 방법 A: 프로그램 설치 없이 웹 브라우저만으로 5분 만에 배포하기 (가장 쉬운 방법)

내 PC에 Node.js나 에디터가 없어도 **웹 브라우저만으로** 실제 `https://...vercel.app` 주소를 만들 수 있습니다.

### 1. 압축 풀기
1. 다운로드한 `aurafit-nextjs.zip` 파일의 압축을 풉니다.
2. 압축이 풀린 `aurafit-nextjs` 폴더 안으로 들어가면 `app` 폴더와 `package.json`, `next.config.mjs` 등의 파일들이 보입니다.

### 2. GitHub 새 저장소 만들고 파일 올리기
1. [GitHub 새 저장소 생성 페이지](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)를 참고해 GitHub 우측 상단 `+` 버튼 → **New repository**를 클릭합니다.
2. **Repository name**에 `aurafit-web`을 입력하고, 아래 체크박스(`Add a README file` 등)는 **체크하지 않은 빈 상태**로 **Create repository**를 클릭합니다.
3. 생성된 화면의 안내 문구 중 **uploading an existing file** 링크를 클릭합니다([GitHub 파일 업로드 공식 안내](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)).
4. **중요 체크포인트**: `aurafit-nextjs` 바깥 폴더 통째로가 아니라, 폴더 **안쪽에 들어 있는 모든 항목(`app` 폴더, `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `README.md` 등)을 전체 선택해서** 업로드 창으로 드래그 앤 드롭합니다.
5. 업로드 목록이 다 채워지면 하단 초록색 **Commit changes** 버튼을 누릅니다.

### 3. Vercel에서 연결해 실제 사이트 주소 발급받기
1. [Vercel GitHub 연동 배포 가이드](https://vercel.com/docs/git/vercel-for-github)에 따라 Vercel에 GitHub 계정으로 로그인한 뒤 우측 상단 **Add New...** → **Project**를 클릭합니다.
2. 방금 만든 `aurafit-web` 저장소 옆의 **Import** 버튼을 클릭합니다.
3. **Framework Preset**이 자동으로 `Next.js`로 잡혀 있는 것을 확인합니다(별도 수정 불필요).
4. 바로 **Deploy** 버튼을 누르고 약 1분 정도 기다리면 폭죽 화면과 함께 실제 접속 가능한 `https://aurafit-web-xxx.vercel.app` 주소가 생성됩니다! (개인·초기 베타 운영은 [Vercel Hobby 무료 플랜](https://vercel.com/docs/plans/hobby)으로 과금 없이 유지됩니다.)

## 방법 B: VS Code 또는 Cursor 에디터로 내 PC에서 실행 후 배포하기

PC에 Node.js(18 이상)와 에디터가 설치되어 있다면 로컬에서 먼저 화면을 띄워 보고 올릴 수 있습니다.

```bash
# 1. 압축 푼 폴더로 이동
cd aurafit-nextjs

# 2. 패키지 설치
npm install

# 3. 로컬 개발 서버 실행 (http://localhost:3000 접속)
npm run dev

# 4. 프로덕션 빌드 사전 점검
npm run build
```

이후 터미널이나 VS Code·Cursor의 Source Control 탭에서 GitHub 저장소로 Push하면 [Vercel 자동 배포](https://vercel.com/docs/deployments)가 코드 변경 때마다 실시간으로 반영됩니다.

## 선택 사항: 서버에 Gemini API 키 안전하게 숨겨 연결하기

기본 상태에서도 내장 코디 엔진으로 무료 작동하지만, 실시간 Gemini AI 디렉터 분석을 켜고 싶다면 코드 수정 없이 [Vercel 환경변수 설정](https://vercel.com/docs/environment-variables)만 추가하면 됩니다:

1. Vercel 프로젝트 대시보드 상단 **Settings** → 좌측 **Environment Variables** 메뉴로 이동합니다.
2. Key 칸에 `GEMINI_API_KEY`, Value 칸에 [Google AI Studio API 키](https://aistudio.google.com/docs/api-key)를 붙여넣고 **Save**를 누릅니다.
3. 상단 **Deployments** 탭에서 가장 최근 배포 우측 점 3개(`⋯`) → **Redeploy**를 누르면 브라우저 노출 없이 서버 전용 AI 분석이 즉시 활성화됩니다.

## 다음 진행 순서 (2단계 예고)

1단계 배포 주소(`https://...vercel.app`)가 정상적으로 열리는 것이 확인되면, 이어서 **2단계([Supabase Auth](https://supabase.com/docs/guides/auth) 소셜 로그인 + 유저별 옷장 테이블 분리 + [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) 권한 적용)**를 이 프로젝트 위에 바로 연결합니다.
