-- Una invitación no participa en el sorteo hasta completar los datos y aceptar las bases.
create table public.pending_ticket_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  ticket_code text not null,
  amount_cents integer not null check (amount_cents >= 6000),
  first_name text not null,
  email text not null,
  token_hash text unique,
  expires_at timestamptz not null,
  club_verified_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  email_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, ticket_code)
);

create index pending_ticket_event_idx on public.pending_ticket_registrations(event_id);
alter table public.pending_ticket_registrations enable row level security;

create function public.invite_ticket(
  p_event_id uuid, p_ticket_code text, p_amount_cents integer,
  p_first_name text, p_email text, p_token_hash text, p_actor_id uuid
) returns table(pending_id uuid, link_expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_event public.events%rowtype;
  v_pending public.pending_ticket_registrations%rowtype;
  v_code text := upper(regexp_replace(trim(p_ticket_code), '\s+', '', 'g'));
  v_count integer;
  v_reserved integer;
  v_expires_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if now() < v_event.registration_opens_at then raise exception 'REGISTRATION_NOT_OPEN'; end if;
  if now() >= v_event.registration_closes_at or v_event.status not in ('scheduled', 'registration_open') then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  if not exists (select 1 from public.profiles where id = p_actor_id) then raise exception 'UNAUTHORIZED'; end if;
  if p_amount_cents < 6000 then raise exception 'AMOUNT_TOO_LOW'; end if;
  if length(v_code) not between 2 and 100 then raise exception 'INVALID_TICKET'; end if;
  if length(trim(p_first_name)) not between 2 and 80 or length(trim(p_email)) > 180 then raise exception 'INVALID_PARTICIPANT'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_TOKEN'; end if;
  if exists (select 1 from public.ticket_registrations where event_id = p_event_id and ticket_code = v_code) then
    raise exception 'TICKET_ALREADY_USED';
  end if;

  select * into v_pending from public.pending_ticket_registrations
    where event_id = p_event_id and ticket_code = v_code for update;
  if found and v_pending.completed_at is not null then raise exception 'TICKET_ALREADY_USED'; end if;
  v_count := case when p_amount_cents >= 10000 then 3 when p_amount_cents >= 8000 then 2 else 1 end;
  select coalesce(sum(case when amount_cents >= 10000 then 3 when amount_cents >= 8000 then 2 else 1 end), 0)
    into v_reserved from public.pending_ticket_registrations
    where event_id = p_event_id and completed_at is null and expires_at > now()
      and id is distinct from v_pending.id;
  if (select count(*) from public.entries where event_id = p_event_id) + v_reserved + v_count > 1000 then
    raise exception 'EVENT_FULL';
  end if;

  v_expires_at := least(now() + interval '24 hours', v_event.registration_closes_at);
  if v_pending.id is null then
    insert into public.pending_ticket_registrations
      (event_id, ticket_code, amount_cents, first_name, email, token_hash, expires_at, club_verified_at, created_by)
    values (p_event_id, v_code, p_amount_cents, trim(p_first_name), lower(trim(p_email)),
      p_token_hash, v_expires_at, now(), p_actor_id)
    returning id into pending_id;
  else
    update public.pending_ticket_registrations set amount_cents = p_amount_cents,
      first_name = trim(p_first_name), email = lower(trim(p_email)), token_hash = p_token_hash,
      expires_at = v_expires_at, club_verified_at = now(), created_by = p_actor_id, email_sent_at = null
    where id = v_pending.id returning id into pending_id;
  end if;
  link_expires_at := v_expires_at;
  return next;
end;
$$;

create function public.complete_ticket_invitation(
  p_token_hash text, p_last_name text, p_document_type public.document_type,
  p_document_number text, p_document_country char(2), p_legal_accepted boolean
) returns table(entry_id uuid, assigned_number smallint, event_id uuid, recipient text, first_name text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_event_id uuid;
  v_pending public.pending_ticket_registrations%rowtype;
  v_entry record;
  v_document text := upper(regexp_replace(p_document_number, '[^A-Za-z0-9]', '', 'g'));
begin
  if p_legal_accepted is distinct from true then raise exception 'LEGAL_NOT_ACCEPTED'; end if;
  select p.event_id into v_event_id from public.pending_ticket_registrations p where p.token_hash = p_token_hash;
  if not found then raise exception 'INVALID_LINK'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_event_id::text, 0));
  select * into v_pending from public.pending_ticket_registrations
    where token_hash = p_token_hash for update;
  if not found or v_pending.completed_at is not null then raise exception 'INVALID_LINK'; end if;
  if now() >= v_pending.expires_at then raise exception 'LINK_EXPIRED'; end if;
  if v_pending.club_verified_at is null then raise exception 'CLUB_NOT_VERIFIED'; end if;

  -- La titularidad del documento no se puede reasignar a otro correo mediante un enlace.
  perform pg_advisory_xact_lock(hashtextextended(
    p_document_type::text || ':' || v_document || ':' || upper(p_document_country), 2));
  if exists (select 1 from public.participants p
    where p.document_type = p_document_type and p.document_number = v_document
      and p.document_country = upper(p_document_country) and p.email <> v_pending.email) then
    raise exception 'DOCUMENT_EMAIL_MISMATCH';
  end if;

  for v_entry in select * from public.register_ticket(
    v_pending.event_id, v_pending.first_name, p_last_name, v_pending.email,
    p_document_type, p_document_number, p_document_country,
    v_pending.ticket_code, v_pending.amount_cents, v_pending.created_by
  ) loop
    entry_id := v_entry.entry_id;
    assigned_number := v_entry.assigned_number;
    event_id := v_pending.event_id;
    recipient := v_pending.email;
    first_name := v_pending.first_name;
    return next;
  end loop;
  update public.pending_ticket_registrations set token_hash = null, completed_at = now()
    where id = v_pending.id;
