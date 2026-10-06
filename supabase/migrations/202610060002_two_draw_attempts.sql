-- Dos intentos por premio; la segunda ausencia lo deja sin adjudicar.
create function public.advance_draw_event(
  p_event_id uuid, p_actor_id uuid, p_action text,
  p_expected_number integer, p_numbers integer[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_current jsonb;
  v_position integer;
  v_number integer;
  v_attempts integer;
  v_closed boolean;
  v_next integer;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role in ('admin', 'operator')) then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_action is null or p_action not in ('extract', 'redraw', 'skip') then raise exception 'INVALID_ACTION'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'drawing' then raise exception 'DRAW_NOT_OPEN'; end if;
  select payload into v_current from public.audit_logs
    where entity_type = 'event' and entity_id = p_event_id::text and action = 'draw.number_revealed'
    order by created_at desc, id desc limit 1;
  v_position := (v_current->>'position')::integer;
  v_number := (v_current->>'number')::integer;
  if v_current is null or p_expected_number is distinct from v_number then raise exception 'STALE_DRAW'; end if;
  select count(*) into v_attempts from public.audit_logs
    where entity_type = 'event' and entity_id = p_event_id::text
      and action = 'draw.number_revealed' and (payload->>'position')::integer = v_position;
  select exists (select 1 from public.audit_logs where entity_type = 'event'
    and entity_id = p_event_id::text and action = 'draw.prize_unawarded'
    and (payload->>'position')::integer = v_position) into v_closed;
  if v_closed and p_action <> 'extract' then raise exception 'PRIZE_CLOSED'; end if;
  if p_action = 'redraw' and v_attempts >= 2 then raise exception 'ATTEMPT_LIMIT'; end if;
  if p_action = 'skip' and v_attempts < 2 then raise exception 'SKIP_NOT_ALLOWED'; end if;
  if p_action = 'extract' and v_position >= v_event.prize_count then raise exception 'DRAW_FINISHED'; end if;

  if p_action <> 'skip' or v_position < v_event.prize_count then
    select proposed.number into v_next from unnest(p_numbers) with ordinality as proposed(number, ordinal)
      where exists (select 1 from public.entries where event_id = p_event_id and number = proposed.number)
        and not exists (select 1 from public.audit_logs where entity_type = 'event'
          and entity_id = p_event_id::text and action = 'draw.number_revealed'
          and (payload->>'number')::integer = proposed.number)
      order by proposed.ordinal limit 1;
    -- La ausencia final se registra aunque no queden números para el siguiente premio.
    if v_next is null and p_action <> 'skip' then raise exception 'NO_ELIGIBLE_ENTRIES'; end if;
  end if;
  if p_action in ('redraw', 'skip') then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload, created_at)
      values (p_actor_id, 'draw.number_absent', 'event', p_event_id::text, v_current, clock_timestamp());
  end if;
  if p_action = 'skip' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload, created_at)
      values (p_actor_id, 'draw.prize_unawarded', 'event', p_event_id::text,
        jsonb_build_object('position', v_position), clock_timestamp());
  end if;
  if v_next is not null then
    if p_action <> 'redraw' then v_position := v_position + 1; end if;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload, created_at)
      values (p_actor_id, 'draw.number_revealed', 'event', p_event_id::text,
        jsonb_build_object('number', v_next, 'position', v_position), clock_timestamp());
  end if;
  update public.events set updated_at = clock_timestamp() where id = p_event_id;
  return jsonb_build_object('number', v_next, 'position', v_position, 'unawarded', p_action = 'skip');
end;
$$;
revoke all on function public.advance_draw_event(uuid, uuid, text, integer, integer[]) from public, anon, authenticated;
grant execute on function public.advance_draw_event(uuid, uuid, text, integer, integer[]) to service_role;
