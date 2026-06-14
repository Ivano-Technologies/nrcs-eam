-- Reference checks for migration 0050 (run in Supabase SQL editor or psql)

-- 1. Materialized view exists
SELECT schemaname, matviewname, ispopulated
FROM pg_matviews
WHERE matviewname = 'stock_card_balances';

-- 2. Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'stock_card_balances'
ORDER BY indexname;

-- 3. Refresh helper
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'refresh_stock_card_balances';

-- 4. Sample balance row count
SELECT count(*) AS balance_rows FROM stock_card_balances;

-- 5. Concurrent refresh (after stock_movements bulk loads)
-- SELECT refresh_stock_card_balances(true);
