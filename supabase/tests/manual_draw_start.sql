-- Ejecutar tras la migración. La prueba completa termina con ROLLBACK.
begin;
do $$
declare
  v_actor uuid;
  v_event uuid;
  v_participant uuid;
begin
  select id into v_actor from public.profiles where role in ('admin', 'operator') limit 1;
  if v_actor is null then raise exception 'La prueba necesita un perfil del equipo'; end if;
  insert into public.events (name, starts_at, registration_opens_at, registration_closes_at,
    prize_count, status, club_signup_url, terms_url, privacy_url,
    assignment_seed, assignment_seed_commitment, draw_seed, draw_seed_commitment)
  values ('Prueba inicio manual', now(), now() - interval '2 hours', now() - interval '1 hour',
    2, 'registration_closed', 'https://example.com/club', 'https://example.com/terms',
    'https://example.com/privacy', 'seed', 'commitment', 'draw', 'draw-commitment')
  returning id into v_event;
  begin
    perform public.start_draw_event(v_event, gen_random_uuid(), array[]::integer[]);
    raise exception 'Se permitió un actor sin permisos';
  exception when others then
    if sqlerrm <> 'UNAUTHORIZED' then raise; end if;
  end;
  begin
    perform public.start_draw_event(v_event, v_actor, array[]::integer[]);
    raise exception 'Se inició sin participaciones';
  exception when others then
    if sqlerrm <> 'NO_ELIGIBLE_ENTRIES' then raise; end if;
  end;
  insert into public.participants (first_name, last_name, email, document_type, document_number)
  values ('Prueba', 'Manual', 'manual@example.invalid', 'passport', v_event::text)
  returning id into v_participant;
  insert into public.entries (event_id, participant_id, number, first_name_snapshot,
    last_name_snapshot, email_snapshot, document_number_snapshot, club_member_confirmed, legal_accepted_at)
  select v_event, v_participant, number, 'Prueba', 'Manual', 'manual@example.invalid',
    v_event::text, true, now() from unnest(array[347, 92]) as numbers(number);
  update public.events set starts_at = now() + interval '1 hour' where id = v_event;
  begin
    perform public.start_draw_event(v_event, v_actor, array[347, 92]);
    raise exception 'Se inició antes de la hora prevista';
  exception when others then
    if sqlerrm <> 'DRAW_TOO_EARLY' then raise; end if;
  end;
  update public.events set starts_at = now() where id = v_event;
  begin
    perform public.start_draw_event(v_event, v_actor, array[347, 347]);
    raise exception 'Se aceptó una secuencia inválida';
  exception when others then
    if sqlerrm <> 'INVALID_DRAW_SEQUENCE' then raise; end if;
  end;
  if (select status from public.events where id = v_event) <> 'registration_closed'
    or exists (select 1 from public.audit_logs where entity_id = v_event::text) then
    raise exception 'El inicio fallido no fue atómico';
  end if;
  if public.start_draw_event(v_event, v_actor, array[347, 92]) is distinct from true then
    raise exception 'No se inició manualmente';
  end if;
  if public.start_draw_event(v_event, v_actor, array[347, 92]) is distinct from false then
    raise exception 'Se repitió el inicio';
  end if;
  if (select status from public.events where id = v_event) <> 'drawing'
    or (select count(*) from public.audit_logs where entity_id = v_event::text) <> 3 then
    raise exception 'El inicio o su auditoría no se guardaron correctamente';
  end if;
  if not exists (select 1 from public.audit_logs where entity_id = v_event::text
    and action = 'draw.number_revealed' and payload->>'number' = '347' and payload->>'position' = '1') then
    raise exception 'No se reveló el primer número';
  end if;
  update public.events set status = 'completed' where id = v_event;
  begin
    perform public.start_draw_event(v_event, v_actor, array[347, 92]);
    raise exception 'Se reabrió una jornada finalizada';
  exception when others then
    if sqlerrm <> 'DRAW_NOT_STARTABLE' then raise; end if;
  end;
end;
$$;
rollback;
