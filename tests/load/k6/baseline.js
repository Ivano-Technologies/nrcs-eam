/**
 * k6 baseline — run against staging only.
 * Usage: k6 run -e BASE_URL=https://staging.example.com -e AUTH_COOKIE="..." tests/load/k6/baseline.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "15m",
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<3000"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const health = http.get(`${baseUrl}/api/health`);
  check(health, { "health ok": (r) => r.status === 200 });

  const trpcBatch = http.post(
    `${baseUrl}/api/trpc/dashboard.metrics?batch=1`,
    JSON.stringify({ "0": { json: { period: "Week" } } }),
    {
      headers: {
        "content-type": "application/json",
        cookie: __ENV.AUTH_COOKIE || "",
      },
    }
  );
  check(trpcBatch, { "metrics status": (r) => r.status === 200 || r.status === 401 });

  sleep(1 + Math.random() * 2);
}
