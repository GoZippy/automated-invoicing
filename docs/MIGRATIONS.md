### Database Migrations

Options
- Simple: Apply SQL files manually with psql (current approach)
- Tooling: Use `golang-migrate`, `Sqitch`, or `Flyway` for versioned migrations

Recommended Flow (simple)
- Keep DDL in `docs/DB_SCHEMA.sql`
- Apply with `make init-db`
- Version updates by adding delta files under `docs/migrations/*.sql` and a changelog `docs/migrations/CHANGELOG.md`
- Apply deltas in order using `scripts/init_db.sh` or a dedicated script

Notes
- Always backup before schema changes
- Use `NUMERIC(12,2)` for currency fields
- Add constraints to enforce consistency (see `chk_amount_consistency`)