# Database utility scripts

Maintenance scripts for local or controlled environments. **Run from the repository root** (or any directory—the scripts resolve `.env` from the repo root).

| Script | Purpose |
|--------|---------|
| `reset-db.mjs` | Truncate application tables (keeps users); MySQL via `DATABASE_URL` |
| `seed-db.mjs` | Seed minimal sites and asset categories |
| `seed-sample-data.mjs` | Larger sample dataset |
| `cleanup-database.mjs` | Legacy SQLite cleanup (`.data/sqlite.db` under repo root) |
| `clear-data.sql` | Reference SQL for manual clears |

Prerequisites: `DATABASE_URL` in `.env` (MySQL scripts). Use with care in production.
