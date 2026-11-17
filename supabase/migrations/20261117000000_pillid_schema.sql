-- PillID schema: per-user medicine cabinet, private pill photos, API usage log.
-- Safe to run on a fresh project or on one that already has the original
-- single-user `medications` table and public `pill-images` bucket.

-- ───────────────────────── medications ─────────────────────────
create table if not exists public.medications (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand_name  text,
  rxcui       text,
  strength    text,
  dosage_form text,
  imprint     text,
  shape       text,
  color       text,
  ndc         text,
  confidence  integer,
  notes       text,
  image_path  text,
  label_data  jsonb,
  created_at  timestamptz not null default now()
);

alter table public.medications
  add column if not exists user_id uuid default auth.uid()
  references auth.users (id) on delete cascade;

-- Rows saved before sign-in existed have no owner and stay hidden by RLS.
-- Only enforce NOT NULL when there are none, so this never fails or deletes data.
do $$
begin
  if not exists (select 1 from public.medications where user_id is null) then
    alter table public.medications alter column user_id set not null;
  end if;
end $$;

create index if not exists medications_user_created_idx
  on public.medications (user_id, created_at desc);

alter table public.medications enable row level security;

-- Replace whatever policies exist (the original one allowed everyone everything).
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'medications'
  loop
    execute format('drop policy %I on public.medications', p.policyname);
  end loop;
end $$;

create policy "medications: owner can read" on public.medications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "medications: owner can insert" on public.medications
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "medications: owner can update" on public.medications
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "medications: owner can delete" on public.medications
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ───────────────────────── api_usage ─────────────────────────
-- One row per call to a route that costs money (model calls). The API routes
-- count a user's rows from the last 24h to enforce a daily limit. Users can
-- add and read their own rows but never update or delete them.
create table if not exists public.api_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  route      text not null check (route in ('identify', 'interactions')),
  created_at timestamptz not null default now()
);

create index if not exists api_usage_user_route_created_idx
  on public.api_usage (user_id, route, created_at desc);

alter table public.api_usage enable row level security;

drop policy if exists "api_usage: owner can read" on public.api_usage;
drop policy if exists "api_usage: owner can insert" on public.api_usage;
create policy "api_usage: owner can read" on public.api_usage
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "api_usage: owner can insert" on public.api_usage
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ───────────────────────── pill photos ─────────────────────────
-- Private bucket; each user's photos live under a folder named after their id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pill-images', 'pill-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop any earlier policies written for this bucket (the original was public).
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual, '') like '%pill-images%' or coalesce(with_check, '') like '%pill-images%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "pill-images: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'pill-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pill-images: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pill-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pill-images: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pill-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
