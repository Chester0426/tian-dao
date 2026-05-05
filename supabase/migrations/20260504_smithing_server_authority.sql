-- Smithing server-authority: recipes table + smithing_tick RPC.
-- Mirrors mining/meditation pattern: idle_sessions(type='smithing', payload={recipe_id})
-- + tick RPC that consumes materials/heat, produces items, awards XP.

-- =============================================================================
-- 1. Recipes table — seeded from src/lib/smithing.ts (single source of truth).
-- =============================================================================
CREATE TABLE IF NOT EXISTS smithing_recipes (
  id text PRIMARY KEY,
  kind text NOT NULL,
  output_item text NOT NULL,
  output_quantity integer NOT NULL DEFAULT 1,
  level_req integer NOT NULL DEFAULT 1,
  materials jsonb NOT NULL,
  heat_cost integer NOT NULL,
  time_seconds integer NOT NULL,
  xp integer NOT NULL,
  CHECK (kind IN ('smelt', 'forge')),
  CHECK (output_quantity > 0),
  CHECK (heat_cost >= 0),
  CHECK (time_seconds > 0)
);

ALTER TABLE smithing_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes are public read" ON smithing_recipes FOR SELECT USING (true);

-- Smelting
INSERT INTO smithing_recipes (id, kind, output_item, level_req, materials, heat_cost, time_seconds, xp) VALUES
  ('copper_bar', 'smelt', 'copper_bar', 1,  '[{"item":"copper_ore","qty":1},{"item":"coal","qty":1}]'::jsonb, 0, 5, 10),
  ('tin_bar',   'smelt', 'tin_bar',    25, '[{"item":"tin_ore","qty":1},{"item":"coal","qty":2}]'::jsonb, 0, 8, 25),
  ('iron_bar',   'smelt', 'iron_bar',   50, '[{"item":"iron_ore","qty":1},{"item":"coal","qty":4}]'::jsonb, 0, 10, 50),
  ('silver_bar', 'smelt', 'silver_bar', 75, '[{"item":"silver_ore","qty":1},{"item":"coal","qty":8}]'::jsonb, 0, 12, 85)
ON CONFLICT (id) DO NOTHING;

-- Copper forging (base tier)
INSERT INTO smithing_recipes (id, kind, output_item, level_req, materials, heat_cost, time_seconds, xp) VALUES
  ('copper_sword',     'forge', 'copper_sword',     1,  '[{"item":"copper_bar","qty":3}]'::jsonb, 60,  8, 15),
  ('copper_shield',    'forge', 'copper_shield',    3,  '[{"item":"copper_bar","qty":3}]'::jsonb, 60,  8, 15),
  ('copper_helmet',    'forge', 'copper_helmet',    5,  '[{"item":"copper_bar","qty":2}]'::jsonb, 40,  6, 12),
  ('copper_shoulder',  'forge', 'copper_shoulder',  6,  '[{"item":"copper_bar","qty":2}]'::jsonb, 40,  6, 12),
  ('copper_chest',     'forge', 'copper_chest',     8,  '[{"item":"copper_bar","qty":5}]'::jsonb, 100, 10, 20),
  ('copper_pants',     'forge', 'copper_pants',     10, '[{"item":"copper_bar","qty":4}]'::jsonb, 80,  8, 18),
  ('copper_gloves',    'forge', 'copper_gloves',    12, '[{"item":"copper_bar","qty":2}]'::jsonb, 40,  6, 12),
  ('copper_boots',     'forge', 'copper_boots',     14, '[{"item":"copper_bar","qty":2}]'::jsonb, 40,  6, 12),
  ('copper_necklace',  'forge', 'copper_necklace',  16, '[{"item":"copper_bar","qty":2}]'::jsonb, 40,  6, 12),
  ('copper_cape',      'forge', 'copper_cape',      18, '[{"item":"copper_bar","qty":3}]'::jsonb, 60,  8, 15),
  ('copper_ring',      'forge', 'copper_ring',      20, '[{"item":"copper_bar","qty":1}]'::jsonb, 20,  5, 10),
  ('copper_accessory', 'forge', 'copper_accessory', 22, '[{"item":"copper_bar","qty":2}]'::jsonb, 40,  6, 12)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. Add 'smithing' to switch_activity tick interval map.
