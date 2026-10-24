-- Game Data v3.10.1 · Executa al SQL Editor del projecte existent (reexecutable).
-- No esborra dades. Les operacions sensibles de rellotge/canvi/desfer passen
-- a ser transaccions indivisibles i els identificadors d'acció eviten duplicats.
-- Revisió 3.10.1: corregides les condicions IF del rellotge i de la substitució.

alter table public.game_events add column if not exists client_action_id uuid;
create unique index if not exists game_events_client_action_id_key
  on public.game_events(client_action_id) where client_action_id is not null;

create or replace function public.record_game_event(
  p_game_id uuid, p_action_id uuid, p_event_type text,
  p_side text default null, p_player_id uuid default null,
  p_points integer default null, p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partit inexistent'; end if;
  if exists (select 1 from public.game_events where client_action_id = p_action_id) then return; end if;
  if v_game.status <> 'live' then raise exception 'El partit no està en curs'; end if;
  if p_event_type not in ('score', 'foul', 'timeout') then raise exception 'Tipus d''acció no permès'; end if;
  insert into public.game_events
    (game_id, client_action_id, event_type, side, player_id, period, clock_seconds, points, metadata)
  values
    (p_game_id, p_action_id, p_event_type, p_side, p_player_id,
     v_game.current_period, v_game.current_clock_seconds, p_points, coalesce(p_metadata, '{}'::jsonb));
end; $$;

create or replace function public.record_game_clock(
  p_game_id uuid, p_action_id uuid, p_period integer,
  p_clock_seconds integer, p_player_ids uuid[], p_source text,
  p_expected_period integer, p_expected_clock_seconds integer
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partit inexistent'; end if;
  if exists (select 1 from public.game_events where client_action_id = p_action_id) then return; end if;
  if v_game.status <> 'live' then raise exception 'El partit no està en curs'; end if;
  if v_game.current_period is distinct from p_expected_period or
     v_game.current_clock_seconds is distinct from p_expected_clock_seconds then
    raise exception 'El rellotge ha canviat en un altre dispositiu; actualitza el partit i torna-ho a provar';
  end if;
  -- Evita CASE ... THEN dins de l'IF: el parser PL/pgSQL el pot interpretar
  -- com el THEN propi de l'IF i donar error de sintaxi.
  if p_period is null or p_clock_seconds is null or p_period < 1 or p_clock_seconds < 0 or
     (p_period <= 4 and p_clock_seconds > 600) or
     (p_period > 4 and p_clock_seconds > 300) then
    raise exception 'Temps o període no vàlids';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_player_ids, '{}'::uuid[])) as x(id)
    where not exists (
      select 1 from public.game_players gp
      where gp.id = x.id and gp.game_id = p_game_id and gp.side = 'home'
    )
  ) then raise exception 'L''alineació conté jugadors d''un altre partit'; end if;
  update public.games set current_period = p_period, current_clock_seconds = p_clock_seconds
    where id = p_game_id;
  insert into public.game_events
    (game_id, client_action_id, event_type, side, period, clock_seconds, metadata)
  values
    (p_game_id, p_action_id, 'lineup_check', v_game.team_side, p_period, p_clock_seconds,
     jsonb_build_object('player_ids', coalesce(p_player_ids, '{}'::uuid[]), 'source', p_source));
end; $$;

create or replace function public.record_game_substitution(
  p_game_id uuid, p_action_id uuid, p_out_id uuid, p_in_id uuid,
  p_clock_seconds integer, p_expected_period integer, p_expected_clock_seconds integer
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partit inexistent'; end if;
  if exists (select 1 from public.game_events where client_action_id = p_action_id) then return; end if;
  if v_game.status <> 'live' then raise exception 'El partit no està en curs'; end if;
  if v_game.current_period is distinct from p_expected_period or
     v_game.current_clock_seconds is distinct from p_expected_clock_seconds then
    raise exception 'El rellotge ha canviat en un altre dispositiu; actualitza el partit i torna-ho a provar';
  end if;
  if p_clock_seconds is null or p_clock_seconds < 0 or
     (v_game.current_period <= 4 and p_clock_seconds > 600) or
     (v_game.current_period > 4 and p_clock_seconds > 300) then
    raise exception 'Temps no vàlid';
  end if;
  if p_out_id = p_in_id or
     (select count(*) from public.game_players where id in (p_out_id, p_in_id)
       and game_id = p_game_id and side = 'home') <> 2 then
    raise exception 'Cal seleccionar dos jugadors de Kids&Us d''aquest partit';
  end if;
  insert into public.game_events
    (game_id, client_action_id, event_type, side, player_id, related_player_id,
     period, clock_seconds, metadata)
  values
    (p_game_id, p_action_id, 'substitution', v_game.team_side, p_out_id, p_in_id,
     v_game.current_period, p_clock_seconds, '{}'::jsonb);
  update public.games set current_clock_seconds = p_clock_seconds where id = p_game_id;
end; $$;

create or replace function public.undo_game_action(p_game_id uuid, p_event_id uuid default null)
returns boolean language plpgsql security invoker set search_path = public as $$
declare v_game public.games%rowtype; v_target public.game_events%rowtype;
        v_last_clock_event_id uuid; v_previous public.game_events%rowtype;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partit inexistent'; end if;
  if p_event_id is null then
    select * into v_target from public.game_events
      where game_id = p_game_id and undone_at is null
      order by created_at desc, id desc limit 1 for update;
  else
    select * into v_target from public.game_events
      where id = p_event_id and game_id = p_game_id and undone_at is null for update;
  end if;
  if not found then return false; end if;
  select id into v_last_clock_event_id from public.game_events
    where game_id = p_game_id and undone_at is null
      and event_type in ('substitution', 'lineup_check')
    order by created_at desc, id desc limit 1;
  update public.game_events set undone_at = now() where id = v_target.id;
  if v_last_clock_event_id = v_target.id then
    select * into v_previous from public.game_events
      where game_id = p_game_id and undone_at is null
        and event_type in ('substitution', 'lineup_check')
      order by created_at desc, id desc limit 1;
    if found then
      update public.games set current_period = v_previous.period,
        current_clock_seconds = v_previous.clock_seconds where id = p_game_id;
    else
      update public.games set current_period = 1,
        current_clock_seconds = 600 where id = p_game_id;
    end if;
  end if;
  return true;
end; $$;

revoke all on function public.record_game_event(uuid,uuid,text,text,uuid,integer,jsonb) from public;
revoke all on function public.record_game_clock(uuid,uuid,integer,integer,uuid[],text,integer,integer) from public;
revoke all on function public.record_game_substitution(uuid,uuid,uuid,uuid,integer,integer,integer) from public;
revoke all on function public.undo_game_action(uuid,uuid) from public;
grant execute on function public.record_game_event(uuid,uuid,text,text,uuid,integer,jsonb) to authenticated;
grant execute on function public.record_game_clock(uuid,uuid,integer,integer,uuid[],text,integer,integer) to authenticated;
grant execute on function public.record_game_substitution(uuid,uuid,uuid,uuid,integer,integer,integer) to authenticated;
grant execute on function public.undo_game_action(uuid,uuid) to authenticated;
