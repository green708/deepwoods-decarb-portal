-- ═══════════════════════════════════════════════════════════════════
-- STEP 1: DIAGNOSE — find Testing-DWG and its current state
-- Run this first and review the output
-- ═══════════════════════════════════════════════════════════════════

-- 1a. Find the Testing-DWG client record
SELECT id, name, slug, is_active, payment_status, created_at
FROM clients
WHERE name LIKE '%Testing%' OR name LIKE '%DWG%' OR slug LIKE '%test%' OR slug LIKE '%dwg%';

-- ═══════════════════════════════════════════════════════════════════
-- STEP 2: Check entities for that client (replace 999 with the id from step 1a)
-- ═══════════════════════════════════════════════════════════════════

SELECT ce.* FROM client_entities ce
JOIN clients c ON ce.client_id = c.id
WHERE c.name LIKE '%Testing%' OR c.slug LIKE '%test%' OR c.slug LIKE '%dwg%';

-- ═══════════════════════════════════════════════════════════════════
-- STEP 3: Check config for that client
-- ═══════════════════════════════════════════════════════════════════

SELECT cc.* FROM client_config cc
JOIN clients c ON cc.client_id = c.id
WHERE c.name LIKE '%Testing%' OR c.slug LIKE '%test%' OR c.slug LIKE '%dwg%'
ORDER BY cc.config_key;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 4: Check access request data (what the user filled in the form)
-- ═══════════════════════════════════════════════════════════════════

SELECT cr.* FROM client_requests cr
JOIN clients c ON cr.client_id = c.id
WHERE c.name LIKE '%Testing%' OR c.slug LIKE '%test%' OR c.slug LIKE '%dwg%';

-- ═══════════════════════════════════════════════════════════════════
-- STEP 5: Also check which user is linked to this client
-- ═══════════════════════════════════════════════════════════════════

SELECT u.id, u.email, u.role, u.client_id, c.name AS client_name, c.slug
FROM users u
JOIN clients c ON u.client_id = c.id
WHERE c.name LIKE '%Testing%' OR c.slug LIKE '%test%' OR c.slug LIKE '%dwg%';