--    5s tick mirrors mining cadence and is divisible by all recipe times.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.switch_activity(
  p_user_id uuid,
  p_slot integer,
  p_type text,
  p_started_at timestamptz,
  p_mine_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_default_tick_ms integer;
  v_anchored_last_tick timestamptz;
  v_anchored_depleted timestamptz;
BEGIN
  v_default_tick_ms := CASE p_type
    WHEN 'mining' THEN 3000
    WHEN 'meditate' THEN 10000
    WHEN 'enlightenment' THEN 5000
    WHEN 'combat' THEN 1000
    WHEN 'smithing' THEN 5000
    ELSE 3000
  END;

  v_anchored_last_tick := GREATEST(
    now() - (v_default_tick_ms * interval '1 millisecond'),
    LEAST(p_started_at, now())
  );

  v_anchored_depleted := GREATEST(
    now() - interval '3 seconds',
    LEAST(p_started_at, now())
  );

  SELECT id, type, started_at, mine_id INTO v_existing
  FROM idle_sessions
  WHERE user_id = p_user_id AND slot = p_slot
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.started_at > p_started_at THEN
      RETURN jsonb_build_object('skipped', true, 'reason', 'newer_activity_exists');
    END IF;

    IF v_existing.type = 'mining' AND v_existing.mine_id IS NOT NULL
       AND (p_type != 'mining' OR p_mine_id IS DISTINCT FROM v_existing.mine_id) THEN
      UPDATE mine_rock_state
      SET depleted_at = NULL
      WHERE user_id = p_user_id AND slot = p_slot AND mine_id = v_existing.mine_id
        AND depleted_at IS NOT NULL;
    END IF;

    UPDATE idle_sessions SET
      type = p_type,
      started_at = p_started_at,
      last_sync_at = now(),
      last_tick_at = v_anchored_last_tick,
      tick_interval_ms = v_default_tick_ms,
      ended_at = NULL,
      mine_id = p_mine_id,
      payload = p_payload
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO idle_sessions (user_id, slot, type, started_at, last_sync_at, last_tick_at, tick_interval_ms, mine_id, payload)
    VALUES (p_user_id, p_slot, p_type, p_started_at, now(), v_anchored_last_tick, v_default_tick_ms, p_mine_id, p_payload);
  END IF;

  IF p_type = 'mining' AND p_mine_id IS NOT NULL THEN
    UPDATE mine_rock_state
    SET depleted_at = v_anchored_depleted,
        last_active_at = now()
    WHERE user_id = p_user_id AND slot = p_slot AND mine_id = p_mine_id
      AND current_hp = 0
      AND depleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'type', p_type, 'tick_interval_ms', v_default_tick_ms);
END;
$$;

