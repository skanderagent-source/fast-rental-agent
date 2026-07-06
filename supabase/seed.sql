-- Optional seed reference. Production data comes from migrations 0004 + create-initial-admin script.
-- Do not store passwords here.

INSERT INTO app_settings (key, value)
VALUES
  ('media_max_images', '10'),
  ('media_max_videos', '3'),
  ('lead_retention_days', '30')
ON CONFLICT (key) DO NOTHING;
