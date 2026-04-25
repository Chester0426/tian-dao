-- Add furnace_heat column to profiles for persistent smithing heat
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS furnace_heat integer NOT NULL DEFAULT 0;
