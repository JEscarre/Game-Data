-- Kids&Us Manresa · Game Data · v3.6
-- Correcció del bonus "2 FREE THROWS MADE".
--
-- Regla correcta a partir de v3.6:
--   quan el 2/2 està activat, TOTS els jugadors presents a l'entrenament
--   reben +1 punt de Free Throws, també els jugadors que ja tenen punts
--   de la classificació 4/3/2/1 d'aquella competició.
--
-- La v3.2-v3.5 guardava +1 com una fila sintètica (place = null) només per
-- als jugadors sense puntuació de classificació. La v3.6 deriva el bonus
-- directament de training_attendance + free_throw_bonus_made. Per això
-- eliminem les antigues files sintètiques per deixar a la taula només els
-- punts base 4/3/2/1. No s'elimina cap competició, assistència ni resultat
-- de classificació.

begin;

-- Normalitza qualsevol resultat classificat perquè guardi només el punt base.
-- És idempotent i protegeix també contra possibles proves intermèdies.
update public.training_competition_results as r
set points = 5 - r.place
from public.training_competitions as c
where r.competition_id = c.id
  and c.category = 'free_throw'
  and c.free_throw_bonus_made = true
  and r.place is not null
  and r.points <> 5 - r.place;

-- Elimina exclusivament les files antigues de bonus sense posició.
delete from public.training_competition_results as r
using public.training_competitions as c
where r.competition_id = c.id
  and c.category = 'free_throw'
  and c.free_throw_bonus_made = true
  and r.place is null
  and r.points = 1;

commit;
