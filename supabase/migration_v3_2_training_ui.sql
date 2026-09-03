-- Kids&Us Manresa · Game Data · v3.2
-- Free throw "2 free throws made" bonus support.
-- Executa una sola vegada sobre el projecte que ja té la v3/v3.1 aplicada.

alter table public.training_competitions
  add column if not exists free_throw_bonus_made boolean not null default false;

-- La v3 només permetia punts si hi havia una posició 1r-4t.
-- La v3.2 permet també +1 sense posició per al bonus de 2 tirs lliures.
alter table public.training_competition_results
  drop constraint if exists training_competition_results_check;

alter table public.training_competition_results
  drop constraint if exists training_competition_results_place_points_check;

alter table public.training_competition_results
  add constraint training_competition_results_place_points_check
  check (
    (place is null and points in (0, 1))
    or
    (place is not null and points = 5 - place)
  );
