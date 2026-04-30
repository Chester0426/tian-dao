-- Widen switch_activity depleted_at clamp from -1s to -3s.
--
-- Bug: When Next.js start-activity API hits a cold start (~1.5s+ latency),
-- switch_activity's eager-set computes depleted_at = GREATEST(now-1s, p_started_at).
-- The 1s lower bound activates and pushes depleted_at to T0 + (lat_switch - 1s),
-- e.g. T0+0.7s for 1.7s cold start. The 5s respawn clock then finishes 0.7s late
-- on the server, so the T=5 client RAF mine_action sees diff < 4.5s threshold
-- and respawn-complete is delayed to T=8. The first real tick slips to T=11.
--
-- Fix: widen the lower clamp to -3s so cold-starts up to 3s leave depleted_at
-- exactly at p_started_at (= client click time). Cheating cost: max 3s saved
-- per respawn cycle, which scales down with mastery (5% at mastery 14, ~1%
-- at mastery 99 — see analysis 2026-04-29).

CREATE OR REPLACE FUNCTION public.switch_activity(p_user_id uuid, p_slot integer, p_type text, p_started_at timestamp with time zone, p_mine_id uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ELSE 3000
  END;

  v_anchored_last_tick := GREATEST(
    now() - (v_default_tick_ms * interval '1 millisecond'),
    LEAST(p_started_at, now())
  );

  -- depleted_at anchor: 用 client 點擊時間，clamp [now-3s, now]。
  -- -3s 下緣是為了吸收 Next.js cold-start 延遲（典型 0.5~2s），
  -- 避免 depleted_at 被推到 T0 之後，導致 T=5 重生完成檢查 fail、
  -- 第一個 tick 從 T=8 順延到 T=11。
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

  -- Eagerly set depleted_at if entering mining of a HP=0 rock
  -- (Race fix: avoids confirm RPC triggering special case 5s late)
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
$function$;
