import { createTRPCProxyClient, httpBatchLink, httpLink, splitLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers.ts";

const url =
  process.argv[2] ?? "https://vy3xagmuzx.eu-west-1.awsapprunner.com/api/trpc";
const client = createTRPCProxyClient<AppRouter>({
  links: [
    splitLink({
      condition(op) {
        return op.type === "query";
      },
      true: httpLink({ url, transformer: superjson }),
      false: httpBatchLink({ url, transformer: superjson }),
    }),
  ],
});

const caps = await client.system.authProcedureNames.query();
console.log("authProcedureNames", caps);
const me = await client.auth.me.query();
console.log("me", me);
const r = await client.auth.loginWithPassword.mutate({
  email: "ivanonigeria@gmail.com",
  password: "@Localhost001",
});
console.log("login", JSON.stringify(r));
