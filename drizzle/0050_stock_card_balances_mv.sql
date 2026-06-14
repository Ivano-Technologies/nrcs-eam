-- Pre-aggregated net stock balances per stock card (avoids repeated GROUP BY on stock_movements).

DROP MATERIALIZED VIEW IF EXISTS stock_card_balances;

CREATE MATERIALIZED VIEW stock_card_balances AS
SELECT
  sm.stock_card_id,
  sc.location_id,
  COALESCE(SUM(sm.quantity_in - sm.quantity_out), 0)::double precision AS net_quantity,
  MAX(sm.date) AS last_movement_date,
  NOW() AS refreshed_at
FROM stock_movements sm
INNER JOIN stock_cards sc ON sc.id = sm.stock_card_id
GROUP BY sm.stock_card_id, sc.location_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_card_balances_stock_card_id
  ON stock_card_balances (stock_card_id);

CREATE INDEX IF NOT EXISTS idx_stock_card_balances_location_id
  ON stock_card_balances (location_id);

-- Call after bulk stock_movements writes: SELECT refresh_stock_card_balances(true);
CREATE OR REPLACE FUNCTION refresh_stock_card_balances(concurrent_refresh boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF concurrent_refresh THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY stock_card_balances;
  ELSE
    REFRESH MATERIALIZED VIEW stock_card_balances;
  END IF;
END;
$$;

-- Initial populate (non-concurrent on empty MV)
REFRESH MATERIALIZED VIEW stock_card_balances;
