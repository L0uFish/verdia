create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric,
  price_label text not null default 'vanaf' constraint products_price_label_check check (price_label in ('vanaf', 'op_aanvraag')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  status text not null default 'available' constraint products_status_check check (status in ('available', 'reserved', 'sold', 'hidden')),
  sold_at timestamptz,
  reserved_until timestamptz,
  sku text,
  deleted_at timestamptz
);

alter table public.products
  add column if not exists status text,
  add column if not exists sold_at timestamptz,
  add column if not exists reserved_until timestamptz,
  add column if not exists sku text,
  add column if not exists deleted_at timestamptz;

alter table public.products
  alter column description set default '',
  alter column price_label set default 'vanaf',
  alter column featured set default false,
  alter column sort_order set default 0,
  alter column created_at set default now(),
  alter column status set default 'available';

update public.products
set status = 'available'
where status is null;

alter table public.products
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_status_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_status_check
      check (status in ('available', 'reserved', 'sold', 'hidden'));
  end if;
end
$$;

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  position integer not null default 1
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Users listed here may access /admin. After creating a user in Supabase Auth, add the same auth.users.id here to grant admin access.';

-- After creating a user in Supabase Auth, grant admin access manually:
-- insert into public.admin_users (user_id, email)
-- values ('00000000-0000-0000-0000-000000000000', 'admin@example.com')
-- on conflict (user_id) do update
-- set email = excluded.email;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

comment on function public.is_admin() is
  'Returns true when the currently authenticated user exists in public.admin_users.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  pickup_note text,
  status text not null default 'pending_payment' constraint orders_status_check check (status in ('pending_payment', 'paid', 'cancelled', 'expired', 'picked_up')),
  mollie_payment_id text,
  total_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz
);

comment on table public.orders is
  'Checkout orders for unique products. TODO: retain orders for 1 year before adding automated cleanup or archival.';

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  product_price numeric not null,
  image_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists products_sku_unique_idx
  on public.products (sku)
  where sku is not null;

create index if not exists products_status_idx
  on public.products (status);

create index if not exists products_sold_at_idx
  on public.products (sold_at desc);

create index if not exists products_reserved_until_idx
  on public.products (reserved_until);

create index if not exists products_deleted_at_idx
  on public.products (deleted_at);

create index if not exists products_sort_order_idx
  on public.products (sort_order, created_at desc);

create index if not exists product_images_product_position_idx
  on public.product_images (product_id, position);

create unique index if not exists orders_order_number_unique_idx
  on public.orders (order_number);

create unique index if not exists orders_mollie_payment_id_unique_idx
  on public.orders (mollie_payment_id)
  where mollie_payment_id is not null;

create index if not exists orders_status_idx
  on public.orders (status);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

create index if not exists orders_expires_at_idx
  on public.orders (expires_at);

create index if not exists orders_deleted_at_idx
  on public.orders (deleted_at);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create index if not exists order_items_product_id_idx
  on public.order_items (product_id);

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table storage.objects enable row level security;

drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can manage products" on public.products;
drop policy if exists "Public can read product images" on public.product_images;
drop policy if exists "Public can manage product images" on public.product_images;

drop policy if exists "Visible products are public" on public.products;
drop policy if exists "Admins can read all products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

drop policy if exists "Visible product images are public" on public.product_images;
drop policy if exists "Admins can read all product images" on public.product_images;
drop policy if exists "Admins can insert product images" on public.product_images;
drop policy if exists "Admins can update product images" on public.product_images;
drop policy if exists "Admins can delete product images" on public.product_images;

drop policy if exists "Admins can read admin users" on public.admin_users;

drop policy if exists "Admins can read orders" on public.orders;
drop policy if exists "Admins can insert orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can delete orders" on public.orders;

drop policy if exists "Admins can read order items" on public.order_items;
drop policy if exists "Admins can insert order items" on public.order_items;
drop policy if exists "Admins can update order items" on public.order_items;
drop policy if exists "Admins can delete order items" on public.order_items;

create policy "Visible products are public"
  on public.products
  for select
  to anon, authenticated
  using (deleted_at is null and status in ('available', 'reserved', 'sold'));

create policy "Admins can read all products"
  on public.products
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert products"
  on public.products
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update products"
  on public.products
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete products"
  on public.products
  for delete
  to authenticated
  using (public.is_admin());

create policy "Visible product images are public"
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
        and products.deleted_at is null
        and products.status in ('available', 'reserved', 'sold')
    )
  );

create policy "Admins can read all product images"
  on public.product_images
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert product images"
  on public.product_images
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update product images"
  on public.product_images
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete product images"
  on public.product_images
  for delete
  to authenticated
  using (public.is_admin());

create policy "Admins can read admin users"
  on public.admin_users
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can read orders"
  on public.orders
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert orders"
  on public.orders
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update orders"
  on public.orders
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete orders"
  on public.orders
  for delete
  to authenticated
  using (public.is_admin());

create policy "Admins can read order items"
  on public.order_items
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert order items"
  on public.order_items
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update order items"
  on public.order_items
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete order items"
  on public.order_items
  for delete
  to authenticated
  using (public.is_admin());

update storage.buckets
set public = true
where id = 'verdia-products';

-- Storage notes:
-- - The verdia-products bucket stays public so existing product image URLs keep working.
-- - Public read access is fine for storefront images.
-- - TODO: keep all upload/update/delete access limited to authenticated admins only.
drop policy if exists "Public can view Verdia product storage" on storage.objects;
drop policy if exists "Public can upload Verdia product storage" on storage.objects;
drop policy if exists "Public can update Verdia product storage" on storage.objects;
drop policy if exists "Public can delete Verdia product storage" on storage.objects;
drop policy if exists "Verdia product storage is publicly readable" on storage.objects;
drop policy if exists "Authenticated admins can upload Verdia product storage" on storage.objects;
drop policy if exists "Authenticated admins can update Verdia product storage" on storage.objects;
drop policy if exists "Authenticated admins can delete Verdia product storage" on storage.objects;

create policy "Verdia product storage is publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'verdia-products');

create policy "Authenticated admins can upload Verdia product storage"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'verdia-products' and public.is_admin());

create policy "Authenticated admins can update Verdia product storage"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'verdia-products' and public.is_admin())
  with check (bucket_id = 'verdia-products' and public.is_admin());

create policy "Authenticated admins can delete Verdia product storage"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'verdia-products' and public.is_admin());
