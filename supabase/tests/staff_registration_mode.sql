-- Ejecutar después de la migración; todos los datos de prueba se revierten.
begin;
do $$
declare
  v_actor uuid;
  v_event uuid;
  v_count integer;
  v_email text;
begin
  select id into v_actor from public.profiles where role = 'admin' limit 1;
  if v_actor is null then raise exception 'La prueba necesita un administrador'; end if;
  insert into public.events (name, starts_at, registration_opens_at, registration_closes_at,
    prize_count, status, club_signup_url, terms_url, privacy_url,
    assignment_seed, assignment_seed_commitment, draw_seed, draw_seed_commitment)
  values ('Prueba registro completo', now() + interval '2 hours', now() - interval '1 hour',
    now() + interval '1 hour', 3, 'scheduled', 'https://example.com/club',
    'https://example.com/terms', 'https://example.com/privacy', 'seed', 'commitment', 'draw', 'draw-commitment')
  returning id into v_event;
  if not (select staff_registration_full from public.events where id = v_event) then
    raise exception 'Las jornadas nuevas no usan el formulario completo por defecto';
  end if;
  v_email := 'test-' || v_event::text || '@example.invalid';
  begin
    perform public.invite_ticket(v_event, 'TEST-LINK', 6000, 'Persona', v_email, repeat('d', 64), v_actor);
    raise exception 'El modo completo permite nuevas invitaciones';
  exception when others then
    if sqlerrm <> 'REGISTRATION_MODE_CHANGED' then raise; end if;
  end;
  begin
    perform public.register_staff_ticket(v_event, 'Persona', 'Prueba', v_email, 'passport',
      left(replace(v_event::text, '-', ''), 20), 'ES', 'TEST-1', 8000, v_actor, true, false);
    raise exception 'Registro sin consentimiento';
  exception when others then
    if sqlerrm <> 'LEGAL_NOT_ACCEPTED' then raise; end if;
  end;
  select count(*) into v_count from public.register_staff_ticket(v_event, 'Persona', 'Prueba', v_email,
    'passport', left(replace(v_event::text, '-', ''), 20), 'ES', 'TEST-1', 8000, v_actor, true, true);
  if v_count <> 2 then raise exception 'No se asignaron dos números'; end if;
  update public.events set staff_registration_full = false where id = v_event;
  perform public.invite_ticket(v_event, 'TEST-2', 6000, 'Persona', v_email, repeat('e', 64), v_actor);
  update public.events set staff_registration_full = true where id = v_event;
  select count(*) into v_count from public.complete_ticket_invitation(repeat('e', 64), 'Prueba',
    'passport', left(replace(v_event::text, '-', ''), 20), 'ES', true);
  if v_count <> 1 then raise exception 'Cambiar el modo invalida los enlaces existentes'; end if;
end;
$$;
rollback;
