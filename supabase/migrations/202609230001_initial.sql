create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.admin_role as enum ('admin', 'operator');
create type public.event_status as enum ('draft', 'scheduled', 'registration_open', 'registration_closed', 'drawing', 'completed');
create type public.document_type as enum ('dni', 'nie', 'passport');
create type public.draw_status as enum ('pending', 'awarded', 'absent');
create type public.delivery_status as enum ('queued', 'sent', 'delivered', 'bounced', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.admin_role not null default 'operator',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  prize_count smallint not null check (prize_count between 1 and 40),
  prize_value_cents integer not null default 25000 check (prize_value_cents > 0),
  status public.event_status not null default 'draft',
  venue text not null default '',
  club_signup_url text not null,
  terms_url text not null,
  privacy_url text not null,
  public_message text not null default '',
  assignment_seed text not null,
  assignment_seed_commitment text not null,
  draw_seed text not null,
  draw_seed_commitment text not null,
  assignment_seed_revealed text,
  draw_seed_revealed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_opens_at < registration_closes_at and registration_closes_at <= starts_at)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  document_type public.document_type not null,
  document_number text not null,
  document_country char(2) not null default 'ES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_type, document_number, document_country)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete restrict,
  number smallint not null check (number between 0 and 999),
  first_name_snapshot text not null,
  last_name_snapshot text not null,
  email_snapshot text not null,
  document_number_snapshot text not null,
  club_member_confirmed boolean not null,
  legal_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (event_id, participant_id),
  unique (event_id, number)
);

create table public.draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  entry_id uuid not null references public.entries(id) on delete restrict,
  prize_index smallint not null,
  attempt smallint not null,
  status public.draw_status not null default 'pending',
  verification_hash text not null,
  drawn_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  unique (event_id, entry_id),
  unique (event_id, prize_index, attempt)
);

create unique index one_pending_draw_per_event on public.draws(event_id) where status = 'pending';

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  recipient text not null,
  provider_id text,
  status public.delivery_status not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index entries_event_created_idx on public.entries(event_id, created_at desc);
create index participants_search_idx on public.participants using gin ((first_name || ' ' || last_name || ' ' || email || ' ' || document_number) gin_trgm_ops);
create index draws_event_idx on public.draws(event_id, drawn_at desc);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.entries enable row level security;
alter table public.draws enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.audit_logs enable row level security;

create policy "staff can read own profile" on public.profiles for select to authenticated using (id = auth.uid());

create or replace function public.crypto_index(p_seed text, p_context text, p_upper_bound integer)
returns integer language plpgsql immutable strict set search_path = public, extensions as $$
declare
  v_digest bytea;
  v_offset integer;
  v_value numeric;
  v_limit numeric;
begin
  if p_upper_bound <= 0 then raise exception 'INVALID_UPPER_BOUND'; end if;
  v_digest := hmac(convert_to(p_context, 'UTF8'), convert_to(p_seed, 'UTF8'), 'sha256');
  v_limit := floor(4294967296::numeric / p_upper_bound) * p_upper_bound;
  for v_offset in 0..7 loop
    v_value := get_byte(v_digest, v_offset * 4)::numeric * 16777216
      + get_byte(v_digest, v_offset * 4 + 1)::numeric * 65536
      + get_byte(v_digest, v_offset * 4 + 2)::numeric * 256
      + get_byte(v_digest, v_offset * 4 + 3)::numeric;
    if v_value < v_limit then return mod(v_value, p_upper_bound)::integer; end if;
  end loop;
  return public.crypto_index(p_seed, p_context || ':retry', p_upper_bound);
end;
$$;

