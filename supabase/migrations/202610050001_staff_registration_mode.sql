-- Mantener el modo de las jornadas existentes; nuevas jornadas usan el formulario completo.
alter table public.events add column staff_registration_full boolean not null default false;
alter table public.events alter column staff_registration_full set default true;

create function public.register_staff_ticket(
  p_event_id uuid, p_first_name text, p_last_name text, p_email text,
  p_document_type public.document_type, p_document_number text, p_document_country char(2),
  p_ticket_code text, p_amount_cents integer, p_actor_id uuid,
  p_club_member boolean, p_legal_accepted boolean
) returns table(entry_id uuid, assigned_number smallint)
language plpgsql security definer set search_path = '' as $$
declare
  v_full boolean;
  v_reserved integer;
  v_count integer;
begin
  if p_club_member is distinct from true then raise exception 'CLUB_NOT_VERIFIED'; end if;
  if p_legal_accepted is distinct from true then raise exception 'LEGAL_NOT_ACCEPTED'; end if;
  if not exists (select 1 from public.profiles where id = p_actor_id) then raise exception 'UNAUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select staff_registration_full into v_full from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not v_full then raise exception 'REGISTRATION_MODE_CHANGED'; end if;
  if exists (select 1 from public.pending_ticket_registrations
    where event_id = p_event_id and ticket_code = upper(regexp_replace(trim(p_ticket_code), '\s+', '', 'g'))) then
    raise exception 'TICKET_ALREADY_USED';
  end if;
  v_count := case when p_amount_cents >= 10000 then 3 when p_amount_cents >= 8000 then 2 else 1 end;
  select coalesce(sum(case when amount_cents >= 10000 then 3 when amount_cents >= 8000 then 2 else 1 end), 0)
    into v_reserved from public.pending_ticket_registrations
    where event_id = p_event_id and completed_at is null and expires_at > now();
  if (select count(*) from public.entries where event_id = p_event_id) + v_reserved + v_count > 1000 then
    raise exception 'EVENT_FULL';
  end if;
  return query select * from public.register_ticket(p_event_id, p_first_name, p_last_name, p_email,
    p_document_type, p_document_number, p_document_country, p_ticket_code, p_amount_cents, p_actor_id);
end;
$$;
revoke all on function public.register_staff_ticket(uuid, text, text, text, public.document_type, text, char(2), text, integer, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.register_staff_ticket(uuid, text, text, text, public.document_type, text, char(2), text, integer, uuid, boolean, boolean) to service_role;

-- No crear ni rotar invitaciones mientras la jornada esté en modo completo.
create function public.guard_invitation_registration_mode()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_full boolean;
begin
  if tg_op = 'UPDATE' and new.token_hash is not distinct from old.token_hash then return new; end if;
  -- Consumir enlaces ya enviados sigue permitido tras cambiar el modo.
  if tg_op = 'UPDATE' and new.completed_at is not null then return new; end if;
  select staff_registration_full into v_full from public.events where id = new.event_id for update;
  if v_full then raise exception 'REGISTRATION_MODE_CHANGED'; end if;
  return new;
end;
$$;
create trigger pending_ticket_registration_mode
before insert or update on public.pending_ticket_registrations
for each row execute function public.guard_invitation_registration_mode();
