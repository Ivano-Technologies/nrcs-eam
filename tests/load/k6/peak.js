/**
 * k6 peak load — staging only. Targets waybills.list + dashboard.metrics.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "5m", target: 200 },
    { duration: "5m", target: 300 },
    { duration: "4m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<5000"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const headers = {
    "content-type": "application/json",
    cookie: __ENV.AUTH_COOKIE || "",
  };

  const metrics = http.post(
    `${baseUrl}/api/trpc/dashboard.metrics?batch=1`,
    JSON.stringify({ "0": { json: { period: "Month" } } }),
    { headers }
  );
  check(metrics, { metrics: (r) => r.status < 500 });

  const waybills = http.post(
    `${baseUrl}/api/trpc/inventoryV2.waybills.list?batch=1`,
    JSON.stringify({ "0": { json: { limit: 100 } } }),
    { headers }
  );
  check(waybills, { waybills: (r) => r.status < 500 });

  sleep(1 + Math.random() * 2);
}
