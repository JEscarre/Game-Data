-- Game Data v3.8 · Kids&Us local / visitant
-- Executa aquest fitxer UNA VEGADA sobre un projecte existent.
-- Conserva tots els partits i esdeveniments actuals.
-- Els partits existents queden com a Kids&Us local, que era el comportament anterior.

alter table public.games
  add column if not exists team_side text not null default 'home';

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

comment on column public.games.team_side is
  'Costat físic de Kids&Us Manresa al partit: home = local, away = visitant.';
