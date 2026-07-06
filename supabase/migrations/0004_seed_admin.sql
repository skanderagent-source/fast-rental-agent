insert into app_settings (key, value) values
('media_limits', '{"maxImagesPerListing":20,"maxVideosPerListing":5,"maxImageSizeMb":15,"maxVideoSizeMb":250}'::jsonb),
('lead_retention', '{"deleteArchivedAfterDays":30}'::jsonb),
('google_sheets', '{"sheets":[{"name":"Fast Rental","spreadsheetId":"1FbQ7VTOE0muIUSfIh3fdBq7Hdle9MgxhmAUrB_Dy4jk"},{"name":"Orcha","spreadsheetId":"1hnNYOxxiObjBfaNRRlUH6j8AolUaBbmaaRLzt6d2UdA","gid":"1483806723"}]}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
