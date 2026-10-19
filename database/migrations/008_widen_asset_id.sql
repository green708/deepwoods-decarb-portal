-- 008_widen_asset_id.sql
-- Asset IDs are built as inv-{scope}-c{client}-{facility}-{asset name} and overflowed
-- VARCHAR(50), causing "Data too long for column 'asset_id'" (HTTP 500) on boundary save.
-- 100 matches tracker_drafts.asset_id and ndc_threads.source_id. Existing IDs are unchanged.
ALTER TABLE decarb_assets MODIFY asset_id VARCHAR(100) NOT NULL;
ALTER TABLE s1_equipment  MODIFY asset_id VARCHAR(100) NOT NULL;
ALTER TABLE tracker_drafts MODIFY asset_id VARCHAR(100) NOT NULL;
