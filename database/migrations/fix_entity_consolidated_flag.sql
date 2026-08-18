-- Fix any non-Featherlite entities that were incorrectly saved with is_consolidated = 1
-- This covers the case where INSERT IGNORE silently skipped an entity insert because
-- a previous attempt had already saved it with is_consolidated = 1.
-- Safe to re-run (only touches non-Featherlite clients, never touches FL/FP/FOS rows).

UPDATE client_entities ce
JOIN clients c ON ce.client_id = c.id
SET ce.is_consolidated = 0
WHERE c.slug <> 'featherlite'
  AND ce.is_consolidated = 1;

-- Verify: show all entities with their is_consolidated values
SELECT c.name AS client, c.slug, ce.code, ce.name AS entity_name, ce.is_consolidated
FROM client_entities ce
JOIN clients c ON ce.client_id = c.id
ORDER BY c.id, ce.sort_order;
