# Supabase Storage — Facility Photos

This document describes the **facility-photos** Supabase Storage bucket used by NRCS EAM for facility photo uploads.

## Bucket

| Setting | Value |
|---------|-------|
| Bucket name | `facility-photos` |
| Upload path pattern | `facilities/{siteId}/{timestamp}-{filename}` |

Example key: `facilities/42/1718380800000-front-entrance.jpg`

## Application flow

Facility photos use **signed upload URLs** generated server-side with the Supabase **service role** (`getSupabaseSecret()` in `server/routers.ts` → `facilityPhotos.uploadUrl`).

1. Client calls `facilityPhotos.uploadUrl` with `siteId`, `fileName`, and `fileType`.
2. Server creates a signed PUT URL and returns `uploadUrl`, `photoKey`, and `publicUrl`.
3. Client uploads the file directly: `PUT` to `uploadUrl` with `Content-Type` matching the file.
4. Client registers the photo: `facilityPhotos.upload` with `siteId`, `photoUrl`, `photoKey`, and optional `caption`.

On delete (`facilityPhotos.delete`), the database row is removed first; the backend then attempts to remove the object from storage via the service role. Storage delete failures are logged with `console.warn` and do not fail the mutation.

## Limits and validation

| Rule | Value |
|------|-------|
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Max photos per facility | 10 |
| Max file size (client) | 5 MB |
| Who can upload/delete | Manager or Admin (`managerOrAdminProcedure`) |

## Required RLS policies (target state)

Configure these in the Supabase dashboard under **Storage → facility-photos → Policies**. The app relies on signed URLs for uploads and service-role deletes from the backend; policies should align with that model.

### INSERT

- **Who:** Authenticated users (managers/admins upload via signed URL issued by the backend).
- **Purpose:** Allow PUT to object paths under `facilities/` when using a valid signed upload URL.

Suggested policy (adjust to your auth setup):

```sql
-- Example: allow authenticated uploads to facility-photos bucket
CREATE POLICY "Authenticated users can upload facility photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'facility-photos');
```

> Signed upload URLs from the service role may bypass RLS depending on Supabase configuration; verify in the dashboard that uploads succeed for manager/admin users.

### SELECT

- **Who:** Public read **or** authenticated read.
- **Purpose:** `getPublicUrl()` is used when registering photos; gallery displays public URLs.

If the bucket is **public**, SELECT can be open for `facility-photos`. If the bucket is **private**, use signed read URLs or restrict SELECT to authenticated users and update the app accordingly.

```sql
-- Public read (if bucket is public)
CREATE POLICY "Public read facility photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'facility-photos');
```

### DELETE

- **Who:** Service role / backend only (not direct client deletes).
- **Purpose:** `facilityPhotos.delete` removes objects using `getSupabaseSecret()` after the DB row is deleted.

Do **not** expose broad DELETE to client roles. Backend uses the service role key, which has full storage access.

```sql
-- Restrict DELETE to service role (no anon/authenticated DELETE policies)
-- Deletions are performed only from server/routers.ts via service role.
```

## Manual verification checklist

After deploying or changing storage settings, verify in the [Supabase dashboard](https://supabase.com/dashboard):

1. **Storage → facility-photos** — bucket exists and public/private setting matches how `getPublicUrl` is used.
2. **Storage → facility-photos → Policies** — INSERT/SELECT policies match the table above; no permissive DELETE for `anon` or `authenticated`.
3. Upload a test photo as manager/admin on a facility detail page.
4. Confirm the object appears at `facilities/{siteId}/...` in the bucket browser.
5. Delete the photo and confirm the DB row and storage object are both removed (check bucket browser if delete logging is enabled).

## Related code

| Area | Location |
|------|----------|
| Upload URL + delete cleanup | `server/routers.ts` → `facilityPhotos` |
| Supabase client (service role) | `server/_core/supabase.ts` → `getSupabaseSecret()` |
| DB schema | `drizzle/schema.ts` → `facilityPhotos` |
| UI | `client/src/pages/FacilityDetail.tsx`, `client/src/components/PhotoUploadZone.tsx` |
