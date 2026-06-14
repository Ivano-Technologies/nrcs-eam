CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON "auditLogs" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON "auditLogs" ("action");
