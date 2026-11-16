# 873oc — 패션 뉴스레터 · STYLE 피드 · AI 스튜디오 · 디지털 옷장 (v2 미니멀 개편본)

[하입비스트 코리아](https://hypebeast.kr/)와 KREAM 감성의 순백색 무테두리(Borderless) 미니멀 UI로 전면 개편된 **`873oc`(`https://873oc.vercel.app`)** 공식 프로덕션 코드베이스입니다.

## 주요 구성 (`HOME` · `STYLE` · `STUDIO` · `MY`)

1. **`HOME` (자동 발행 패션 뉴스레터 & 영문→한국어 AI 번역)**: 국내외 패션·스니커즈 매거진 피드를 실시간 수집하며, 영문 기사는 [Gemini API](https://aistudio.google.com/docs/api-key)(`gemini-2.5-flash`)가 헤드라인·리드문·본문 전체를 자연스러운 한국어 매거진 문체로 자동 번역합니다.
2. **`STYLE` (착샷 피드 & 내 옷장 아이템 태그)**: 직접 찍은 데일리 착샷 사진에 내 옷장 아이템을 착용 상품으로 태그해 올리고 좋아요·댓글을 나눌 수 있습니다.
3. **`MY` (마이페이지 · 프로필)**: 상단에 **게시물 수 · 팔로워 · 팔로잉 · 옷장 수**가 한눈에 표시되며, 내가 올린 게시물·내 옷장·저장된 룩북·받은 코디 제안을 탭으로 전환해 볼 수 있습니다.
4. **타 사용자 프로필 옷장 코디 제안**: `STYLE` 피드나 유저 검색에서 다른 사용자의 아이디(`@핸들`)를 눌러 상대 프로필로 들어간 뒤, 전체 공개된 옷장 탭에서 아이템을 조합해 코디를 제안할 수 있습니다.
5. **`STUDIO` (정면 화이트 스튜디오 모델샷)**: [Gemini 2.5 Flash Image](https://aistudio.google.com/docs/image-generation) 기반으로 깔끔한 정면 화이트 스튜디오 모델샷 1장을 단독 촬영합니다.

## 배포 순서 (2분 완료)

1. 압축 해제한 파일 전체를 GitHub 저장소 루트에 덮어쓰기 업로드하고 `Commit changes`를 클릭하면 [Vercel GitHub 연동](https://vercel.com/docs/git/vercel-for-github)으로 자동 배포됩니다.
2. `supabase/schema_step6_social.sql` 파일 내용을 복사해 Supabase Dashboard → `SQL Editor`에 붙여넣고 `Run`을 1회 클릭하면 기존 옷장 데이터 손실 없이 `STYLE` 게시물·착용 태그·좋아요·댓글·팔로우·전체공개 옷장이 즉시 활성화됩니다.
