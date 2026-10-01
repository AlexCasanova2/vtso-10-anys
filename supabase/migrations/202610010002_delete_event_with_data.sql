-- Elimina una jornada y sus datos en una sola transacción. El rol de servicio
-- solo puede invocarla para un administrador registrado en la aplicación.
create or replace function public.delete_event_with_data(p_event_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_participant_ids uuid[];
begin
  if not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  -- Las jornadas activas con datos nunca pueden borrarse accidentalmente.
  if v_event.status <> 'completed' and (
    exists (select 1 from public.entries where event_id = p_event_id)
    or exists (select 1 from public.ticket_registrations where event_id = p_event_id)
    or exists (select 1 from public.draws where event_id = p_event_id)
  ) then
    raise exception 'EVENT_NOT_COMPLETED';
  end if;

  select array(
    select participant_id from public.entries where event_id = p_event_id
    union
    select participant_id from public.ticket_registrations where event_id = p_event_id
  ) into v_participant_ids;

  -- Las auditorías de esta jornada no deben quedar con datos personales huérfanos.
  delete from public.audit_logs
  where (entity_type = 'event' and entity_id = p_event_id::text)
    or (entity_type = 'entry' and entity_id in (
      select id::text from public.entries where event_id = p_event_id
    ))
    or payload->>'event_id' = p_event_id::text;

  delete from public.draws where event_id = p_event_id;
  delete from public.entries where event_id = p_event_id;
  -- email_deliveries se elimina por la FK en cascada de entries.
  delete from public.ticket_registrations where event_id = p_event_id;
  delete from public.events where id = p_event_id;

  -- Una persona que también participa en otra jornada sigue en el CRM.
  delete from public.participants p
  where p.id = any(v_participant_ids)
    and not exists (select 1 from public.entries e where e.participant_id = p.id)
    and not exists (select 1 from public.ticket_registrations t where t.participant_id = p.id);

  -- Conservar solo la constancia administrativa del borrado, sin datos personales.
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (p_actor_id, 'event.deleted', 'event', p_event_id::text);
end;
$$;

revoke all on function public.delete_event_with_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_event_with_data(uuid, uuid) to service_role;
