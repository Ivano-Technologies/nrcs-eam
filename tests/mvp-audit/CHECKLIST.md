# MVP audit checklist (NRCS EAM)

> Full matrix: auth, every `/app/*` route, tRPC modules, PDF, email, errors.  
> **Automated** coverage is expanded incrementally; run `pnpm test:e2e` locally.

## Auth / Public

- [ ] Landing `/`
- [ ] `/login` magic link
- [ ] `/signup` request access
- [ ] `/auth/verify` session cookie
- [ ] `/legal/terms` `/legal/privacy`
- [ ] `/404` NotFound

## App shell (sidebar)

- [ ] `/app` dashboard
- [ ] `/app/welcome` onboarding
- [ ] Every sidebar link destination once

## Modules (routes)

See `ProtectedAppSection.tsx` for full list.

## API (tRPC)

See `server/routers.ts` exports.

## PDF

- [ ] Reports page PDF paths

## Email

- [ ] Mailpit SMTP + web UI

## Errors

- [ ] Forms validation
