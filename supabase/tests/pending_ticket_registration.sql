-- Prueba tras aplicar la migración: no conserva datos al terminar.
begin;

do $$
declare
  v_actor uuid;
  v_event uuid;
  v_pending uuid;
  v_count integer;
  v_email text;
  v_document text;
begin
  select id into v_actor from public.profiles where role = 'admin' limit 1;
  if v_actor is null then raise exception 'La prueba necesita un perfil administrador'; end if;

  insert into public.events (name, starts_at, registration_opens_at, registration_closes_at,
    prize_count, status, club_signup_url, terms_url, privacy_url,
    assignment_seed, assignment_seed_commitment, draw_seed, draw_seed_commitment)
  values ('Prueba de invitación', now() + interval '2 hours', now() - interval '1 hour',
    now() + interval '1 hour', 3, 'scheduled', 'https://example.com/club',
    'https://example.com/terms', 'https://example.com/privacy',
    'test-seed', 'test-commitment', 'test-draw-seed', 'test-draw-commitment')
  returning id into v_event;
  v_email := 'test-' || left(v_event::text, 8) || '@example.invalid';
  v_document := left(replace(v_event::text, '-', ''), 20);

  select pending_id into v_pending from public.invite_ticket(
    v_event, 'TEST-1', 8000, 'Persona', v_email, repeat('a', 64), v_actor);
  if v_pending is null then raise exception 'No se creó la invitación'; end if;
  if exists (select 1 from public.entries where event_id = v_event) then
    raise exception 'Se asignaron números antes de aceptar las bases';
  end if;

  perform public.invite_ticket(v_event, 'TEST-1', 8000, 'Persona', v_email, repeat('b', 64), v_actor);
  if (select count(*) from public.pending_ticket_registrations where event_id = v_event) <> 1 then
    raise exception 'Se duplicó el tiquet al reenviar';
  end if;
  if exists (select 1 from public.pending_ticket_registrations
    where id = v_pending and token_hash = repeat('a', 64)) then
    raise exception 'El enlace anterior sigue siendo válido';
  end if;

  select count(*) into v_count from public.complete_ticket_invitation(
    repeat('b', 64), 'Prova', 'passport', v_document, 'ES', true);
  if v_count <> 2 or (select count(*) from public.entries where event_id = v_event) <> 2 then
    raise exception 'La confirmación no asignó los dos números esperados';
  end if;
  if (select token_hash from public.pending_ticket_registrations where id = v_pending) is not null then
    raise exception 'El enlace sigue activo después de confirmar';
  end if;
  if (select count(distinct number) from public.entries where event_id = v_event) <> 2 then
    raise exception 'La asignación contiene números repetidos';
  end if;

  begin
    perform public.complete_ticket_invitation(repeat('b', 64), 'Prova', 'passport', v_document, 'ES', true);
    raise exception 'Se ha reutilizado un enlace de un solo uso';
  exception when others then
    if sqlerrm <> 'INVALID_LINK' then raise; end if;
  end;

  perform public.invite_ticket(v_event, 'TEST-2', 6000, 'Persona', v_email,
    repeat('c', 64), v_actor);
  update public.pending_ticket_registrations set expires_at = now() - interval '1 minute'
    where event_id = v_event and ticket_code = 'TEST-2';
  begin
    perform public.complete_ticket_invitation(repeat('c', 64), 'Prova', 'passport', v_document, 'ES', true);
    raise exception 'Se ha aceptado un enlace caducado';
  exception when others then
    if sqlerrm <> 'LINK_EXPIRED' then raise; end if;
  end;
end;
$$;

rollback;
