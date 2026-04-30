-- Update mine_action to return post-trigger body_level + body_xp + body_breakthroughs.
--
-- The body_xp BEFORE UPDATE trigger (cascade_body_breakthroughs) mutates body_level
-- atomically when body_xp is updated. mine_action now uses UPDATE...RETURNING to
-- pick up the post-trigger values, so the client receives the canonical state and
-- can drop its 3 client-side cascade loops.

CREATE OR REPLACE FUNCTION public.mine_action(p_slot integer, p_mine_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_double_chance numeric;
  v_mastery_level integer;
  v_drops jsonb := '[]'::jsonb;
  v_drop_map jsonb := '{}'::jsonb;
  v_cd record;
  v_item text;
  v_qty integer;
  v_is_equipment boolean;
  v_xp_mining integer;
  v_xp_mastery integer;
  v_xp_body integer;
  v_total_xp_mining bigint := 0;
  v_total_xp_mastery bigint := 0;
  v_total_xp_body bigint := 0;
  v_new_mining_xp bigint;
  v_new_mining_level integer;
  v_new_mastery_xp bigint;
  v_new_mastery_level integer;
  v_new_body_xp bigint;
  v_final_body_xp bigint;
  v_final_body_level integer;
  v_old_body_level integer;
  v_leveled_up_mining boolean := false;
  v_leveled_up_mastery boolean := false;
  v_old_mining_level integer;
  v_old_mastery_level integer;
  v_rock_hp integer;
  v_rock_max_hp integer;
  v_respawn_seconds integer;
  v_respawn_threshold_ms integer;
  v_equip_suffixes text[] := ARRAY['_sword','_shield','_helmet','_shoulder','_chest','_pants','_gloves','_boots','_necklace','_cape','_ring','_accessory'];
  v_equip_prefixes text[] := ARRAY['copper_','poor_','bronze_','iron_','silver_'];
  v_suffix text;
  v_prefix text;
  v_tick_interval_ms integer;
  v_last_tick_at timestamptz;
  v_elapsed_ms bigint;
  v_ticks_owed integer;
  v_main_qty integer;
  v_tick_idx integer;
  v_now timestamptz := now();
  v_next_tick_in_ms integer;
  v_regen_amount integer;
  v_regen_elapsed_seconds integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;

  SELECT * INTO v_session FROM idle_sessions
  WHERE user_id = v_user_id AND slot = p_slot AND type = 'mining' AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_mining'); END IF;
  IF v_session.mine_id IS DISTINCT FROM p_mine_id THEN
    RETURN jsonb_build_object('error', 'mine_mismatch');
  END IF;

  v_tick_interval_ms := COALESCE(v_session.tick_interval_ms, 3000);
  v_last_tick_at := COALESCE(v_session.last_tick_at, v_session.started_at);
  v_elapsed_ms := EXTRACT(EPOCH FROM (v_now - v_last_tick_at)) * 1000;
  v_ticks_owed := FLOOR(v_elapsed_ms / v_tick_interval_ms)::integer;

  SELECT * INTO v_mine FROM mines WHERE id = p_mine_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'mine_not_found'); END IF;

  v_main_drop := COALESCE(v_mine.main_drop, 'coal');
  v_companion_drops := COALESCE(v_mine.companion_drops, '[]'::jsonb);
  v_xp_mining := v_mine.xp_mining;
  v_xp_mastery := v_mine.xp_mastery;
  v_xp_body := v_mine.xp_body;
  v_respawn_seconds := v_mine.respawn_seconds;
  v_respawn_threshold_ms := v_respawn_seconds * 1000 - 500;

  SELECT level INTO v_mastery_level FROM mine_masteries
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;
  IF NOT FOUND THEN v_mastery_level := 1; END IF;
  v_rock_max_hp := v_mine.rock_base_hp + v_mastery_level;
  v_double_chance := LEAST(v_mastery_level * 0.5, 25.0) / 100.0;

  SELECT * INTO v_rock FROM mine_rock_state
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO mine_rock_state (user_id, slot, mine_id, current_hp, depleted_at, last_active_at)
    VALUES (v_user_id, p_slot, p_mine_id, v_rock_max_hp, NULL, v_now)
    RETURNING * INTO v_rock;
  END IF;

  IF v_rock.current_hp = 0 AND v_rock.depleted_at IS NULL THEN
    UPDATE mine_rock_state
    SET depleted_at = v_now, last_active_at = v_now
    WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;
    UPDATE idle_sessions
    SET last_sync_at = v_now, last_tick_at = v_now
    WHERE user_id = v_user_id AND slot = p_slot AND type = 'mining' AND ended_at IS NULL;
    RETURN jsonb_build_object(
      'ticks_processed', 0, 'drops', '[]'::jsonb,
      'xp', jsonb_build_object('mining', 0, 'mastery', 0, 'body', 0),
      'mining_level', (SELECT level FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mining_xp', (SELECT xp FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mastery_level', v_mastery_level,
      'mastery_xp', COALESCE((SELECT xp FROM mine_masteries WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id), 0),
      'body_xp', (SELECT COALESCE(body_xp, 0) FROM profiles WHERE user_id = v_user_id AND slot = p_slot),
      'body_level', (SELECT COALESCE(body_level, 1) FROM profiles WHERE user_id = v_user_id AND slot = p_slot),
      'rock_hp', 0, 'rock_max_hp', v_rock_max_hp,
      'depleted_at', v_now,
      'last_tick_at', v_now, 'next_tick_in_ms', v_tick_interval_ms,
      'tick_interval_ms', v_tick_interval_ms,
      'leveled_up_mining', false, 'leveled_up_mastery', false,
      'body_breakthroughs', 0
    );
  END IF;

  IF v_rock.depleted_at IS NOT NULL AND (v_now - v_rock.depleted_at) >= (v_respawn_threshold_ms * interval '1 millisecond') THEN
    v_rock_hp := v_rock_max_hp;
    v_last_tick_at := v_rock.depleted_at + (v_respawn_seconds * interval '1 second');
    UPDATE mine_rock_state
    SET current_hp = v_rock_hp, depleted_at = NULL, last_active_at = v_now
    WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;
    UPDATE idle_sessions
    SET last_sync_at = v_now, last_tick_at = v_last_tick_at
    WHERE user_id = v_user_id AND slot = p_slot AND type = 'mining' AND ended_at IS NULL;
    v_elapsed_ms := EXTRACT(EPOCH FROM (v_now - v_last_tick_at)) * 1000;
    v_next_tick_in_ms := GREATEST(0, v_tick_interval_ms - v_elapsed_ms::integer);
    RETURN jsonb_build_object(
      'ticks_processed', 0, 'drops', '[]'::jsonb,
      'xp', jsonb_build_object('mining', 0, 'mastery', 0, 'body', 0),
      'mining_level', (SELECT level FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mining_xp', (SELECT xp FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mastery_level', v_mastery_level,
      'mastery_xp', COALESCE((SELECT xp FROM mine_masteries WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id), 0),
      'body_xp', (SELECT COALESCE(body_xp, 0) FROM profiles WHERE user_id = v_user_id AND slot = p_slot),
      'body_level', (SELECT COALESCE(body_level, 1) FROM profiles WHERE user_id = v_user_id AND slot = p_slot),
      'rock_hp', v_rock_hp, 'rock_max_hp', v_rock_max_hp,
      'depleted_at', NULL, 'respawned', true,
      'last_tick_at', v_last_tick_at, 'next_tick_in_ms', v_next_tick_in_ms,
      'tick_interval_ms', v_tick_interval_ms,
      'leveled_up_mining', false, 'leveled_up_mastery', false,
      'body_breakthroughs', 0
    );
  END IF;

  IF v_rock.depleted_at IS NULL AND v_rock.current_hp < v_rock_max_hp THEN
    v_regen_elapsed_seconds := FLOOR(EXTRACT(EPOCH FROM (v_now - v_rock.last_active_at)));
    v_regen_amount := FLOOR(v_regen_elapsed_seconds / 10);
    IF v_regen_amount > 0 THEN
      v_rock.current_hp := LEAST(v_rock_max_hp, v_rock.current_hp + v_regen_amount);
    END IF;
  END IF;
  IF v_rock.current_hp > v_rock_max_hp THEN v_rock.current_hp := v_rock_max_hp; END IF;

  IF v_ticks_owed <= 0 THEN
    v_next_tick_in_ms := GREATEST(0, v_tick_interval_ms - v_elapsed_ms::integer);
    UPDATE mine_rock_state SET current_hp = v_rock.current_hp, last_active_at = v_now
    WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;
    RETURN jsonb_build_object(
      'ticks_processed', 0, 'drops', '[]'::jsonb,
      'xp', jsonb_build_object('mining', 0, 'mastery', 0, 'body', 0),
      'mining_level', (SELECT level FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mining_xp', (SELECT xp FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot),
      'mastery_level', v_mastery_level,
      'mastery_xp', COALESCE((SELECT xp FROM mine_masteries WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id), 0),
      'body_xp', (SELECT COALESCE(body_xp, 0) FROM profiles WHERE user_id = v_user_id AND slot = p_slot),
      'body_level', (SELECT COALESCE(body_level, 1) FROM profiles WHERE user_id = v_user_id AND slot = p_slot),
      'rock_hp', v_rock.current_hp, 'rock_max_hp', v_rock_max_hp,
      'depleted_at', v_rock.depleted_at,
      'last_tick_at', v_last_tick_at, 'next_tick_in_ms', v_next_tick_in_ms,
      'tick_interval_ms', v_tick_interval_ms,
      'leveled_up_mining', false, 'leveled_up_mastery', false,
      'body_breakthroughs', 0
    );
  END IF;

  v_ticks_owed := LEAST(v_ticks_owed, FLOOR((12 * 3600 * 1000) / v_tick_interval_ms)::integer);
  v_rock_hp := v_rock.current_hp;

  FOR v_tick_idx IN 1..v_ticks_owed LOOP
    IF v_rock.depleted_at IS NOT NULL THEN CONTINUE; END IF;
    v_main_qty := CASE WHEN random() < v_double_chance THEN 2 ELSE 1 END;
    IF v_drop_map ? v_main_drop THEN
      v_drop_map := jsonb_set(v_drop_map, ARRAY[v_main_drop], to_jsonb((v_drop_map->>v_main_drop)::integer + v_main_qty));
    ELSE
      v_drop_map := v_drop_map || jsonb_build_object(v_main_drop, v_main_qty);
    END IF;
    IF jsonb_array_length(v_companion_drops) > 0 THEN
      FOR v_cd IN SELECT * FROM jsonb_to_recordset(v_companion_drops) AS x(item text, chance numeric) LOOP
        IF random() < v_cd.chance THEN
          IF v_drop_map ? v_cd.item THEN
            v_drop_map := jsonb_set(v_drop_map, ARRAY[v_cd.item], to_jsonb((v_drop_map->>v_cd.item)::integer + 1));
          ELSE
            v_drop_map := v_drop_map || jsonb_build_object(v_cd.item, 1);
          END IF;
        END IF;
      END LOOP;
    END IF;
    v_total_xp_mining := v_total_xp_mining + v_xp_mining;
    v_total_xp_mastery := v_total_xp_mastery + v_xp_mastery;
    v_total_xp_body := v_total_xp_body + v_xp_body;
    v_rock_hp := v_rock_hp - 1;
    IF v_rock_hp <= 0 THEN v_rock_hp := 0; v_rock.depleted_at := v_now; END IF;
  END LOOP;

  UPDATE mine_rock_state SET current_hp = v_rock_hp, depleted_at = v_rock.depleted_at, last_active_at = v_now
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;

  FOR v_item, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_drop_map) LOOP
    v_is_equipment := false;
    FOREACH v_prefix IN ARRAY v_equip_prefixes LOOP
      IF v_item LIKE v_prefix || '%' THEN
        FOREACH v_suffix IN ARRAY v_equip_suffixes LOOP
          IF v_item LIKE '%' || v_suffix THEN v_is_equipment := true; EXIT; END IF;
        END LOOP;
        IF v_is_equipment THEN EXIT; END IF;
      END IF;
    END LOOP;
    IF v_is_equipment THEN
      FOR i IN 1..v_qty LOOP
        INSERT INTO inventory_items (user_id, slot, item_type, quantity) VALUES (v_user_id, p_slot, v_item, 1);
      END LOOP;
    ELSE
      INSERT INTO inventory_items (user_id, slot, item_type, quantity) VALUES (v_user_id, p_slot, v_item, v_qty)
      ON CONFLICT (user_id, slot, item_type) DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity;
    END IF;
  END LOOP;

  v_drops := '[]'::jsonb;
  FOR v_item, v_qty IN SELECT key, value::integer FROM jsonb_each_text(v_drop_map) LOOP
    v_drops := v_drops || jsonb_build_array(jsonb_build_object('item', v_item, 'qty', v_qty));
  END LOOP;

  SELECT * INTO v_mining FROM mining_skills WHERE user_id = v_user_id AND slot = p_slot FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO mining_skills (user_id, slot, level, xp) VALUES (v_user_id, p_slot, 1, 0) RETURNING * INTO v_mining;
  END IF;
  v_old_mining_level := v_mining.level;
  v_new_mining_xp := v_mining.xp + v_total_xp_mining;
  v_new_mining_level := v_mining.level;
  WHILE v_new_mining_level < 500 AND v_new_mining_xp >= total_mining_xp_for_level(v_new_mining_level + 1) LOOP
    v_new_mining_level := v_new_mining_level + 1;
  END LOOP;
  UPDATE mining_skills SET xp = v_new_mining_xp, level = v_new_mining_level WHERE user_id = v_user_id AND slot = p_slot;
  v_leveled_up_mining := v_new_mining_level > v_old_mining_level;

  SELECT * INTO v_mastery FROM mine_masteries WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO mine_masteries (user_id, slot, mine_id, level, xp) VALUES (v_user_id, p_slot, p_mine_id, 1, v_total_xp_mastery) RETURNING * INTO v_mastery;
    v_old_mastery_level := 1; v_new_mastery_xp := v_total_xp_mastery; v_new_mastery_level := 1;
  ELSE
    v_old_mastery_level := v_mastery.level;
    v_new_mastery_xp := v_mastery.xp + v_total_xp_mastery;
    v_new_mastery_level := v_mastery.level;
  END IF;
  WHILE v_new_mastery_level < 99 AND v_new_mastery_xp >= melvor_xp_for_level(v_new_mastery_level + 1) LOOP
    v_new_mastery_level := v_new_mastery_level + 1;
  END LOOP;
  UPDATE mine_masteries SET xp = v_new_mastery_xp, level = v_new_mastery_level
  WHERE user_id = v_user_id AND slot = p_slot AND mine_id = p_mine_id;
  v_leveled_up_mastery := v_new_mastery_level > v_old_mastery_level;

  -- Body XP write — cascade trigger handles body_level. RETURNING gives post-trigger values.
  SELECT body_level INTO v_old_body_level FROM profiles
  WHERE user_id = v_user_id AND slot = p_slot;
  SELECT body_xp INTO v_new_body_xp FROM profiles
  WHERE user_id = v_user_id AND slot = p_slot FOR UPDATE;
  v_new_body_xp := COALESCE(v_new_body_xp, 0) + v_total_xp_body;
  UPDATE profiles SET body_xp = v_new_body_xp
  WHERE user_id = v_user_id AND slot = p_slot
  RETURNING body_xp, body_level INTO v_final_body_xp, v_final_body_level;

  v_last_tick_at := v_last_tick_at + (v_ticks_owed * v_tick_interval_ms * interval '1 millisecond');
  UPDATE idle_sessions SET last_sync_at = v_now, last_tick_at = v_last_tick_at
  WHERE user_id = v_user_id AND slot = p_slot AND type = 'mining' AND ended_at IS NULL;

  v_elapsed_ms := EXTRACT(EPOCH FROM (v_now - v_last_tick_at)) * 1000;
  v_next_tick_in_ms := GREATEST(0, v_tick_interval_ms - v_elapsed_ms::integer);

  RETURN jsonb_build_object(
    'ticks_processed', v_ticks_owed,
    'drops', v_drops,
    'xp', jsonb_build_object('mining', v_total_xp_mining, 'mastery', v_total_xp_mastery, 'body', v_total_xp_body),
    'mining_level', v_new_mining_level, 'mining_xp', v_new_mining_xp,
    'mastery_level', v_new_mastery_level, 'mastery_xp', v_new_mastery_xp,
    'body_xp', v_final_body_xp,
    'body_level', v_final_body_level,
    'body_breakthroughs', GREATEST(0, COALESCE(v_final_body_level, 1) - COALESCE(v_old_body_level, 1)),
    'rock_hp', v_rock_hp, 'rock_max_hp', v_rock_max_hp,
    'depleted_at', v_rock.depleted_at,
    'last_tick_at', v_last_tick_at, 'next_tick_in_ms', v_next_tick_in_ms,
    'tick_interval_ms', v_tick_interval_ms,
    'leveled_up_mining', v_leveled_up_mining, 'leveled_up_mastery', v_leveled_up_mastery
  );
END;
$function$;
