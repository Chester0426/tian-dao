-- Auto-cascade body 巔峰 breakthroughs at the column level via trigger.
--
-- Invariant: post-煉體 + body_level >= 9 → body_xp < body_xp_for_stage(body_level).
-- The BEFORE UPDATE trigger enforces this whenever any RPC writes body_xp.
-- Mine_action, combat, offline-rewards, breakthrough — none of them need to
-- know about the cascade. The column self-corrects.

CREATE OR REPLACE FUNCTION public.body_xp_for_stage(p_level integer)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level <= 0 THEN 200::bigint
    WHEN p_level = 1 THEN 200::bigint
    WHEN p_level = 2 THEN 300::bigint
    WHEN p_level = 3 THEN 500::bigint
    WHEN p_level = 4 THEN 700::bigint
    WHEN p_level = 5 THEN 900::bigint
    WHEN p_level = 6 THEN 1100::bigint
    WHEN p_level = 7 THEN 1300::bigint
    WHEN p_level = 8 THEN 1500::bigint
    -- Level 9+ (巔峰+N): 1500 * 1.1^(level - 8)
    ELSE FLOOR(1500 * POWER(1.1, p_level - 8))::bigint
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_cascade_body_breakthroughs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
  v_required bigint;
BEGIN
  IF COALESCE(NEW.realm, '煉體') != '煉體'
     AND NEW.body_level >= 9
     AND NEW.body_xp IS DISTINCT FROM OLD.body_xp THEN
    LOOP
      EXIT WHEN v_count >= 200;
      v_required := body_xp_for_stage(NEW.body_level);
      EXIT WHEN NEW.body_xp < v_required;
      NEW.body_xp := NEW.body_xp - v_required;
      NEW.body_level := NEW.body_level + 1;
      v_count := v_count + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cascade_body_breakthroughs ON public.profiles;
CREATE TRIGGER cascade_body_breakthroughs
BEFORE UPDATE OF body_xp ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_cascade_body_breakthroughs();
