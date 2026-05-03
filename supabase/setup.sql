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

alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
  check (status in ('available', 'reserved', 'sold', 'hidden'));

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
  status text not null default 'draft' constraint orders_status_check check (status in ('draft', 'reserved', 'paid', 'cancelled', 'expired', 'fulfilled')),
  payment_status text not null default 'open' constraint orders_payment_status_check check (payment_status in ('open', 'paid', 'failed', 'expired', 'cancelled', 'pending')),
  mollie_payment_id text,
  total_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  customer_user_id uuid,
  reservation_expires_at timestamptz,
  mollie_checkout_url text,
  payment_method text,
  webhook_last_processed_at timestamptz
);

comment on table public.orders is
  'Checkout orders for unique products. TODO: retain orders for 1 year before adding automated cleanup or archival.';

alter table public.orders
  add column if not exists customer_user_id uuid,
  add column if not exists payment_status text,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists mollie_checkout_url text,
  add column if not exists payment_method text,
  add column if not exists webhook_last_processed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_user_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_customer_user_id_fkey
      foreign key (customer_user_id)
      references auth.users (id)
      on delete set null;
  end if;
end
$$;

alter table public.orders
  alter column status set default 'draft',
  alter column payment_status set default 'open',
  alter column total_amount set default 0,
  alter column created_at set default now();

update public.orders
set status = case
  when status = 'pending_payment' then 'draft'
  when status = 'picked_up' then 'fulfilled'
  when status is null then 'draft'
  else status
end;

update public.orders
set payment_status = case
  when payment_status is not null then payment_status
  when status in ('paid', 'fulfilled') then 'paid'
  when status = 'cancelled' then 'cancelled'
  when status = 'expired' then 'expired'
  else 'open'
end
where payment_status is null;

alter table public.orders
  alter column status set not null,
  alter column payment_status set not null;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('draft', 'reserved', 'paid', 'cancelled', 'expired', 'fulfilled'));

alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('open', 'paid', 'failed', 'expired', 'cancelled', 'pending'));

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  product_price numeric not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.products
  add column if not exists reserved_order_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_reserved_order_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_reserved_order_id_fkey
      foreign key (reserved_order_id)
      references public.orders (id)
      on delete set null;
  end if;
end
$$;

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

create index if not exists products_reserved_order_id_idx
  on public.products (reserved_order_id);

create index if not exists product_images_product_position_idx
  on public.product_images (product_id, position);

create unique index if not exists orders_order_number_unique_idx
  on public.orders (order_number);

create unique index if not exists orders_mollie_payment_id_unique_idx
  on public.orders (mollie_payment_id)
  where mollie_payment_id is not null;

create index if not exists orders_status_idx
  on public.orders (status);

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

create index if not exists orders_expires_at_idx
  on public.orders (expires_at);

create index if not exists orders_reservation_expires_at_idx
  on public.orders (reservation_expires_at);

create index if not exists orders_deleted_at_idx
  on public.orders (deleted_at);

create index if not exists orders_customer_user_id_idx
  on public.orders (customer_user_id);

create index if not exists orders_webhook_last_processed_at_idx
  on public.orders (webhook_last_processed_at desc);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create index if not exists order_items_product_id_idx
  on public.order_items (product_id);

create unique index if not exists order_items_order_product_unique_idx
  on public.order_items (order_id, product_id);

create or replace function public.generate_order_number()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_candidate text;
begin
  loop
    v_candidate := 'VD-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));

    exit when not exists (
      select 1
      from public.orders
      where order_number = v_candidate
    );
  end loop;

  return v_candidate;
end;
$$;

create or replace function public.release_expired_reservations()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_expired_order_ids uuid[] := array[]::uuid[];
  v_released_product_ids uuid[] := array[]::uuid[];
begin
  with expired_orders as (
    select o.id
    from public.orders o
    where o.deleted_at is null
      and o.status in ('draft', 'reserved')
      and coalesce(o.payment_status, 'open') <> 'paid'
      and coalesce(o.reservation_expires_at, o.expires_at) is not null
      and coalesce(o.reservation_expires_at, o.expires_at) <= now()
    for update
  ),
  released_products as (
    update public.products p
    set status = 'available',
        reserved_until = null,
        reserved_order_id = null
    where p.reserved_order_id in (select id from expired_orders)
      and p.deleted_at is null
      and p.status = 'reserved'
    returning p.id
  ),
  updated_orders as (
    update public.orders o
    set status = 'expired',
        payment_status = case when o.payment_status = 'paid' then o.payment_status else 'expired' end,
        reservation_expires_at = null,
        expires_at = null
    where o.id in (select id from expired_orders)
    returning o.id
  )
  select
    coalesce((select array_agg(id) from updated_orders), array[]::uuid[]),
    coalesce((select array_agg(id) from released_products), array[]::uuid[])
  into v_expired_order_ids, v_released_product_ids;

  return jsonb_build_object(
    'order_ids', to_jsonb(v_expired_order_ids),
    'product_ids', to_jsonb(v_released_product_ids)
  );
