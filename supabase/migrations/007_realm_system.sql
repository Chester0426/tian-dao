-- Add realm and realm_level columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realm TEXT NOT NULL DEFAULT '煉體';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realm_level INTEGER NOT NULL DEFAULT 1;

-- Migrate existing data: cultivation_stage 1-9 maps to 煉體 level 1-9
UPDATE profiles SET realm = '煉體', realm_level = cultivation_stage WHERE cultivation_stage <= 9;
UPDATE profiles SET realm = '練氣', realm_level = cultivation_stage - 9 WHERE cultivation_stage >= 10;
