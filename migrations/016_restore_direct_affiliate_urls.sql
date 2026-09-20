-- Publications must expose the real marketplace affiliate URL.
-- Older publications may contain the application's /r/:id redirect URL.
-- Restore the original affiliate URL from the tracked_links record.
UPDATE publications p
SET affiliate_url = tl.affiliate_url
FROM tracked_links tl
WHERE p.affiliate_url ~ '/r/[0-9a-fA-F-]{36}$'
  AND tl.id::text = regexp_replace(p.affiliate_url, '^.*/r/([0-9a-fA-F-]{36})$', '\\1');

-- Clear application-level tracking SubIds from publications.
UPDATE publications
SET tracking_subids = '[]'::jsonb
WHERE tracking_subids IS NOT NULL;