create or replace function public.register_entry(
  p_event_id uuid, p_first_name text, p_last_name text, p_email text,
  p_document_type public.document_type, p_document_number text, p_document_country char(2)
) returns table(entry_id uuid, assigned_number smallint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_event public.events%rowtype;
  v_participant_id uuid;
  v_entry_id uuid;
  v_number smallint;
  v_start integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if now() < v_event.registration_opens_at then raise exception 'REGISTRATION_NOT_OPEN'; end if;
  if now() >= v_event.registration_closes_at then raise exception 'REGISTRATION_CLOSED'; end if;
  if v_event.status not in ('scheduled', 'registration_open') then raise exception 'REGISTRATION_CLOSED'; end if;
  if (select count(*) from public.entries where event_id = p_event_id) >= 1000 then raise exception 'EVENT_FULL'; end if;

  insert into public.participants (first_name, last_name, email, document_type, document_number, document_country)
  values (trim(p_first_name), trim(p_last_name), lower(trim(p_email)), p_document_type, upper(regexp_replace(p_document_number, '[^A-Za-z0-9]', '', 'g')), upper(p_document_country))
  on conflict (document_type, document_number, document_country) do update
    set first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email, updated_at = now()
  returning id into v_participant_id;

  if exists (select 1 from public.entries where event_id = p_event_id and participant_id = v_participant_id) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  v_start := public.crypto_index(v_event.assignment_seed, p_document_type::text || ':' || upper(p_document_number) || ':' || p_document_country, 1000);

  select candidate::smallint into v_number
  from (
    select (v_start + pool_step) % 1000 as candidate, pool_step
    from generate_series(0, 999) as available_numbers(pool_step)
  ) numbers
  where not exists (select 1 from public.entries where event_id = p_event_id and number = candidate)
  order by pool_step limit 1;

  insert into public.entries (event_id, participant_id, number, first_name_snapshot, last_name_snapshot, email_snapshot, document_number_snapshot, club_member_confirmed, legal_accepted_at)
  values (p_event_id, v_participant_id, v_number, trim(p_first_name), trim(p_last_name), lower(trim(p_email)), upper(regexp_replace(p_document_number, '[^A-Za-z0-9]', '', 'g')), true, now())
  returning id into v_entry_id;

  return query select v_entry_id, v_number;
end;
$$;

create or replace function public.draw_next(p_event_id uuid, p_actor_id uuid)
returns table(draw_id uuid, entry_id uuid, assigned_number smallint, prize_index smallint, attempt smallint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_event public.events%rowtype;
  v_awarded integer;
  v_attempt integer;
  v_eligible integer;
  v_position integer;
  v_digest bytea;
  v_entry public.entries%rowtype;
  v_draw_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 1));
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.status <> 'drawing' then raise exception 'DRAW_NOT_OPEN'; end if;
  if exists (select 1 from public.draws where event_id = p_event_id and status = 'pending') then raise exception 'PENDING_DRAW'; end if;
  select count(*) into v_awarded from public.draws where event_id = p_event_id and status = 'awarded';
  if v_awarded >= v_event.prize_count then raise exception 'ALL_PRIZES_AWARDED'; end if;
  select coalesce(max(d.attempt), 0) + 1 into v_attempt from public.draws d where d.event_id = p_event_id and d.prize_index = v_awarded + 1;
  select count(*) into v_eligible from public.entries e where e.event_id = p_event_id and not exists (select 1 from public.draws d where d.entry_id = e.id);
  if v_eligible = 0 then raise exception 'NO_ELIGIBLE_ENTRIES'; end if;
  v_digest := hmac(convert_to('draw:' || (select count(*) + 1 from public.draws where event_id = p_event_id)::text, 'UTF8'), convert_to(v_event.draw_seed, 'UTF8'), 'sha256');
  v_position := public.crypto_index(v_event.draw_seed, 'draw:' || (select count(*) + 1 from public.draws where event_id = p_event_id)::text, v_eligible);
  select e.* into v_entry from public.entries e where e.event_id = p_event_id and not exists (select 1 from public.draws d where d.entry_id = e.id) order by e.number offset v_position limit 1;
  insert into public.draws (event_id, entry_id, prize_index, attempt, verification_hash)
  values (p_event_id, v_entry.id, v_awarded + 1, v_attempt, encode(v_digest, 'hex')) returning id into v_draw_id;
  return query select v_draw_id, v_entry.id, v_entry.number, (v_awarded + 1)::smallint, v_attempt::smallint;
end;
$$;

revoke all on function public.register_entry from public, anon, authenticated;
revoke all on function public.draw_next from public, anon, authenticated;
