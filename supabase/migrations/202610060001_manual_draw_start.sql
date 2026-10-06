-- Inicio manual y primera extracción en una única transacción.
create function public.start_draw_event(p_event_id uuid, p_actor_id uuid, p_numbers integer[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role in ('admin', 'operator')) then
    raise exception 'UNAUTHORIZED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.status = 'drawing' then return false; end if;
  if v_event.status not in ('scheduled', 'registration_open', 'registration_closed') then
    raise exception 'DRAW_NOT_STARTABLE';
  end if;
  if now() < v_event.starts_at or now() < v_event.registration_closes_at then
    raise exception 'DRAW_TOO_EARLY';
  end if;
  if not exists (select 1 from public.entries where event_id = p_event_id) then
    raise exception 'NO_ELIGIBLE_ENTRIES';
  end if;
  update public.events set status = 'drawing', updated_at = clock_timestamp() where id = p_event_id;
  perform public.prepare_draw_sequence(p_event_id, p_numbers);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
    values (p_actor_id, 'draw.started', 'event', p_event_id::text);
  return true;
end;
$$;
revoke all on function public.start_draw_event(uuid, uuid, integer[]) from public, anon, authenticated;
grant execute on function public.start_draw_event(uuid, uuid, integer[]) to service_role;
