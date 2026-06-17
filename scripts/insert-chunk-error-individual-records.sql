-- Insert individual error records for 471 contacts from chunk errors (IDs 994, 1015)
-- in retry migration 16066d3b so the targetId retry path re-extracts and re-transforms them.
-- Run on: etl_tracking_verification

INSERT INTO migration_errors (migration_id, entity_type, entity_id, error_message, error_code, source_data)
SELECT
  '16066d3b-f034-46b3-a475-3a8527eb90a5',
  'contacts',
  elem->>'agentcisInternalId',
  'Request failed with status code 422',
  'API_ERROR',
  '{}'::jsonb
FROM migration_errors,
  jsonb_array_elements((source_data->>'chunk')::jsonb) as elem
WHERE id IN (994, 1015);
