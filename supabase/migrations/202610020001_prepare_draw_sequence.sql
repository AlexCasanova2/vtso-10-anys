-- La preparación y la primera extracción deben ocurrir una sola vez y en
-- la misma transacción, incluso cuando varias peticiones inicien el sorteo.
create or replace function public.prepare_draw_sequence(p_event_id uuid, p_numbers integer[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_now timestamptz;
begin
  perform 1 from public.events where id = p_event_id and status = 'drawing' for update;
  if not found then raise exception 'DRAW_NOT_OPEN'; end if;

  if exists (
    select 1 from public.audit_logs
    where entity_type = 'event' and entity_id = p_event_id::text
      and action = 'draw.sequence_prepared'
  ) then
    return false;
  end if;

  select count(*) into v_count from public.entries where event_id = p_event_id;
  if v_count = 0 then return false; end if;

  -- Comprobar que el orden recibido contiene todos los números inscritos
  -- exactamente una vez, sin incluir números ajenos a la jornada.
  if coalesce(array_length(p_numbers, 1), 0) <> v_count
    or (select count(distinct number) from unnest(p_numbers) as proposed(number)) <> v_count
    or exists (
      select 1 from unnest(p_numbers) as proposed(number)
      where not exists (
        select 1 from public.entries e
        where e.event_id = p_event_id and e.number = proposed.number
      )
    ) then
    raise exception 'INVALID_DRAW_SEQUENCE';
  end if;

  v_now := clock_timestamp();
  insert into public.audit_logs (action, entity_type, entity_id, payload, created_at)
  values
    ('draw.sequence_prepared', 'event', p_event_id::text,
      jsonb_build_object('numbers', p_numbers, 'algorithm', 'hmac-sha256-registered-without-replacement-v2'), v_now),
    ('draw.number_revealed', 'event', p_event_id::text,
      jsonb_build_object('number', p_numbers[1], 'position', 1), v_now);
  return true;
end;
$$;

revoke all on function public.prepare_draw_sequence(uuid, integer[]) from public, anon, authenticated;
grant execute on function public.prepare_draw_sequence(uuid, integer[]) to service_role;
