-- A ticket is checked in person before staff register it. Existing entries remain valid.
create table public.ticket_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete restrict,
  ticket_code text not null,
  amount_cents integer not null check (amount_cents >= 6000),
  number_count smallint not null check (number_count between 1 and 3),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (event_id, ticket_code)
);

alter table public.ticket_registrations enable row level security;
alter table public.entries drop constraint entries_event_id_participant_id_key;
alter table public.entries add column ticket_registration_id uuid references public.ticket_registrations(id) on delete restrict;
create index entries_ticket_registration_idx on public.entries(ticket_registration_id);

create or replace function public.register_ticket(
  p_event_id uuid, p_first_name text, p_last_name text, p_email text,
  p_document_type public.document_type, p_document_number text, p_document_country char(2),
  p_ticket_code text, p_amount_cents integer, p_actor_id uuid
) returns table(entry_id uuid, assigned_number smallint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_event public.events%rowtype;
  v_participant_id uuid;
  v_registration_id uuid;
  v_number smallint;
  v_start integer;
  v_count integer;
  v_step integer;
  v_document text := upper(regexp_replace(p_document_number, '[^A-Za-z0-9]', '', 'g'));
  v_code text := upper(regexp_replace(trim(p_ticket_code), '\s+', '', 'g'));
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if now() < v_event.registration_opens_at then raise exception 'REGISTRATION_NOT_OPEN'; end if;
  if now() >= v_event.registration_closes_at or v_event.status not in ('scheduled', 'registration_open') then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  if p_amount_cents is null or p_amount_cents < 6000 then raise exception 'AMOUNT_TOO_LOW'; end if;
  if length(v_code) < 2 or length(v_code) > 100 then raise exception 'INVALID_TICKET'; end if;
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'UNAUTHORIZED';
  end if;

  v_count := case when p_amount_cents >= 10000 then 3 when p_amount_cents >= 8000 then 2 else 1 end;
  if (select count(*) from public.entries where event_id = p_event_id) + v_count > 1000 then raise exception 'EVENT_FULL'; end if;
  if exists (select 1 from public.ticket_registrations where event_id = p_event_id and ticket_code = v_code) then
    raise exception 'TICKET_ALREADY_USED';
  end if;

  insert into public.participants (first_name, last_name, email, document_type, document_number, document_country)
  values (trim(p_first_name), trim(p_last_name), lower(trim(p_email)), p_document_type, v_document, upper(p_document_country))
  on conflict (document_type, document_number, document_country) do update
    set first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email, updated_at = now()
  returning id into v_participant_id;

  -- A later ticket for the same person should make resends from any number reach the latest address.
  update public.entries set email_snapshot = lower(trim(p_email))
  where event_id = p_event_id and participant_id = v_participant_id;

  insert into public.ticket_registrations (event_id, participant_id, ticket_code, amount_cents, number_count, created_by)
  values (p_event_id, v_participant_id, v_code, p_amount_cents, v_count, p_actor_id)
  returning id into v_registration_id;

  for v_step in 1..v_count loop
    v_start := public.crypto_index(v_event.assignment_seed,
      p_document_type::text || ':' || v_document || ':' || upper(p_document_country) || ':' || v_code || ':' || v_step, 1000);
    select candidate::smallint into v_number
    from (select (v_start + pool_step) % 1000 as candidate, pool_step
          from generate_series(0, 999) as available_numbers(pool_step)) numbers
    where not exists (select 1 from public.entries where event_id = p_event_id and number = candidate)
    order by pool_step limit 1;

    insert into public.entries (event_id, participant_id, ticket_registration_id, number,
      first_name_snapshot, last_name_snapshot, email_snapshot, document_number_snapshot,
      club_member_confirmed, legal_accepted_at)
    values (p_event_id, v_participant_id, v_registration_id, v_number,
      trim(p_first_name), trim(p_last_name), lower(trim(p_email)), v_document, true, now())
    returning id, number into entry_id, assigned_number;
    return next;
  end loop;
end;
$$;

revoke all on function public.register_ticket from public, anon, authenticated;
-- The old registration RPC must not remain callable after the public form is closed.
revoke all on function public.register_entry from public, anon, authenticated;
