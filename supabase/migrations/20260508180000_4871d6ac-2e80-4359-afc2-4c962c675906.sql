-- Backfill: null out weak/misleading address strings on recent itinerary activities
-- so the UI weak-address gate can hide them on next render.
-- "Weak" mirrors src/lib/address-quality.ts isWeakAddress():
--   - shorter than 8 chars, OR
--   - matches a bare neighborhood / sestiere / district name, OR
--   - contains no digit
-- Limited to last 30 days to bound impact.

WITH targets AS (
  SELECT id, activities
  FROM itinerary_days
  WHERE created_at >= now() - interval '30 days'
    AND activities IS NOT NULL
)
UPDATE itinerary_days d
SET activities = (
  SELECT jsonb_agg(
    CASE
      WHEN (act->'location'->>'address') IS NOT NULL
       AND (
         length(trim(act->'location'->>'address')) < 8
         OR (act->'location'->>'address') !~ '\d'
         OR lower(trim(act->'location'->>'address')) ~ '^(san\s*marco|cannaregio|castello|dorsoduro|santa\s*croce|san\s*polo|giudecca|lido|murano|burano|trastevere|monti|prati|testaccio|esquilino|pigneto|ostiense|chiado|alfama|baixa|bairro\s*alto|graça|graca|le\s*marais|montmartre|saint[\- ]germain|bastille|belleville|pigalle|soho|shoreditch|mayfair|notting\s*hill|covent\s*garden|south\s*kensington|chelsea|camden|kreuzberg|mitte|prenzlauer\s*berg|friedrichshain|charlottenburg|gr[áa]cia|el\s*born|el\s*raval|el\s*g[óo]tic|barceloneta|eixample|sants|shibuya|shinjuku|ginza|asakusa|roppongi|gion|arashiyama|dotonbori|namba|umeda|downtown|old\s*town|old\s*city|city\s*centre|city\s*center|el\s*centro|centro\s*storico|centro\s*hist[óo]rico|altstadt)$'
       )
      THEN jsonb_set(act, '{location,address}', 'null'::jsonb)
      ELSE act
    END
  )
  FROM jsonb_array_elements(t.activities) AS act
)
FROM targets t
WHERE d.id = t.id
  AND jsonb_typeof(d.activities) = 'array';