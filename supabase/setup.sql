create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric,
  price_label text not null default 'vanaf' check (price_label in ('vanaf', 'op_aanvraag')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  position integer not null default 1
);

create index if not exists products_sort_order_idx
  on public.products (sort_order, created_at desc);

create index if not exists product_images_product_position_idx
  on public.product_images (product_id, position);

alter table public.products enable row level security;
alter table public.product_images enable row level security;

drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can manage products" on public.products;
drop policy if exists "Public can read product images" on public.product_images;
drop policy if exists "Public can manage product images" on public.product_images;

create policy "Public can read products"
  on public.products
  for select
  to anon
  using (true);

create policy "Public can manage products"
  on public.products
  for all
  to anon
  using (true)
  with check (true);

create policy "Public can read product images"
  on public.product_images
  for select
  to anon
  using (true);

create policy "Public can manage product images"
  on public.product_images
  for all
  to anon
  using (true)
  with check (true);

update storage.buckets
set public = true
where id = 'verdia-products';

drop policy if exists "Public can view Verdia product storage" on storage.objects;
drop policy if exists "Public can upload Verdia product storage" on storage.objects;
drop policy if exists "Public can update Verdia product storage" on storage.objects;
drop policy if exists "Public can delete Verdia product storage" on storage.objects;

create policy "Public can view Verdia product storage"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'verdia-products');

create policy "Public can upload Verdia product storage"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'verdia-products');

create policy "Public can update Verdia product storage"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'verdia-products')
  with check (bucket_id = 'verdia-products');

create policy "Public can delete Verdia product storage"
  on storage.objects
  for delete
  to anon
  using (bucket_id = 'verdia-products');