end;
$$;

comment on function public.release_expired_reservations() is
  'Releases stale unpaid product reservations and expires their orders. Safe to call repeatedly.';

create or replace function public.create_checkout_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_note text default null,
  p_customer_user_id uuid default null,
  p_product_ids uuid[] default array[]::uuid[]
)
returns table (
  order_id uuid,
  order_number text,
  total_amount numeric,
  reservation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_reservation_expires_at timestamptz := now() + interval '30 minutes';
  v_requested_count integer := coalesce(array_length(p_product_ids, 1), 0);
  v_unique_product_ids uuid[];
  v_unique_count integer := 0;
  v_found_count integer := 0;
  v_available_count integer := 0;
  v_total_amount numeric := 0;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Alleen de backend mag bestellingen aanmaken.';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Naam is verplicht.';
  end if;

  if nullif(trim(coalesce(p_customer_email, '')), '') is null then
    raise exception 'E-mail is verplicht.';
  end if;

  if nullif(trim(coalesce(p_customer_phone, '')), '') is null then
    raise exception 'Telefoonnummer is verplicht.';
  end if;

  v_unique_product_ids := array(
    select distinct item.product_id
    from unnest(coalesce(p_product_ids, array[]::uuid[])) as item(product_id)
    where item.product_id is not null
  );
  v_unique_count := coalesce(array_length(v_unique_product_ids, 1), 0);

  if v_unique_count = 0 then
    raise exception 'Je mandje is leeg.';
  end if;

  if v_unique_count <> v_requested_count then
    raise exception 'Elk product kan maar één keer in hetzelfde mandje staan.';
  end if;

  perform public.release_expired_reservations();

  with locked_products as (
    select
      p.id,
      p.price,
      p.price_label,
      p.status,
      p.deleted_at
    from public.products p
    where p.id = any(v_unique_product_ids)
    for update
  )
  select
    count(*),
    count(*) filter (
      where deleted_at is null
        and status = 'available'
        and price_label <> 'op_aanvraag'
        and price is not null
    ),
    coalesce(sum(price), 0)
  into
    v_found_count,
    v_available_count,
    v_total_amount
  from locked_products;

  if v_found_count <> v_unique_count then
    raise exception 'Een of meer producten bestaan niet meer.';
  end if;

  if v_available_count <> v_found_count then
    raise exception 'Een of meer producten zijn niet langer beschikbaar.';
  end if;

  v_order_number := public.generate_order_number();

  insert into public.orders (
    id,
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    pickup_note,
    status,
    payment_status,
    total_amount,
    created_at,
    expires_at,
    reservation_expires_at,
    customer_user_id
  )
  values (
    v_order_id,
    v_order_number,
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_pickup_note, '')), ''),
    'reserved',
    'open',
    v_total_amount,
    v_now,
    v_reservation_expires_at,
    v_reservation_expires_at,
    p_customer_user_id
  );

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    product_price,
    image_url,
    created_at
  )
  select
    v_order_id,
    p.id,
    p.name,
    p.price,
    (
      select pi.image_url
      from public.product_images pi
      where pi.product_id = p.id
      order by pi.position asc, pi.id asc
      limit 1
    ),
    v_now
  from public.products p
  where p.id = any(v_unique_product_ids);

  update public.products
  set status = 'reserved',
      reserved_until = v_reservation_expires_at,
      reserved_order_id = v_order_id
  where id = any(v_unique_product_ids);

  return query
  select v_order_id, v_order_number, v_total_amount, v_reservation_expires_at;
end;
$$;

comment on function public.create_checkout_order(text, text, text, text, uuid, uuid[]) is
  'Creates a new order and reserves all requested products atomically. Intended for service role use from Edge Functions only.';

