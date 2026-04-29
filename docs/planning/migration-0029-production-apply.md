# Migration 0029 Production Apply Checklist

## Purpose

Apply migration `0029_users_email_unique.sql` safely in production by validating data first, applying the constraint, and verifying behavior after rollout.

## Scope

- Target table: `users`
- Constraint: `users_email_unique`
- SQL from migration:

```sql
ALTER TABLE users
ADD CONSTRAINT users_email_unique UNIQUE (email);
```

## Step 1: Pre-check for duplicate non-null emails

Expected result: **0 rows**.

```sql
SELECT email, COUNT(*) AS cnt
FROM users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY cnt DESC, email;
```

## Step 2: If duplicates exist, inspect affected rows

Run only if Step 1 returns rows.

```sql
SELECT id, email, role, status, "createdAt", "updatedAt"
FROM users
WHERE email IN (
  SELECT email
  FROM users
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
)
ORDER BY email, id;
```

## Step 3: Resolve duplicates

Before applying the unique constraint:

- Keep one row per duplicated email (business decision).
- Update or delete extra rows.

Do not proceed until Step 1 returns zero rows.

## Step 4: Apply the constraint

```sql
ALTER TABLE users
ADD CONSTRAINT users_email_unique UNIQUE (email);
```

## Step 5: Verify constraint exists

```sql
SELECT conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'users'
  AND conname = 'users_email_unique';
```

Expected result: one row for `users_email_unique`.

## Step 6: Post-apply sanity checks

- Attempt to insert/update a user with an existing email (should fail with unique violation).
- Attempt to insert a user with a new unique email (should succeed).

## Optional rollback

Run only if rollback is required.

```sql
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_email_unique;
```

