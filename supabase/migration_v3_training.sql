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

alter table public.training_players add column if not exists attendance_credit integer not null default 0;
alter table public.training_players add column if not exists shooting_points_credit integer not null default 0;
alter table public.training_players add column if not exists free_throw_points_credit integer not null default 0;
alter table public.training_players add column if not exists competition_points_credit integer not null default 0;

create table if not exists public.training_imported_points (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.training_players(id) on delete cascade,
  category text not null check (category in ('shooting', 'free_throw', 'competition')),
  points integer not null default 0 check (points >= 0),
  source_key text not null unique,
  created_at timestamptz not null default now(),
  primary key (session_id, player_id, category)
);

create index if not exists idx_training_players_season on public.training_players(season_id, active, name);
create index if not exists idx_training_sessions_season_date on public.training_sessions(season_id, session_date desc);
create index if not exists idx_training_attendance_player on public.training_attendance(player_id, status);
create index if not exists idx_training_competitions_session on public.training_competitions(session_id, category);
create index if not exists idx_training_results_player on public.training_competition_results(player_id);
create index if not exists idx_training_imported_points_player on public.training_imported_points(player_id, category);

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
alter table public.training_imported_points enable row level security;

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
drop policy if exists "authenticated_all_training_imported_points" on public.training_imported_points;
create policy "authenticated_all_training_imported_points" on public.training_imported_points for all to authenticated using (true) with check (true);

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
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'training_imported_points') then
    alter publication supabase_realtime add table public.training_imported_points;
  end if;
end $$;