create or replace function public.apply_order_payment_update(
  p_order_id uuid,
  p_order_status text,
  p_payment_status text,
  p_payment_method text default null,
  p_paid_at timestamptz default null,
  p_webhook_processed_at timestamptz default null,
  p_release_inventory boolean default false,
  p_mark_inventory_sold boolean default false
)
returns table (
  order_id uuid,
  order_status text,
  payment_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order public.orders%rowtype;
  v_next_order_status text := p_order_status;
  v_next_payment_status text := p_payment_status;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Alleen de backend mag betalingsupdates verwerken.';
  end if;

  if p_order_status not in ('draft', 'reserved', 'paid', 'cancelled', 'expired', 'fulfilled') then
    raise exception 'Ongeldige orderstatus: %', p_order_status;
  end if;

  if p_payment_status not in ('open', 'paid', 'failed', 'expired', 'cancelled', 'pending') then
    raise exception 'Ongeldige betalingsstatus: %', p_payment_status;
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Bestelling niet gevonden.';
  end if;

  if v_order.status = 'fulfilled' then
    v_next_order_status := 'fulfilled';
    v_next_payment_status := 'paid';
    p_release_inventory := false;
  elsif v_order.status in ('paid', 'fulfilled') and v_order.payment_status = 'paid' and p_payment_status <> 'paid' then
    v_next_order_status := v_order.status;
    v_next_payment_status := v_order.payment_status;
    p_release_inventory := false;
    p_mark_inventory_sold := false;
  end if;

  if p_mark_inventory_sold then
    update public.products p
    set status = 'sold',
        sold_at = coalesce(p.sold_at, p_paid_at, now()),
        reserved_until = null,
        reserved_order_id = null
    where p.id in (
      select oi.product_id
      from public.order_items oi
      where oi.order_id = p_order_id
    )
      and p.deleted_at is null
      and (
        p.reserved_order_id = p_order_id
        or (p.reserved_order_id is null and p.status = 'available')
        or p.status = 'sold'
      );
  end if;

  if p_release_inventory and v_order.status not in ('paid', 'fulfilled') then
    update public.products p
    set status = 'available',
        reserved_until = null,
        reserved_order_id = null
    where p.reserved_order_id = p_order_id
      and p.deleted_at is null
      and p.status = 'reserved';
  end if;

  update public.orders o
  set status = v_next_order_status,
      payment_status = v_next_payment_status,
      payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), o.payment_method),
      paid_at = case
        when v_next_payment_status = 'paid' then coalesce(o.paid_at, p_paid_at, now())
        else o.paid_at
      end,
      reservation_expires_at = case
        when p_mark_inventory_sold
          or p_release_inventory
          or v_next_order_status in ('paid', 'cancelled', 'expired', 'fulfilled')
          then null
        else o.reservation_expires_at
      end,
      expires_at = case
        when p_mark_inventory_sold
          or p_release_inventory
          or v_next_order_status in ('paid', 'cancelled', 'expired', 'fulfilled')
          then null
        else o.expires_at
      end,
      webhook_last_processed_at = coalesce(p_webhook_processed_at, o.webhook_last_processed_at)
  where o.id = p_order_id
  returning o.id, o.status, o.payment_status
  into order_id, order_status, payment_status;

  return next;
end;
$$;

comment on function public.apply_order_payment_update(uuid, text, text, text, timestamptz, timestamptz, boolean, boolean) is
  'Applies payment-driven order updates and keeps reserved inventory in sync. Intended for service role use from Edge Functions only.';

create or replace function public.mark_order_fulfilled(p_order_id uuid)
returns table (
  order_id uuid,
  order_status text,
  payment_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Alleen admins mogen bestellingen afronden.';
  end if;

  return query
  update public.orders o
  set status = 'fulfilled'
  where o.id = p_order_id
    and o.deleted_at is null
    and o.status in ('paid', 'fulfilled')
  returning o.id, o.status, o.payment_status;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns table (
  order_id uuid,
  order_status text,
  payment_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Alleen admins mogen bestellingen annuleren.';
  end if;

  return query
  select *
  from public.apply_order_payment_update(
    p_order_id,
    'cancelled',
    'cancelled',
    null,
    null,
    null,
    true,
    false
  );
end;
$$;

create or replace function public.release_order_reservation(p_order_id uuid)
returns table (
  order_id uuid,
  order_status text,
  payment_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Alleen admins mogen reservaties vrijgeven.';
  end if;

  return query
  select *
  from public.apply_order_payment_update(
    p_order_id,
    'expired',
    'expired',
    null,
    null,
    null,
    true,
    false
  );
end;
$$;

revoke all on function public.generate_order_number() from public;
grant execute on function public.generate_order_number() to service_role;

revoke all on function public.release_expired_reservations() from public;
grant execute on function public.release_expired_reservations() to anon, authenticated, service_role;

revoke all on function public.create_checkout_order(text, text, text, text, uuid, uuid[]) from public;
grant execute on function public.create_checkout_order(text, text, text, text, uuid, uuid[]) to service_role;

revoke all on function public.apply_order_payment_update(uuid, text, text, text, timestamptz, timestamptz, boolean, boolean) from public;
grant execute on function public.apply_order_payment_update(uuid, text, text, text, timestamptz, timestamptz, boolean, boolean) to service_role;

revoke all on function public.mark_order_fulfilled(uuid) from public;
grant execute on function public.mark_order_fulfilled(uuid) to authenticated, service_role;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated, service_role;

revoke all on function public.release_order_reservation(uuid) from public;
grant execute on function public.release_order_reservation(uuid) to authenticated, service_role;

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can manage products" on public.products;
drop policy if exists "Visible products are public" on public.products;
drop policy if exists "Admins can read all products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

drop policy if exists "Public can read product images" on public.product_images;
drop policy if exists "Public can manage product images" on public.product_images;
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
