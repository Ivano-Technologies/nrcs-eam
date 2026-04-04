# `.manus` directory (Manus tooling)

This folder is created by the **Manus** development environment. It is **not** part of the NRCS EAM application source code and **does not define authentication** for the app.

## What is here

- **`db/`** — Cached outputs from exploratory SQL commands run inside Manus (queries, errors, timing). Those JSON files often embed **full MySQL/TiDB client command lines**, including **host, username, and database name**. Treat them as **secrets** and **never commit** them.

## Where authentication actually lives

Application auth is implemented in the repo under:

- `server/magicLinkAuth.ts` — magic-link signup / verification flow  
- `server/_core/oauth.ts`, `server/_core/magicLinkVerification.ts` — OAuth / magic-link HTTP handling  
- `server/_core/trpc.ts`, `server/_core/context.ts` — tRPC context and procedures  
- `server/db.ts` — user persistence (Drizzle)  
- `client/src/pages/Login.tsx`, `Signup.tsx`, `VerifyMagicLink.tsx` — UI  

## Git

Only this `README.md` is intended to be versioned. The **`db/`** subtree stays in `.gitignore` so query caches are not pushed to GitHub.
