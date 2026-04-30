-- Server-authoritative combat: monsters table, equipment_items table, combat_tick RPC.
-- Replaces client RAF damage logic. Client now only animates; server simulates attacks
-- chronologically based on session.payload + last_sync_at, applies drops/HP/XP atomically.

-- === Monsters catalog ===
CREATE TABLE IF NOT EXISTS public.monsters (
  id text PRIMARY KEY,
  name_zh text NOT NULL,
  name_en text NOT NULL,
  zone_id text NOT NULL,
  hp integer NOT NULL,
  atk integer NOT NULL,
  def integer NOT NULL,
  attack_speed_ms integer NOT NULL,
  body_xp integer NOT NULL,
  drops jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Monsters readable by all" ON public.monsters FOR SELECT USING (true);

INSERT INTO public.monsters (id, name_zh, name_en, zone_id, hp, atk, def, attack_speed_ms, body_xp, drops) VALUES
('drunkard',        '醉漢',  'Drunkard',         'archway',         50, 1, 0, 3000,  5, '[{"item_type":"damaged_book","quantity":1,"rate":0.2}]'::jsonb),
('thug',            '流氓',  'Thug',             'archway',        140, 5, 4, 3000, 10, '[{"item_type":"damaged_book","quantity":1,"rate":0.2}]'::jsonb),
('bandit',          '劫匪',  'Bandit',           'imperial-road',  120, 4, 2, 3000,  8, '[{"item_type":"damaged_book","quantity":1,"rate":0.2}]'::jsonb),
('bandit-leader',   '匪首',  'Bandit Leader',    'imperial-road',  200, 8, 5, 3000, 20, '[{"item_type":"damaged_book","quantity":1,"rate":0.2}]'::jsonb),
('mountain-bandit', '山賊',  'Mountain Bandit',  'mountain-camp',  180, 7, 4, 3000, 15, '[{"item_type":"damaged_book","quantity":1,"rate":0.2}]'::jsonb),
('mountain-king',   '寨主',  'Mountain King',    'mountain-camp',  300,12, 8, 3000, 35, '[{"item_type":"damaged_book","quantity":1,"rate":0.2}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name_zh = EXCLUDED.name_zh, name_en = EXCLUDED.name_en, zone_id = EXCLUDED.zone_id,
  hp = EXCLUDED.hp, atk = EXCLUDED.atk, def = EXCLUDED.def,
  attack_speed_ms = EXCLUDED.attack_speed_ms, body_xp = EXCLUDED.body_xp, drops = EXCLUDED.drops;

-- === Equipment stats catalog ===
CREATE TABLE IF NOT EXISTS public.equipment_items (
  id text PRIMARY KEY,
  hp integer NOT NULL DEFAULT 0,
  mp integer NOT NULL DEFAULT 0,
  atk integer NOT NULL DEFAULT 0,
  def integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipment readable by all" ON public.equipment_items FOR SELECT USING (true);

INSERT INTO public.equipment_items (id, hp, mp, atk, def) VALUES
('copper_sword',     0, 0, 5, 0),
('copper_shield',   10, 0, 0, 5),
('copper_helmet',    5, 0, 0, 3),
('copper_shoulder',  0, 0, 0, 3),
('copper_chest',    20, 0, 0, 5),
('copper_pants',    10, 0, 0, 4),
('copper_gloves',    0, 0, 2, 2),
('copper_boots',     0, 0, 0, 3),
('copper_necklace', 15, 0, 0, 0),
('copper_cape',      0, 0, 0, 4),
('copper_ring',      0, 0, 3, 0),
('copper_accessory',10, 0, 0, 0),
('poor_helmet',     10, 0, 0, 0),
('poor_shoulder',   10, 0, 0, 0),
('poor_chest',      10, 0, 0, 0),
('poor_pants',      10, 0, 0, 0),
('poor_gloves',     10, 0, 0, 0),
('poor_boots',      10, 0, 0, 0),
('poor_sword',       0, 0,10, 0),
('poor_shield',      0, 0, 0,10),
('poor_ring',       10, 0, 0, 0),
('poor_accessory',  10, 0, 0, 0),
('poor_cape',       10, 0, 0, 0),
('poor_necklace',   10, 0, 0, 0)
ON CONFLICT (id) DO UPDATE SET
  hp = EXCLUDED.hp, mp = EXCLUDED.mp, atk = EXCLUDED.atk, def = EXCLUDED.def;

-- === combat_tick RPC ===
-- Event-driven: client calls when next_event_in_ms elapses.
-- Server simulates attacks chronologically from session.last_sync_at to now.
-- Player first-strike on tie (v_next_p_attack <= v_next_m_attack).
-- Drops go to profile.loot_box (cap 100); player_hp/monster_hp tracked in payload.
-- Death (player_hp = 0): session ended_at = now, next_event_in_ms = -1.

CREATE OR REPLACE FUNCTION public.combat_tick(p_slot integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_session record;
  v_payload jsonb;
  v_monster record;
  v_monster_id text;
  v_monster_hp integer;
  v_player_hp integer;
  v_last_p_attack timestamptz;
  v_last_m_attack timestamptz;
  v_kills integer;
  v_now timestamptz := now();
  v_next_p_attack timestamptz;
  v_next_m_attack timestamptz;
  v_event_at timestamptz;
  v_is_player_attack boolean;
  v_total_kills integer := 0;
  v_total_body_xp bigint := 0;
  v_died boolean := false;
  v_profile record;
  v_equip jsonb;
  v_active_set text;
  v_body_level integer;
  v_player_max_hp integer;
  v_player_atk integer;
  v_player_def integer;
  v_equip_hp integer := 0;
  v_equip_atk integer := 0;
  v_equip_def integer := 0;
  v_equip_item record;
  v_eq_key text;
  v_eq_value text;
  v_player_dmg integer;
  v_monster_dmg integer;
  v_drop record;
  v_next_event_ms integer;
  v_attack_speed_interval interval;
  v_player_attack_interval interval := interval '3 seconds';
  v_safety integer := 0;
  v_loot_box jsonb;
  v_kill_slots jsonb;
  v_existing_idx integer;
  v_existing_slot jsonb;
  v_drops_summary jsonb := '[]'::jsonb;
  v_summary_idx integer;
  v_summary_existing jsonb;
  v_loot_full boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;

  SELECT * INTO v_session FROM idle_sessions
  WHERE user_id = v_user_id AND slot = p_slot AND type = 'combat' AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_combatting'); END IF;

  v_payload := COALESCE(v_session.payload, '{}'::jsonb);
  v_monster_id := v_payload->>'monster_id';
  IF v_monster_id IS NULL THEN RETURN jsonb_build_object('error', 'no_monster'); END IF;

  SELECT * INTO v_monster FROM monsters WHERE id = v_monster_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'monster_not_found'); END IF;

  v_attack_speed_interval := make_interval(secs => v_monster.attack_speed_ms / 1000.0);

  SELECT * INTO v_profile FROM profiles WHERE user_id = v_user_id AND slot = p_slot FOR UPDATE;
  v_body_level := COALESCE(v_profile.body_level, 1);
  v_active_set := COALESCE(v_profile.active_equipment_set, 1)::text;
  v_equip := COALESCE(v_profile.equipment_sets, '{}'::jsonb) -> v_active_set;
  v_loot_box := COALESCE(v_profile.loot_box, '[]'::jsonb);

  IF v_equip IS NOT NULL AND jsonb_typeof(v_equip) = 'object' THEN
    FOR v_eq_key, v_eq_value IN SELECT key, value FROM jsonb_each_text(v_equip) LOOP
      IF v_eq_value IS NOT NULL AND v_eq_value != '' AND v_eq_value != 'null' THEN
        SELECT * INTO v_equip_item FROM equipment_items WHERE id = v_eq_value;
        IF FOUND THEN
          v_equip_hp := v_equip_hp + v_equip_item.hp;
          v_equip_atk := v_equip_atk + v_equip_item.atk;
          v_equip_def := v_equip_def + v_equip_item.def;
        END IF;
      END IF;
    END LOOP;
  END IF;

  v_player_max_hp := 100 + GREATEST(0, v_body_level - 1) * 10 + v_equip_hp;
  v_player_atk := 1 + GREATEST(0, v_body_level - 1) * 1 + v_equip_atk;
  v_player_def := 0 + GREATEST(0, v_body_level - 1) * 1 + v_equip_def;

  v_monster_hp := COALESCE((v_payload->>'monster_hp')::integer, v_monster.hp);
  v_player_hp := COALESCE((v_payload->>'player_hp')::integer, v_player_max_hp);
  v_player_hp := LEAST(v_player_hp, v_player_max_hp);
  v_last_p_attack := COALESCE((v_payload->>'last_player_attack_at')::timestamptz, v_session.started_at);
  v_last_m_attack := COALESCE((v_payload->>'last_monster_attack_at')::timestamptz, v_session.started_at);
  v_kills := COALESCE((v_payload->>'kills')::integer, 0);

  v_player_dmg := GREATEST(1, v_player_atk - v_monster.def);
  v_monster_dmg := GREATEST(1, v_monster.atk - v_player_def);

  LOOP
    v_safety := v_safety + 1;
    EXIT WHEN v_safety > 50000;

    v_next_p_attack := v_last_p_attack + v_player_attack_interval;
    v_next_m_attack := v_last_m_attack + v_attack_speed_interval;

    IF v_next_p_attack <= v_next_m_attack THEN
      v_event_at := v_next_p_attack;
      v_is_player_attack := true;
    ELSE
      v_event_at := v_next_m_attack;
      v_is_player_attack := false;
    END IF;

    EXIT WHEN v_event_at > v_now;

    IF v_is_player_attack THEN
      v_monster_hp := v_monster_hp - v_player_dmg;
      v_last_p_attack := v_event_at;

      IF v_monster_hp <= 0 THEN
        v_kill_slots := '[]'::jsonb;
        FOR v_drop IN SELECT * FROM jsonb_to_recordset(v_monster.drops) AS x(item_type text, quantity integer, rate numeric) LOOP
          IF random() < v_drop.rate THEN
            v_existing_idx := -1;
            FOR i IN 0..(jsonb_array_length(v_kill_slots) - 1) LOOP
              IF v_kill_slots->i->>'item_type' = v_drop.item_type THEN
                v_existing_idx := i;
                EXIT;
              END IF;
            END LOOP;
            IF v_existing_idx >= 0 THEN
              v_existing_slot := v_kill_slots->v_existing_idx;
              v_kill_slots := jsonb_set(v_kill_slots, ARRAY[v_existing_idx::text],
                jsonb_set(v_existing_slot, '{quantity}', to_jsonb((v_existing_slot->>'quantity')::integer + v_drop.quantity)));
            ELSE
              v_kill_slots := v_kill_slots || jsonb_build_array(
                jsonb_build_object('item_type', v_drop.item_type, 'quantity', v_drop.quantity)
              );
            END IF;
            v_summary_idx := -1;
            FOR i IN 0..(jsonb_array_length(v_drops_summary) - 1) LOOP
              IF v_drops_summary->i->>'item' = v_drop.item_type THEN
                v_summary_idx := i;
                EXIT;
              END IF;
            END LOOP;
            IF v_summary_idx >= 0 THEN
              v_summary_existing := v_drops_summary->v_summary_idx;
              v_drops_summary := jsonb_set(v_drops_summary, ARRAY[v_summary_idx::text],
                jsonb_set(v_summary_existing, '{qty}', to_jsonb((v_summary_existing->>'qty')::integer + v_drop.quantity)));
            ELSE
              v_drops_summary := v_drops_summary || jsonb_build_array(
                jsonb_build_object('item', v_drop.item_type, 'qty', v_drop.quantity)
              );
            END IF;
          END IF;
        END LOOP;

        IF jsonb_array_length(v_kill_slots) > 0 THEN
          IF jsonb_array_length(v_loot_box) + jsonb_array_length(v_kill_slots) <= 100 THEN
            v_loot_box := v_loot_box || v_kill_slots;
          ELSE
            v_loot_full := true;
            FOR i IN 0..(jsonb_array_length(v_kill_slots) - 1) LOOP
              EXIT WHEN jsonb_array_length(v_loot_box) >= 100;
              v_loot_box := v_loot_box || jsonb_build_array(v_kill_slots->i);
            END LOOP;
          END IF;
        END IF;

        v_total_kills := v_total_kills + 1;
        v_kills := v_kills + 1;
        v_total_body_xp := v_total_body_xp + v_monster.body_xp;
        v_monster_hp := v_monster.hp;
        v_last_m_attack := v_event_at;
      END IF;
    ELSE
      v_player_hp := v_player_hp - v_monster_dmg;
      v_last_m_attack := v_event_at;

      IF v_player_hp <= 0 THEN
        v_player_hp := 0;
        v_died := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF v_total_kills > 0 THEN
    UPDATE profiles SET loot_box = v_loot_box
    WHERE user_id = v_user_id AND slot = p_slot;
  END IF;

  IF v_total_body_xp > 0 THEN
    UPDATE profiles SET body_xp = COALESCE(body_xp, 0) + v_total_body_xp
    WHERE user_id = v_user_id AND slot = p_slot;
  END IF;

  v_payload := jsonb_build_object(
    'monster_id', v_monster_id,
    'monster_hp', v_monster_hp,
    'player_hp', v_player_hp,
    'last_player_attack_at', v_last_p_attack,
    'last_monster_attack_at', v_last_m_attack,
    'kills', v_kills
  );

  IF v_died THEN
    UPDATE idle_sessions SET payload = v_payload, last_sync_at = v_now, ended_at = v_now
    WHERE id = v_session.id;
    v_next_event_ms := -1;
  ELSE
    UPDATE idle_sessions SET payload = v_payload, last_sync_at = v_now
    WHERE id = v_session.id;
    v_next_p_attack := v_last_p_attack + v_player_attack_interval;
    v_next_m_attack := v_last_m_attack + v_attack_speed_interval;
    v_next_event_ms := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (LEAST(v_next_p_attack, v_next_m_attack) - v_now)) * 1000)::integer);
  END IF;

  RETURN jsonb_build_object(
    'player_hp', v_player_hp,
    'player_max_hp', v_player_max_hp,
    'monster_hp', v_monster_hp,
    'monster_max_hp', v_monster.hp,
    'monster_id', v_monster_id,
    'kills', v_kills,
    'kills_delta', v_total_kills,
    'body_xp_delta', v_total_body_xp,
    'drops', v_drops_summary,
    'loot_box', v_loot_box,
    'loot_full', v_loot_full,
    'died', v_died,
    'next_event_in_ms', v_next_event_ms,
    'player_dmg', v_player_dmg,
    'monster_dmg', v_monster_dmg,
    'last_player_attack_at', v_last_p_attack,
    'last_monster_attack_at', v_last_m_attack,
    'tick_at', v_now
  );
END;
$function$;
