-- Secure mine_action: auth.uid(), cooldown, mine validation, server-side rock HP
-- =============================================================================

-- 1. Rock HP tracking table (per user+slot+mine)
CREATE TABLE IF NOT EXISTS mine_rock_state (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  slot integer NOT NULL DEFAULT 1,
  mine_id uuid NOT NULL REFERENCES mines(id),
  current_hp integer NOT NULL DEFAULT 5,
  depleted_at timestamptz,  -- NULL = alive, set when HP reaches 0
  PRIMARY KEY (user_id, slot, mine_id)
);

ALTER TABLE mine_rock_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own rock state" ON mine_rock_state
  FOR SELECT USING (auth.uid() = user_id);
-- No direct INSERT/UPDATE/DELETE from client — only via RPC

-- 2. Replace mine_action: secure version
CREATE OR REPLACE FUNCTION mine_action(p_slot integer, p_mine_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_session record;
  v_mine record;
  v_mastery record;
  v_mining record;
  v_profile record;
  v_rock record;
  v_main_drop text;
  v_companion_drops jsonb;
  v_main_qty integer := 1;
  v_double_chance numeric;
  v_mastery_level integer;
  v_drops jsonb := '[]'::jsonb;
  v_drop_map jsonb := '{}'::jsonb;
  v_cd record;
  v_item text;
  v_qty integer;
  v_is_equipment boolean;
  -- XP vars
  v_xp_mining integer;
  v_xp_mastery integer;
  v_xp_body integer;
  v_new_mining_xp bigint;
  v_new_mining_level integer;
  v_new_mastery_xp bigint;
  v_new_mastery_level integer;
  v_new_body_xp bigint;
  v_leveled_up_mining boolean := false;
  v_leveled_up_mastery boolean := false;
  v_old_mining_level integer;
  v_old_mastery_level integer;
  -- Rock HP
  v_rock_hp integer;
  v_rock_max_hp integer;
  v_rock_depleted boolean := false;
  v_respawn_seconds integer;
  -- Equipment detection
  v_equip_suffixes text[] := ARRAY['_sword','_shield','_helmet','_shoulder','_chest','_pants','_gloves','_boots','_necklace','_cape','_ring','_accessory'];
  v_equip_prefixes text[] := ARRAY['copper_','poor_','bronze_','iron_','silver_'];
  v_suffix text;
  v_prefix text;
  -- Cooldown
  v_last_sync timestamptz;
BEGIN
  -- 0. Get authenticated user (SECURITY: never trust client-provided user_id)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- 1. Verify active mining session + mine_id matches
  SELECT * INTO v_session
  FROM idle_sessions
  WHERE user_id = v_user_id
    AND slot = p_slot
    AND type = 'mining'
    AND ended_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_mining');
  END IF;

  -- Validate mine_id matches session (prevent mining wrong mine)
  IF v_session.mine_id IS DISTINCT FROM p_mine_id THEN
    RETURN jsonb_build_object('error', 'mine_mismatch');
  END IF;

  -- 2. Cooldown check: at least 2 seconds since last sync
  v_last_sync := v_session.last_sync_at;
  IF v_last_sync IS NOT NULL AND (now() - v_last_sync) < interval '2 seconds' THEN
    RETURN jsonb_build_object('error', 'cooldown');
  END IF;

  -- 3. Fetch mine data
  SELECT * INTO v_mine
  FROM mines
  WHERE id = p_mine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'mine_not_found');
  END IF;

  v_main_drop := COALESCE(v_mine.main_drop, 'coal');
  v_companion_drops := COALESCE(v_mine.companion_drops, '[]'::jsonb);
  v_xp_mining := v_mine.xp_mining;
  v_xp_mastery := v_mine.xp_mastery;
  v_xp_body := v_mine.xp_body;
  v_rock_max_hp := v_mine.rock_base_hp;
  v_respawn_seconds := v_mine.respawn_seconds;

  -- 4. Rock HP: get or create state
  SELECT * INTO v_rock
  FROM mine_rock_state
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO mine_rock_state (user_id, slot, mine_id, current_hp, depleted_at)
    VALUES (v_user_id, p_slot, p_mine_id, v_rock_max_hp, NULL)
    RETURNING * INTO v_rock;
  END IF;

  -- Check if rock is depleted and needs respawn
  IF v_rock.depleted_at IS NOT NULL THEN
    IF (now() - v_rock.depleted_at) < (v_respawn_seconds * interval '1 second') THEN
      -- Still respawning
      RETURN jsonb_build_object(
        'error', 'rock_depleted',
        'respawn_at', v_rock.depleted_at + (v_respawn_seconds * interval '1 second'),
        'rock_hp', 0,
        'rock_max_hp', v_rock_max_hp
      );
    ELSE
      -- Respawn complete: reset HP
      v_rock.current_hp := v_rock_max_hp;
      v_rock.depleted_at := NULL;
    END IF;
  END IF;

  -- Decrement rock HP
  v_rock_hp := v_rock.current_hp - 1;
  IF v_rock_hp <= 0 THEN
    v_rock_hp := 0;
    v_rock_depleted := true;
  END IF;

  -- Update rock state
  UPDATE mine_rock_state
  SET current_hp = v_rock_hp,
      depleted_at = CASE WHEN v_rock_depleted THEN now() ELSE NULL END
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;

  -- Only drop loot when rock is depleted (mined all HP)
  -- If rock still has HP, return progress only (no drops, no XP)
  IF NOT v_rock_depleted THEN
    -- Update last_sync_at
    UPDATE idle_sessions
    SET last_sync_at = now()
    WHERE user_id = v_user_id AND slot = p_slot AND type = 'mining' AND ended_at IS NULL;

    RETURN jsonb_build_object(
      'rock_hp', v_rock_hp,
      'rock_max_hp', v_rock_max_hp,
      'rock_depleted', false,
      'drops', '[]'::jsonb,
      'xp', jsonb_build_object('mining', 0, 'mastery', 0, 'body', 0),
      'mining_level', (SELECT level FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mining_xp', (SELECT xp FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mastery_level', COALESCE((SELECT level FROM mine_masteries WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id), 1),
      'mastery_xp', COALESCE((SELECT xp FROM mine_masteries WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id), 0),
      'body_xp', (SELECT COALESCE(body_xp, 0) FROM profiles WHERE user_id = v_user_id AND slot = p_slot),
      'leveled_up_mining', false,
      'leveled_up_mastery', false
    );
  END IF;

  -- === Rock depleted: award loot + XP ===

  -- 5. Roll loot
  SELECT level INTO v_mastery_level
  FROM mine_masteries
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;

  IF NOT FOUND THEN
    v_mastery_level := 1;
  END IF;

  v_double_chance := LEAST(v_mastery_level * 0.5, 25.0) / 100.0;
  IF random() < v_double_chance THEN
    v_main_qty := 2;
  END IF;

  v_drop_map := jsonb_build_object(v_main_drop, v_main_qty);

  IF jsonb_array_length(v_companion_drops) > 0 THEN
    FOR v_cd IN SELECT * FROM jsonb_to_recordset(v_companion_drops) AS x(item text, chance numeric)
    LOOP
      IF random() < v_cd.chance THEN
        IF v_drop_map ? v_cd.item THEN
          v_drop_map := jsonb_set(v_drop_map, ARRAY[v_cd.item], to_jsonb((v_drop_map->>v_cd.item)::integer + 1));
        ELSE
          v_drop_map := v_drop_map || jsonb_build_object(v_cd.item, 1);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 6. Update inventory
  FOR v_item, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_drop_map)
  LOOP
    v_is_equipment := false;
    FOREACH v_prefix IN ARRAY v_equip_prefixes LOOP
      IF v_item LIKE v_prefix || '%' THEN
        FOREACH v_suffix IN ARRAY v_equip_suffixes LOOP
          IF v_item LIKE '%' || v_suffix THEN
            v_is_equipment := true;
            EXIT;
          END IF;
        END LOOP;
        IF v_is_equipment THEN EXIT; END IF;
      END IF;
    END LOOP;

    IF v_is_equipment THEN
      FOR i IN 1..v_qty LOOP
        INSERT INTO inventory_items (user_id, slot, item_type, quantity)
        VALUES (v_user_id, p_slot, v_item, 1);
      END LOOP;
    ELSE
      INSERT INTO inventory_items (user_id, slot, item_type, quantity)
      VALUES (v_user_id, p_slot, v_item, v_qty)
      ON CONFLICT (user_id, slot, item_type) DO UPDATE
        SET quantity = inventory_items.quantity + EXCLUDED.quantity;
    END IF;
  END LOOP;

  -- Build drops array
  v_drops := '[]'::jsonb;
  FOR v_item, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_drop_map)
  LOOP
    v_drops := v_drops || jsonb_build_array(jsonb_build_object('item', v_item, 'qty', v_qty));
  END LOOP;

  -- 7. Update mining XP
  SELECT * INTO v_mining
  FROM mining_skills
  WHERE user_id = v_user_id AND slot = p_slot
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO mining_skills (user_id, slot, level, xp)
    VALUES (v_user_id, p_slot, 1, 0)
    RETURNING * INTO v_mining;
  END IF;

  v_old_mining_level := v_mining.level;
  v_new_mining_xp := v_mining.xp + v_xp_mining;
  v_new_mining_level := v_mining.level;

  WHILE v_new_mining_level < 500 AND v_new_mining_xp >= total_mining_xp_for_level(v_new_mining_level + 1) LOOP
    v_new_mining_level := v_new_mining_level + 1;
  END LOOP;

  UPDATE mining_skills
  SET xp = v_new_mining_xp, level = v_new_mining_level
  WHERE user_id = v_user_id AND slot = p_slot;

  v_leveled_up_mining := v_new_mining_level > v_old_mining_level;

  -- 8. Update mastery XP
  SELECT * INTO v_mastery
  FROM mine_masteries
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO mine_masteries (user_id, slot, mine_id, level, xp)
    VALUES (v_user_id, p_slot, p_mine_id, 1, v_xp_mastery)
    RETURNING * INTO v_mastery;

    v_old_mastery_level := 1;
    v_new_mastery_xp := v_xp_mastery;
    v_new_mastery_level := 1;
  ELSE
    v_old_mastery_level := v_mastery.level;
    v_new_mastery_xp := v_mastery.xp + v_xp_mastery;
    v_new_mastery_level := v_mastery.level;
  END IF;

  WHILE v_new_mastery_level < 99 AND v_new_mastery_xp >= melvor_xp_for_level(v_new_mastery_level + 1) LOOP
    v_new_mastery_level := v_new_mastery_level + 1;
  END LOOP;

  UPDATE mine_masteries
  SET xp = v_new_mastery_xp, level = v_new_mastery_level
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;

  v_leveled_up_mastery := v_new_mastery_level > v_old_mastery_level;

  -- 9. Update body XP
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = v_user_id AND slot = p_slot
  FOR UPDATE;

  v_new_body_xp := COALESCE(v_profile.body_xp, 0) + v_xp_body;

  UPDATE profiles
  SET body_xp = v_new_body_xp
  WHERE user_id = v_user_id AND slot = p_slot;

  -- 10. Update last_sync_at
  UPDATE idle_sessions
  SET last_sync_at = now()
  WHERE user_id = v_user_id AND slot = p_slot AND type = 'mining' AND ended_at IS NULL;

  -- 11. Return result
  RETURN jsonb_build_object(
    'drops', v_drops,
    'xp', jsonb_build_object('mining', v_xp_mining, 'mastery', v_xp_mastery, 'body', v_xp_body),
    'mining_level', v_new_mining_level,
    'mining_xp', v_new_mining_xp,
    'mastery_level', v_new_mastery_level,
    'mastery_xp', v_new_mastery_xp,
    'body_xp', v_new_body_xp,
    'leveled_up_mining', v_leveled_up_mining,
    'leveled_up_mastery', v_leveled_up_mastery,
    'rock_hp', 0,
    'rock_max_hp', v_rock_max_hp,
    'rock_depleted', true
  );
END;
$$;
