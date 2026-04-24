---
name: postgres-schema
description: Design PostgreSQL schemas with migrations, indexes, and Go compatibility
compatibility: opencode
metadata:
  audience: backend-developers
  stack: postgres
---

## What I do

Help design PostgreSQL database schemas, write migrations, and create optimized queries that work well with Go backends.

## When to use me

Use this skill when designing new tables, writing migrations, optimizing queries, or setting up database structures for the Go backend.

## Table Design Template

```sql
-- migrations/000001_create_users_table.up.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_role CHECK (role IN ('user', 'admin', 'moderator'))
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Migration Template

```sql
-- migrations/000001_create_users_table.down.sql
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TABLE IF EXISTS users;
```

## Query Patterns

### Select with Pagination
```sql
SELECT id, email, name, created_at
FROM users
WHERE deleted_at IS NULL
  AND ($1::varchar IS NULL OR email ILIKE '%' || $1 || '%')
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

### Insert with Return
```sql
INSERT INTO users (email, name, role)
VALUES ($1, $2, $3)
RETURNING id, email, name, role, created_at, updated_at;
```

### Soft Delete
```sql
UPDATE users
SET deleted_at = NOW()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;
```

## Key Patterns

- **UUID v7**: Use time-sortable UUIDs for primary keys
- **Soft deletes**: Use `deleted_at` column instead of hard deletes
- **Timestamps**: Use `TIMESTAMPTZ` with `DEFAULT NOW()`
- **Constraints**: Use CHECK constraints for enum-like fields
- **Indexes**: Index foreign keys, frequently queried columns, and partial indexes for soft deletes
- **Migrations**: Always provide `.up.sql` and `.down.sql`

## Go/sqlc Compatibility

When designing for sqlc:
- Use named parameters or numbered parameters consistently
- Use RETURNING for inserts/updates when you need the result
- Avoid dynamic SQL in queries that need type generation
- Use explicit column lists instead of SELECT *

## Performance Tips

- Create indexes concurrently in production: `CREATE INDEX CONCURRENTLY`
- Use partial indexes for filtered queries: `WHERE deleted_at IS NULL`
- Use covering indexes with INCLUDE for frequently accessed columns
- Add BRIN indexes for large time-series tables
- Partition tables over 10M rows by date ranges
