-- Prueba de integración opcional: ejecutar tras la migración desde el editor SQL.
-- Todas las filas de prueba y auditorías se revierten al terminar.
begin;

do $$
declare
  v_event uuid;
  v_participant uuid;
  v_numbers integer[] := array[794, 222, 303, 895, 425, 182, 417];
begin
  insert into public.events (
    name, starts_at, registration_opens_at, registration_closes_at, prize_count,
    status, club_signup_url, terms_url, privacy_url,
    assignment_seed, assignment_seed_commitment, draw_seed, draw_seed_commitment
  ) values (
    'Prueba transaccional de extracción', now(), now() - interval '2 hours',
    now() - interval '1 hour', 3, 'drawing',
    'https://example.com/club', 'https://example.com/terms', 'https://example.com/privacy',
    'test-seed', 'test-commitment', 'test-draw-seed', 'test-draw-commitment'
  ) returning id into v_event;

  insert into public.participants (first_name, last_name, email, document_type, document_number)
  values ('Prueba', 'Extracción', 'draw-test@example.com', 'passport', v_event::text)
  returning id into v_participant;

  insert into public.entries (
    event_id, participant_id, number, first_name_snapshot, last_name_snapshot,
    email_snapshot, document_number_snapshot, club_member_confirmed, legal_accepted_at
  )
  select v_event, v_participant, number, 'Prueba', 'Extracción',
    'draw-test@example.com', v_event::text, true, now()
  from unnest(v_numbers) as registered(number);

  begin
    perform public.prepare_draw_sequence(v_event, array[794, 794, 303, 895, 425, 182, 417]);
    raise exception 'La secuencia duplicada fue aceptada';
  exception when others then
    if sqlerrm <> 'INVALID_DRAW_SEQUENCE' then raise; end if;
  end;

  if public.prepare_draw_sequence(v_event, v_numbers) is distinct from true then
    raise exception 'No se preparó la secuencia';
  end if;
  if public.prepare_draw_sequence(v_event, v_numbers) is distinct from false then
    raise exception 'Se volvió a preparar la misma jornada';
  end if;
  if (select count(*) from public.audit_logs where entity_id = v_event::text
    and action in ('draw.sequence_prepared', 'draw.number_revealed')) <> 2 then
    raise exception 'La primera extracción se registró más de una vez';
  end if;
  if not exists (select 1 from public.audit_logs where entity_id = v_event::text
    and action = 'draw.sequence_prepared'
    and payload->'numbers' = to_jsonb(v_numbers)) then
    raise exception 'La secuencia preparada no contiene los siete números';
  end if;
end;
$$;

rollback;
