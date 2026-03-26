-- 001_initial.sql — Initial schema for 仙途放置 (Xian Idle)
-- Tables: profiles, mining_skills, mine_masteries, inventory_items, mines, idle_sessions

-- profiles — player cultivation state and inventory capacity
CREATE TABLE IF NOT EXISTS profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  cultivation_stage integer NOT NULL DEFAULT 1,
  body_xp integer NOT NULL DEFAULT 0,
  body_skill_level integer NOT NULL DEFAULT 1,
  body_skill_xp integer NOT NULL DEFAULT 0,
  inventory_slots integer NOT NULL DEFAULT 20,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- mining_skills — mining skill level and XP per player
CREATE TABLE IF NOT EXISTS mining_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE mining_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own mining skill" ON mining_skills;
CREATE POLICY "Users can read own mining skill" ON mining_skills
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own mining skill" ON mining_skills;
CREATE POLICY "Users can insert own mining skill" ON mining_skills
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own mining skill" ON mining_skills;
CREATE POLICY "Users can update own mining skill" ON mining_skills
  FOR UPDATE USING (auth.uid() = user_id);

-- mine_masteries — mastery level and XP per player per mine
CREATE TABLE IF NOT EXISTS mine_masteries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  mine_id uuid NOT NULL,
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, mine_id)
);
ALTER TABLE mine_masteries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own masteries" ON mine_masteries;
CREATE POLICY "Users can read own masteries" ON mine_masteries
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own masteries" ON mine_masteries;
CREATE POLICY "Users can insert own masteries" ON mine_masteries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own masteries" ON mine_masteries;
CREATE POLICY "Users can update own masteries" ON mine_masteries
  FOR UPDATE USING (auth.uid() = user_id);

-- inventory_items — player inventory, one row per item type per player
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  item_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_type)
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own inventory" ON inventory_items;
CREATE POLICY "Users can read own inventory" ON inventory_items
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own inventory" ON inventory_items;
CREATE POLICY "Users can insert own inventory" ON inventory_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own inventory" ON inventory_items;
CREATE POLICY "Users can update own inventory" ON inventory_items
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own inventory" ON inventory_items;
CREATE POLICY "Users can delete own inventory" ON inventory_items
  FOR DELETE USING (auth.uid() = user_id);

-- mines — mine definitions (loot tables as JSONB, rock HP, respawn)
CREATE TABLE IF NOT EXISTS mines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  required_level integer NOT NULL DEFAULT 1,
  loot_table jsonb NOT NULL DEFAULT '[]'::jsonb,
  rock_base_hp integer NOT NULL DEFAULT 1,
  respawn_seconds integer NOT NULL DEFAULT 5,
  xp_mining integer NOT NULL DEFAULT 5,
  xp_mastery integer NOT NULL DEFAULT 3,
  xp_body integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now()
);
-- Mines are read-only reference data; all authenticated users can read
ALTER TABLE mines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated users can read mines" ON mines;
CREATE POLICY "All authenticated users can read mines" ON mines
  FOR SELECT USING (auth.role() = 'authenticated');

-- idle_sessions — tracks active/completed idle activity
CREATE TABLE IF NOT EXISTS idle_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  type text NOT NULL DEFAULT 'mining',
  mine_id uuid REFERENCES mines(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, type)
);
ALTER TABLE idle_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own sessions" ON idle_sessions;
CREATE POLICY "Users can read own sessions" ON idle_sessions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own sessions" ON idle_sessions;
CREATE POLICY "Users can insert own sessions" ON idle_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own sessions" ON idle_sessions;
CREATE POLICY "Users can update own sessions" ON idle_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Helper RPC: increment item quantity atomically
CREATE OR REPLACE FUNCTION increment_item_quantity(
  p_user_id uuid,
  p_item_type text,
  p_quantity integer
) RETURNS void AS $$
BEGIN
  UPDATE inventory_items
  SET quantity = quantity + p_quantity
  WHERE user_id = p_user_id AND item_type = p_item_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed data: 枯竭礦脈 (Depleted Vein) — the first mine
INSERT INTO mines (name, slug, required_level, loot_table, rock_base_hp, respawn_seconds, xp_mining, xp_mastery, xp_body)
VALUES (
  '枯竭礦脈',
  'depleted_vein',
  1,
  '[{"item_type":"coal","probability":0.5},{"item_type":"copper_ore","probability":0.35},{"item_type":"spirit_stone_fragment","probability":0.15}]'::jsonb,
  1,
  5,
  5,
  3,
  5
) ON CONFLICT (slug) DO NOTHING;
