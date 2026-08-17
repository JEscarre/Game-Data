-- MIGRACIÓ v1 -> v2
-- Executa aquest fitxer UNA VEGADA al projecte Supabase que ja tens creat.
-- No elimina partits, jugadors de partits ni esdeveniments existents.
-- Sí elimina la taula de plantilla persistent, que la v2 ja no utilitza.

alter table public.game_players add column if not exists position text;

update public.game_players
set position = null
where position is not null
  and position not in ('guard', 'wing', 'big');

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