-- =============================================================================
-- 3. smithing_tick — atomic tick: deduct materials/heat, produce items, award XP.
-- =============================================================================
CREATE OR REPLACE FUNCTION smithing_tick(p_slot integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_session record;
  v_recipe record;
  v_recipe_id text;
  v_now timestamptz := now();
  v_simulate_until timestamptz;
  v_anchor timestamptz;
  v_elapsed_secs numeric;
  v_max_crafts integer;
  v_crafts integer := 0;
  v_furnace_heat integer;
  v_consumed_heat integer := 0;
  v_xp_gained integer := 0;
  v_mat record;
  v_material_blocking text := NULL;
  v_heat_blocking boolean := false;
  v_inv_qty integer;
  v_can_craft boolean;
  v_safety integer := 0;
  v_next_advance interval;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- 1. Active smithing session
  SELECT * INTO v_session FROM idle_sessions
  WHERE user_id = v_user_id AND slot = p_slot AND type = 'smithing' AND ended_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_smithing');
  END IF;

  -- 2. Recipe lookup
  v_recipe_id := v_session.payload->>'recipe_id';
  IF v_recipe_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_recipe');
  END IF;

  SELECT * INTO v_recipe FROM smithing_recipes WHERE id = v_recipe_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'recipe_not_found');
  END IF;

  -- 3. Compute simulation window — cap 12h offline backlog (drains across multiple ticks)
  v_anchor := COALESCE(v_session.last_sync_at, v_session.started_at);
  v_simulate_until := LEAST(v_now, v_anchor + interval '12 hours');
  v_elapsed_secs := EXTRACT(EPOCH FROM (v_simulate_until - v_anchor));
  v_max_crafts := FLOOR(v_elapsed_secs / v_recipe.time_seconds)::integer;

  IF v_max_crafts < 1 THEN
    -- Too soon — just return current state, no advance
    SELECT furnace_heat INTO v_furnace_heat FROM profiles WHERE user_id = v_user_id AND slot = p_slot;
    RETURN jsonb_build_object(
      'ok', true,
      'crafts', 0,
      'xp_gained', 0,
      'heat_consumed', 0,
      'furnace_heat', COALESCE(v_furnace_heat, 0),
      'output', v_recipe.output_item,
      'output_total_qty', 0,
      'recipe_id', v_recipe_id,
      'recipe_time_seconds', v_recipe.time_seconds,
      'blocked_by_heat', false,
      'blocked_by_material', NULL,
      'next_event_in_ms', GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((v_anchor + (v_recipe.time_seconds * interval '1 second')) - v_now)) * 1000)::integer)
    );
  END IF;

  -- 4. Lock heat
  SELECT furnace_heat INTO v_furnace_heat FROM profiles
  WHERE user_id = v_user_id AND slot = p_slot
  FOR UPDATE;
  IF v_furnace_heat IS NULL THEN v_furnace_heat := 0; END IF;

  -- 5. Loop crafts. Stop on heat or material exhaustion.
  WHILE v_crafts < v_max_crafts LOOP
    v_safety := v_safety + 1;
    EXIT WHEN v_safety > 100000;

    IF v_furnace_heat < v_recipe.heat_cost THEN
      v_heat_blocking := true;
      EXIT;
    END IF;

    -- Check materials sufficient (no deduct yet)
    v_can_craft := true;
    FOR v_mat IN SELECT * FROM jsonb_to_recordset(v_recipe.materials) AS x(item text, qty integer) LOOP
      SELECT quantity INTO v_inv_qty FROM inventory_items
        WHERE user_id = v_user_id AND slot = p_slot AND item_type = v_mat.item;
      IF COALESCE(v_inv_qty, 0) < v_mat.qty THEN
        v_can_craft := false;
        v_material_blocking := v_mat.item;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_can_craft THEN EXIT; END IF;

    -- Deduct materials
    FOR v_mat IN SELECT * FROM jsonb_to_recordset(v_recipe.materials) AS x(item text, qty integer) LOOP
      UPDATE inventory_items
        SET quantity = quantity - v_mat.qty
        WHERE user_id = v_user_id AND slot = p_slot AND item_type = v_mat.item;
      DELETE FROM inventory_items
        WHERE user_id = v_user_id AND slot = p_slot AND item_type = v_mat.item AND quantity <= 0;
    END LOOP;

    -- Deduct heat
    v_furnace_heat := v_furnace_heat - v_recipe.heat_cost;
    v_consumed_heat := v_consumed_heat + v_recipe.heat_cost;

    -- Add output
    INSERT INTO inventory_items (user_id, slot, item_type, quantity)
    VALUES (v_user_id, p_slot, v_recipe.output_item, v_recipe.output_quantity)
    ON CONFLICT (user_id, slot, item_type)
    DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity;

    v_xp_gained := v_xp_gained + v_recipe.xp;
    v_crafts := v_crafts + 1;
  END LOOP;

  -- 6. Persist heat + XP
  UPDATE profiles SET furnace_heat = v_furnace_heat
  WHERE user_id = v_user_id AND slot = p_slot;

  IF v_xp_gained > 0 THEN
    INSERT INTO smithing_skills (user_id, slot, level, xp)
      VALUES (v_user_id, p_slot, 1, v_xp_gained)
    ON CONFLICT (user_id, slot)
    DO UPDATE SET xp = smithing_skills.xp + EXCLUDED.xp;
  END IF;

  -- 7. Advance last_sync_at by exactly crafts_done * time_seconds.
  --    Leftover sub-recipe time accumulates for next tick — no wasted progress.
  UPDATE idle_sessions
    SET last_sync_at = v_anchor + (v_crafts * v_recipe.time_seconds * interval '1 second')
    WHERE id = v_session.id;

  -- 8. Compute next_event_in_ms relative to wall clock now
  v_next_advance := (v_crafts + 1) * v_recipe.time_seconds * interval '1 second';

  RETURN jsonb_build_object(
    'ok', true,
    'crafts', v_crafts,
    'xp_gained', v_xp_gained,
    'heat_consumed', v_consumed_heat,
    'furnace_heat', v_furnace_heat,
    'output', v_recipe.output_item,
    'output_total_qty', v_crafts * v_recipe.output_quantity,
    'recipe_id', v_recipe_id,
    'recipe_time_seconds', v_recipe.time_seconds,
    'blocked_by_heat', v_heat_blocking,
    'blocked_by_material', v_material_blocking,
    'simulated_until', v_simulate_until,
    'now', v_now,
    'next_event_in_ms', GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((v_anchor + v_next_advance) - v_now)) * 1000)::integer)
  );
END;
$$;
