# Deploy static frontend (dist/public) to S3 + invalidate CloudFront.
# Prerequisites: AWS CLI configured (aws configure), permissions for s3:PutObject and cloudfront:CreateInvalidation.
#
# CloudFront SPA tip: add custom error responses 403/404 -> /index.html so client routes work.
# Backend CORS: allow your CloudFront origin on the API (App Runner) when using a separate domain.
#
# Replace placeholders below before running:
$BucketName = "REPLACE_BUCKET_NAME"
$DistributionId = "REPLACE_DISTRIBUTION_ID"

$ErrorActionPreference = "Stop"

# Ensure script runs from repo root (safe when invoked from any cwd)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Resolve-Path "$ScriptDir/..")

Write-Host "[deploy-frontend] Building Vite app..."
pnpm exec vite build

Write-Host "[deploy-frontend] Syncing assets (long cache) to s3://$BucketName ..."
aws s3 sync dist/public "s3://$BucketName" `
  --delete `
  --cache-control "public, max-age=31536000, immutable" `
  --exclude "index.html"

Write-Host "[deploy-frontend] Uploading index.html (no-cache)..."
aws s3 cp dist/public/index.html "s3://$BucketName/index.html" `
  --cache-control "no-cache"

Write-Host "[deploy-frontend] Invalidating CloudFront distribution $DistributionId ..."
aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"

Write-Host "[deploy-frontend] Done."
