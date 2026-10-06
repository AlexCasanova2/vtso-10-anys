-- Ejecutar en pruebas tras las migraciones. Todos los cambios se revierten.
begin;
do $$
declare
  v_actor uuid;
  v_event uuid;
  v_participant uuid;
  v_numbers integer[] := array[347, 92, 222, 303, 425];
  v_result jsonb;
  v_count integer;
begin
  select id into v_actor from public.profiles where role in ('admin', 'operator') limit 1;
  if v_actor is null then raise exception 'La prueba necesita un perfil del equipo'; end if;
  insert into public.events (name, starts_at, registration_opens_at, registration_closes_at,
    prize_count, status, club_signup_url, terms_url, privacy_url,
    assignment_seed, assignment_seed_commitment, draw_seed, draw_seed_commitment)
  values ('Prueba dos intentos', now(), now() - interval '2 hours', now() - interval '1 hour',
    2, 'registration_closed', 'https://example.com/club', 'https://example.com/terms',
    'https://example.com/privacy', 'seed', 'commitment', 'draw', 'commitment') returning id into v_event;
  insert into public.participants (first_name, last_name, email, document_type, document_number)
  values ('Prueba', 'Intentos', 'attempts@example.invalid', 'passport', v_event::text) returning id into v_participant;
  insert into public.entries (event_id, participant_id, number, first_name_snapshot,
    last_name_snapshot, email_snapshot, document_number_snapshot, club_member_confirmed, legal_accepted_at)
  select v_event, v_participant, number, 'Prueba', 'Intentos', 'attempts@example.invalid',
    v_event::text, true, now() from unnest(v_numbers) as numbers(number);
  perform public.start_draw_event(v_event, v_actor, v_numbers);
  begin
    perform public.advance_draw_event(v_event, gen_random_uuid(), 'redraw', 347, v_numbers);
    raise exception 'Se permitió un actor sin permisos';
  exception when others then if sqlerrm <> 'UNAUTHORIZED' then raise; end if; end;
  begin
    perform public.advance_draw_event(v_event, v_actor, 'skip', 347, v_numbers);
    raise exception 'Se cerró tras un solo intento';
  exception when others then if sqlerrm <> 'SKIP_NOT_ALLOWED' then raise; end if; end;
  perform public.advance_draw_event(v_event, v_actor, 'redraw', 347, v_numbers);
  begin
    perform public.advance_draw_event(v_event, v_actor, 'redraw', 347, v_numbers);
    raise exception 'Se aceptó una petición repetida';
  exception when others then if sqlerrm <> 'STALE_DRAW' then raise; end if; end;
  begin
    perform public.advance_draw_event(v_event, v_actor, 'redraw', 92, v_numbers);
    raise exception 'Se permitió un tercer intento';
  exception when others then if sqlerrm <> 'ATTEMPT_LIMIT' then raise; end if; end;
  v_result := public.advance_draw_event(v_event, v_actor, 'skip', 92, v_numbers);
  if v_result->>'number' <> '222' or v_result->>'position' <> '2' then
    raise exception 'No se pasó al siguiente premio';
  end if;
  perform public.advance_draw_event(v_event, v_actor, 'redraw', 222, v_numbers);
  select count(*) into v_count from public.audit_logs where entity_id = v_event::text and action = 'draw.number_revealed';
  v_result := public.advance_draw_event(v_event, v_actor, 'skip', 303, v_numbers);
  if v_result->>'number' is not null or (select count(*) from public.audit_logs
    where entity_id = v_event::text and action = 'draw.number_revealed') <> v_count then
    raise exception 'Se extrajo otro número al cerrar el último premio';
  end if;
  if (select count(*) from public.audit_logs where entity_id = v_event::text and action = 'draw.prize_unawarded') <> 2
    or (select count(*) from public.audit_logs where entity_id = v_event::text and action = 'draw.number_absent') <> 4 then
    raise exception 'No se registraron ambos premios sin adjudicar y las cuatro ausencias';
  end if;
  begin
    perform public.advance_draw_event(v_event, v_actor, 'skip', 303, v_numbers);
    raise exception 'Se repitió el cierre del premio';
  exception when others then if sqlerrm <> 'PRIZE_CLOSED' then raise; end if; end;
  begin
    perform public.advance_draw_event(v_event, v_actor, 'extract', 303, v_numbers);
    raise exception 'Se avanzó después del último premio';
  exception when others then if sqlerrm <> 'DRAW_FINISHED' then raise; end if; end;
  -- Adjudicación normal: avanzar tras el primer intento no genera una ausencia.
  delete from public.audit_logs where entity_id = v_event::text and action <> 'draw.sequence_prepared';
  insert into public.audit_logs (action, entity_type, entity_id, payload)
    values ('draw.number_revealed', 'event', v_event::text, '{"number":347,"position":1}');
  perform public.advance_draw_event(v_event, v_actor, 'extract', 347, v_numbers);
  if exists (select 1 from public.audit_logs where entity_id = v_event::text and action = 'draw.number_absent') then
    raise exception 'Se marcó ausente un número adjudicado';
  end if;
  -- Agotamiento: una repetición fallida no registra una ausencia parcial.
  delete from public.audit_logs where entity_id = v_event::text and action <> 'draw.sequence_prepared';
  insert into public.audit_logs (action, entity_type, entity_id, payload)
    values ('draw.number_revealed', 'event', v_event::text, '{"number":347,"position":1}');
  begin
    perform public.advance_draw_event(v_event, v_actor, 'redraw', 347, array[347]);
    raise exception 'Se aceptó una extracción sin números';
  exception when others then if sqlerrm <> 'NO_ELIGIBLE_ENTRIES' then raise; end if; end;
  if exists (select 1 from public.audit_logs where entity_id = v_event::text and action = 'draw.number_absent') then
    raise exception 'Una extracción fallida registró una ausencia';
  end if;
  perform public.advance_draw_event(v_event, v_actor, 'redraw', 347, array[347,92]);
  v_result := public.advance_draw_event(v_event, v_actor, 'skip', 92, array[347,92]);
  if v_result->>'number' is not null or not exists (select 1 from public.audit_logs
    where entity_id = v_event::text and action = 'draw.prize_unawarded') then
    raise exception 'No se cerró el premio sin números restantes';
  end if;
end;
$$;
rollback;
