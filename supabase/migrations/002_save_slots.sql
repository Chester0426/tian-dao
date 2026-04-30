-- 002_save_slots.sql — Add 3-slot save system per account
-- Each account can have up to 3 independent characters (slots 1-3)

-- Step 1: Add slot column to all player tables (default 1 for existing data)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slot smallint NOT NULL DEFAULT 1;
ALTER TABLE mining_skills ADD COLUMN IF NOT EXISTS slot smallint NOT NULL DEFAULT 1;
ALTER TABLE mine_masteries ADD COLUMN IF NOT EXISTS slot smallint NOT NULL DEFAULT 1;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS slot smallint NOT NULL DEFAULT 1;
ALTER TABLE idle_sessions ADD COLUMN IF NOT EXISTS slot smallint NOT NULL DEFAULT 1;

-- Step 2: Add CHECK constraint (slot must be 1, 2, or 3)
ALTER TABLE profiles ADD CONSTRAINT profiles_slot_check CHECK (slot BETWEEN 1 AND 3);
ALTER TABLE mining_skills ADD CONSTRAINT mining_skills_slot_check CHECK (slot BETWEEN 1 AND 3);
ALTER TABLE mine_masteries ADD CONSTRAINT mine_masteries_slot_check CHECK (slot BETWEEN 1 AND 3);
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_slot_check CHECK (slot BETWEEN 1 AND 3);
ALTER TABLE idle_sessions ADD CONSTRAINT idle_sessions_slot_check CHECK (slot BETWEEN 1 AND 3);

-- Step 3: Drop old unique constraints and create new ones with slot
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_slot_key UNIQUE (user_id, slot);

ALTER TABLE mining_skills DROP CONSTRAINT IF EXISTS mining_skills_user_id_key;
ALTER TABLE mining_skills ADD CONSTRAINT mining_skills_user_id_slot_key UNIQUE (user_id, slot);

ALTER TABLE mine_masteries DROP CONSTRAINT IF EXISTS mine_masteries_user_id_mine_id_key;
ALTER TABLE mine_masteries ADD CONSTRAINT mine_masteries_user_id_slot_mine_id_key UNIQUE (user_id, slot, mine_id);

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_user_id_item_type_key;
ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_user_id_slot_item_type_key UNIQUE (user_id, slot, item_type);

ALTER TABLE idle_sessions DROP CONSTRAINT IF EXISTS idle_sessions_user_id_type_key;
ALTER TABLE idle_sessions ADD CONSTRAINT idle_sessions_user_id_slot_type_key UNIQUE (user_id, slot, type);

-- Step 4: Add delete policy for profiles (needed for character deletion)
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Add delete policies for related tables (cascade manual delete)
DROP POLICY IF EXISTS "Users can delete own mining skill" ON mining_skills;
CREATE POLICY "Users can delete own mining skill" ON mining_skills
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own masteries" ON mine_masteries;
CREATE POLICY "Users can delete own masteries" ON mine_masteries
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON idle_sessions;
CREATE POLICY "Users can delete own sessions" ON idle_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Update RPC functions to include slot parameter

-- increment_item_quantity now requires slot
CREATE OR REPLACE FUNCTION increment_item_quantity(
  p_item_type text,
  p_quantity integer,
  p_slot smallint DEFAULT 1
) RETURNS void AS $$
BEGIN
  UPDATE inventory_items
  SET quantity = quantity + p_quantity
  WHERE user_id = auth.uid() AND slot = p_slot AND item_type = p_item_type;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- buy_inventory_slot now requires slot
CREATE OR REPLACE FUNCTION buy_inventory_slot(p_price integer, p_slot smallint DEFAULT 1)
RETURNS jsonb AS $$
DECLARE
  v_quantity integer;
  v_new_quantity integer;
  v_current_slots integer;
  v_new_slots integer;
BEGIN
  SELECT quantity INTO v_quantity
  FROM inventory_items
  WHERE user_id = auth.uid() AND slot = p_slot AND item_type = 'spirit_stone_fragment'
  FOR UPDATE;

  IF v_quantity IS NULL OR v_quantity < p_price THEN
    RETURN jsonb_build_object('error', 'insufficient_balance', 'available', COALESCE(v_quantity, 0));
  END IF;

  v_new_quantity := v_quantity - p_price;

  IF v_new_quantity <= 0 THEN
    DELETE FROM inventory_items WHERE user_id = auth.uid() AND slot = p_slot AND item_type = 'spirit_stone_fragment';
    v_new_quantity := 0;
  ELSE
    UPDATE inventory_items SET quantity = v_new_quantity
    WHERE user_id = auth.uid() AND slot = p_slot AND item_type = 'spirit_stone_fragment';
  END IF;

  SELECT inventory_slots INTO v_current_slots
  FROM profiles WHERE user_id = auth.uid() AND slot = p_slot FOR UPDATE;

  v_new_slots := v_current_slots + 1;
  UPDATE profiles SET inventory_slots = v_new_slots WHERE user_id = auth.uid() AND slot = p_slot;

  RETURN jsonb_build_object('new_slots', v_new_slots, 'spent', p_price, 'spirit_stone_remaining', v_new_quantity);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
