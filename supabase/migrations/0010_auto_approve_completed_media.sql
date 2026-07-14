-- Auto-approve agent uploads that completed while approval was still required.
update listing_media
set
  status = 'approved',
  approved_at = coalesce(approved_at, upload_completed_at, now()),
  approved_by = coalesce(approved_by, uploaded_by)
where status = 'pending'
  and upload_completed_at is not null;
