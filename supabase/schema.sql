-- Kids&Us Manresa · Game Data · esquema complet v2
-- Es pot executar en una base de dades nova. Si vens de la v1, executa preferentment migration_v2.sql.

create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null default 'Rival',
  game_date date not null default current_date,
  team_side text not null default 'home' check (team_side in ('home', 'away')),
  status text not null default 'draft' check (status in ('draft', 'live', 'finished')),
  current_period integer not null default 1 check (current_period >= 1),
  current_clock_seconds integer not null default 600 check (current_clock_seconds >= 0),
  initial_lineup uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilitat si l'esquema complet s'executa sobre una instal·lació anterior.
alter table public.games add column if not exists team_side text not null default 'home';

update public.games
set team_side = 'home'
where team_side not in ('home', 'away');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'games_team_side_check'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_team_side_check
      check (team_side in ('home', 'away'));
  end if;
end $$;

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  side text not null check (side in ('home', 'away')),
  name text not null check (length(trim(name)) > 0),
  jersey_number text not null default '',
  position text check (position in ('guard', 'wing', 'big')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Compatibilitat si aquest esquema s'executa sobre la v1.
alter table public.game_players add column if not exists position text;
alter table public.game_players drop column if exists roster_player_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_players_position_check'
      and conrelid = 'public.game_players'::regclass
  ) then
    alter table public.game_players
      add constraint game_players_position_check
      check (position is null or position in ('guard', 'wing', 'big'));
  end if;
end $$;

drop table if exists public.roster_players cascade;

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  event_type text not null check (event_type in ('score', 'foul', 'timeout', 'substitution', 'lineup_check')),
  side text check (side in ('home', 'away')),
  player_id uuid references public.game_players(id) on delete cascade,
  related_player_id uuid references public.game_players(id) on delete cascade,
  period integer not null check (period >= 1),
  clock_seconds integer not null check (clock_seconds >= 0),
  points integer check (points in (1, 2, 3)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  created_by uuid default auth.uid()
);

create index if not exists idx_game_players_game on public.game_players(game_id, side, sort_order);
create index if not exists idx_game_events_game on public.game_events(game_id, created_at);
create index if not exists idx_game_events_game_active on public.game_events(game_id, event_type) where undone_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_games_updated_at on public.games;
create trigger set_games_updated_at
before update on public.games
for each row execute function public.set_updated_at();

alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_events enable row level security;

drop policy if exists "authenticated_all_games" on public.games;
create policy "authenticated_all_games" on public.games
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_game_players" on public.game_players;
create policy "authenticated_all_game_players" on public.game_players
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_game_events" on public.game_events;
create policy "authenticated_all_game_events" on public.game_events
for all to authenticated using (true) with check (true);

create or replace function public.undo_event(p_event_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.game_events
  set undone_at = now()
  where id = p_event_id and undone_at is null;
  return found;
end;
$$;

create or replace function public.undo_last_event(p_game_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.game_events
  where game_id = p_game_id and undone_at is null
  order by created_at desc
  limit 1
  for update;

  if v_id is null then
    return false;
  end if;

  update public.game_events set undone_at = now() where id = v_id;
  return true;
end;
$$;

create or replace function public.reset_game(p_game_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.game_events where game_id = p_game_id;
  update public.games
  set status = 'live', current_period = 1, current_clock_seconds = 600
  where id = p_game_id;
end;
$$;

revoke all on function public.undo_event(uuid) from public;
revoke all on function public.undo_last_event(uuid) from public;
revoke all on function public.reset_game(uuid) from public;
grant execute on function public.undo_event(uuid) to authenticated;
grant execute on function public.undo_last_event(uuid) to authenticated;
grant execute on function public.reset_game(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games') then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_players') then
    alter publication supabase_realtime add table public.game_players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_events') then
    alter publication supabase_realtime add table public.game_events;
  end if;
end $$;


-- Kids&Us Manresa · Game Data · v3 Training module
-- Executa aquest fitxer sobre un projecte existent v2.

create extension if not exists pgcrypto;

create table if not exists public.training_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.training_players (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.training_seasons(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  jersey_number text not null default '',
  joined_on date not null,
  left_on date,
  active boolean not null default true,
  source_key text unique,
  created_at timestamptz not null default now(),
  check (left_on is null or left_on >= joined_on)
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.training_seasons(id) on delete cascade,
  session_date date not null,
  title text not null default 'Entrenament',
  counts_for_attendance boolean not null default true,
  source_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_attendance (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.training_players(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

create table if not exists public.training_competitions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  category text not null check (category in ('shooting', 'free_throw', 'competition')),
  title text not null,
  free_throw_bonus_made boolean not null default false,
  source_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.training_competition_results (
  competition_id uuid not null references public.training_competitions(id) on delete cascade,
  player_id uuid not null references public.training_players(id) on delete cascade,
  place integer check (place between 1 and 4),
  points integer not null default 0 check (points between 0 and 4),
  raw_value numeric,
  created_at timestamptz not null default now(),
  primary key (competition_id, player_id),
  check ((place is null and points in (0, 1)) or (place is not null and points = 5 - place))
);

create index if not exists idx_training_players_season on public.training_players(season_id, active, name);
create index if not exists idx_training_sessions_season_date on public.training_sessions(season_id, session_date desc);
create index if not exists idx_training_attendance_player on public.training_attendance(player_id, status);
create index if not exists idx_training_competitions_session on public.training_competitions(session_id, category);
create index if not exists idx_training_results_player on public.training_competition_results(player_id);

create or replace function public.set_training_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_training_sessions_updated_at on public.training_sessions;
create trigger set_training_sessions_updated_at
before update on public.training_sessions
for each row execute function public.set_training_updated_at();

drop trigger if exists set_training_attendance_updated_at on public.training_attendance;
create trigger set_training_attendance_updated_at
before update on public.training_attendance
for each row execute function public.set_training_updated_at();

alter table public.training_seasons enable row level security;
alter table public.training_players enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_attendance enable row level security;
alter table public.training_competitions enable row level security;
alter table public.training_competition_results enable row level security;

drop policy if exists "authenticated_all_training_seasons" on public.training_seasons;
create policy "authenticated_all_training_seasons" on public.training_seasons for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all_training_players" on public.training_players;
create policy "authenticated_all_training_players" on public.training_players for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all_training_sessions" on public.training_sessions;
create policy "authenticated_all_training_sessions" on public.training_sessions for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all_training_attendance" on public.training_attendance;
create policy "authenticated_all_training_attendance" on public.training_attendance for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all_training_competitions" on public.training_competitions;
create policy "authenticated_all_training_competitions" on public.training_competitions for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all_training_results" on public.training_competition_results;
create policy "authenticated_all_training_results" on public.training_competition_results for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_seasons') then
    alter publication supabase_realtime add table public.training_seasons;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_players') then
    alter publication supabase_realtime add table public.training_players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_sessions') then
    alter publication supabase_realtime add table public.training_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_attendance') then
    alter publication supabase_realtime add table public.training_attendance;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_competitions') then
    alter publication supabase_realtime add table public.training_competitions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_competition_results') then
    alter publication supabase_realtime add table public.training_competition_results;
  end if;
end $$;
