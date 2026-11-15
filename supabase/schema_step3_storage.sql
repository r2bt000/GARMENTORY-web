-- =====================================================================
-- OBLIQUE (AuraFit) 3단계: Supabase Storage 의류 이미지 전용 버킷 & RLS 보안 정책
-- 실행 위치: Supabase Dashboard -> SQL Editor -> New Query 붙여넣기 후 [Run] 클릭
-- 공식 참고: https://supabase.com/docs/guides/storage/buckets/creating-buckets
--           https://supabase.com/docs/guides/storage/security/access-control
-- =====================================================================

-- 1. 의류 사진 전용 퍼블릭 버킷(wardrobe-images) 생성 (5MB 한도, 이미지 MIME 제한)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wardrobe-images',
  'wardrobe-images',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. 기존 동일 이름 정책 충돌 방지용 초기화
drop policy if exists "Public can view wardrobe images" on storage.objects;
drop policy if exists "Users can upload own wardrobe images" on storage.objects;
drop policy if exists "Users can update own wardrobe images" on storage.objects;
drop policy if exists "Users can delete own wardrobe images" on storage.objects;

-- 3. 조회(SELECT): 오픈 옷장 갤러리·룩북·추후 AI 가상 피팅 렌더링을 위해 퍼블릭 조회 허용
create policy "Public can view wardrobe images"
  on storage.objects for select
  using ( bucket_id = 'wardrobe-images' );

-- 4. 업로드(INSERT): 로그인한 본인 폴더({user_id}/파일명.webp)에만 업로드 허용
create policy "Users can upload own wardrobe images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- 5. 수정(UPDATE): 본인 폴더 내 이미지에 한해 수정 허용
create policy "Users can update own wardrobe images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- 6. 삭제(DELETE): 옷장에서 옷을 지울 때 본인 스토리지 파일만 함께 삭제 가능
create policy "Users can delete own wardrobe images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
