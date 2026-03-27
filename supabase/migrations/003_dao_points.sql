-- 003_dao_points.sql — Add 天道值 (dao_points) to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dao_points bigint NOT NULL DEFAULT 0;
