-- Pre-aggregated distribution outbound by date and location (dashboard distribution velocity KPI).

DROP MATERIALIZED VIEW IF EXISTS distribution_outbound_daily;

CREATE MATERIALIZED VIEW distribution_outbound_daily AS
SELECT
  sm.date AS movement_date,
  sc.location_id,
  COALESCE(SUM(sm.quantity_out), 0)::double precision AS total_out,
  NOW() AS refreshed_at
FROM stock_movements sm
INNER JOIN stock_cards sc ON sc.id = sm.stock_card_id
INNER JOIN waybills w ON w.wb_number = sm.document_ref
WHERE sm.source_type = 'waybill'
  AND w.destination_type IN ('beneficiary', 'distribution_point')
GROUP BY sm.date, sc.location_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_distribution_outbound_daily_date_location
  ON distribution_outbound_daily (movement_date, location_id);

CREATE INDEX IF NOT EXISTS idx_distribution_outbound_daily_location_date
  ON distribution_outbound_daily (location_id, movement_date);

CREATE OR REPLACE FUNCTION refresh_distribution_outbound_daily(concurrent_refresh boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF concurrent_refresh THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY distribution_outbound_daily;
  ELSE
    REFRESH MATERIALIZED VIEW distribution_outbound_daily;
  END IF;
END;
$$;

REFRESH MATERIALIZED VIEW distribution_outbound_daily;
