PRAGMA foreign_keys = ON;

-- Engineer Partners receive 70% of remote-support revenue.
UPDATE pricing_rules
SET provider_base_pence = 1750,
    provider_increment_pence = 1400,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'technology-remote-standard';

PRAGMA foreign_key_check;
