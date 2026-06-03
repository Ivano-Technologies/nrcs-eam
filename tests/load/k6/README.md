# k6 load tests (NRCS EAM)

Run only against **staging** with approval. Do not point at production without an explicit ops window.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed locally
- Valid session cookie for a test user (`AUTH_COOKIE`)
- `BASE_URL` pointing at the API host (e.g. Vercel deployment URL)

## Baseline (50 VUs, 15 min)

```bash
k6 run -e BASE_URL=https://your-staging.vercel.app -e AUTH_COOKIE="sb-..." tests/load/k6/baseline.js
```

## Peak (up to 300 VUs)

```bash
k6 run -e BASE_URL=https://your-staging.vercel.app -e AUTH_COOKIE="sb-..." tests/load/k6/peak.js
```

## Targets (from performance audit)

| Metric | Target |
|--------|--------|
| Read p95 | &lt; 2s |
| `dashboard.metrics` p95 | &lt; 3s |
| Error rate at 100 VUs | &lt; 0.1% |

Record results in your runbook or `docs/PERFORMANCE-INFRASTRUCTURE-AUDIT.md` appendix.