end;
$$;

revoke all on function public.invite_ticket(uuid, text, integer, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.invite_ticket(uuid, text, integer, text, text, text, uuid) to service_role;
revoke all on function public.complete_ticket_invitation(text, text, public.document_type, text, char(2), boolean) from public, anon, authenticated;
grant execute on function public.complete_ticket_invitation(text, text, public.document_type, text, char(2), boolean) to service_role;

-- Conservar la protección de borrado de jornadas activas también si solo hay invitaciones pendientes.
create or replace function public.delete_event_with_data(p_event_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_participant_ids uuid[];
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then
    raise exception 'UNAUTHORIZED';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.status <> 'completed' and (
    exists (select 1 from public.entries where event_id = p_event_id)
    or exists (select 1 from public.ticket_registrations where event_id = p_event_id)
    or exists (select 1 from public.draws where event_id = p_event_id)
    or exists (select 1 from public.pending_ticket_registrations where event_id = p_event_id)
  ) then raise exception 'EVENT_NOT_COMPLETED'; end if;
  select array(
    select participant_id from public.entries where event_id = p_event_id
    union select participant_id from public.ticket_registrations where event_id = p_event_id
  ) into v_participant_ids;
  delete from public.audit_logs where (entity_type = 'event' and entity_id = p_event_id::text)
    or (entity_type = 'entry' and entity_id in (select id::text from public.entries where event_id = p_event_id))
    or payload->>'event_id' = p_event_id::text;
  delete from public.draws where event_id = p_event_id;
  delete from public.entries where event_id = p_event_id;
  delete from public.ticket_registrations where event_id = p_event_id;
  delete from public.pending_ticket_registrations where event_id = p_event_id;
  delete from public.events where id = p_event_id;
  delete from public.participants p where p.id = any(v_participant_ids)
    and not exists (select 1 from public.entries e where e.participant_id = p.id)
    and not exists (select 1 from public.ticket_registrations t where t.participant_id = p.id);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
    values (p_actor_id, 'event.deleted', 'event', p_event_id::text);
end;
$$;
