/**
 * Dashboard deep links into the Compliance register (Chief smoke #147 item 5). Each link must open the
 * right tab AND apply its ?status= filter, on a direct load and on in-app navigation. wouter's
 * useLocation() has no query string, so both tab and status come from useSearch().
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_NAV } from "@shared/dashboardNav";

type Call = { path: string; input: unknown; enabled: boolean };
const calls: Call[] = [];

vi.mock("@/lib/trpc", () => {
  // Any trpc.a.b.c.useQuery / useMutation / useUtils works; useQuery calls are recorded by path.
  const make = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      get(_t, key: string) {
        if (key === "useQuery")
          return (input: unknown, opts?: { enabled?: boolean }) => {
            calls.push({ path: path.join("."), input, enabled: opts?.enabled ?? true });
            return { data: [], isLoading: false };
          };
        if (key === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
        if (key === "useUtils") return () => make(["utils"]);
        if (key === "invalidate") return vi.fn();
        if (key === "then") return undefined;
        return make([...path, key]);
      },
    });
  return { trpc: make([]) };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin", siteId: 1 } }) }));

import ComplianceRegister from "../ComplianceRegister";

const strip = (p: string) => p.replace(/^\/app/, "");

function renderAt(path: string) {
  const loc = memoryLocation({ path, record: true });
  render(
    <Router hook={loc.hook} searchHook={loc.searchHook}>
      <ComplianceRegister />
    </Router>,
  );
  return loc;
}

/** Latest input for an enabled list query. */
function lastInput(path: string) {
  const hits = calls.filter((c) => c.path === path && c.enabled);
  expect(hits.length, `${path} should be queried`).toBeGreaterThan(0);
  return hits[hits.length - 1].input;
}

const selectedTab = () => screen.getByRole("tab", { selected: true }).textContent;

describe("Compliance register dashboard deep links", () => {
  beforeEach(() => {
    calls.length = 0;
  });
  afterEach(cleanup);

  it("Insurance expiring opens the Insurance tab and filters to expiring", () => {
    renderAt(strip(DASHBOARD_NAV.insuranceExpiring));
    expect(selectedTab()).toBe("Insurance register");
    expect(lastInput("insuranceRecords.list")).toEqual({ status: "expiring" });
  });

  it("Vehicles expiring opens the Vehicles tab and filters to expiring", () => {
    renderAt(strip(DASHBOARD_NAV.vehiclesExpiring));
    expect(selectedTab()).toBe("Vehicles");
    expect(lastInput("complianceTracking.vehicles.list")).toEqual({ status: "expiring" });
  });

  it("Generators overdue opens the Generators tab and filters to overdue", () => {
    renderAt(strip(DASHBOARD_NAV.generatorsOverdue));
    expect(selectedTab()).toBe("Generators");
    expect(lastInput("complianceTracking.generators.list")).toEqual({ status: "overdue" });
  });

  it("Donor reports due soon opens the Donor reporting tab and filters to due soon", () => {
    renderAt(strip(DASHBOARD_NAV.donorReportsDueSoon));
    expect(selectedTab()).toBe("Donor reporting");
    expect(lastInput("complianceTracking.donor.list")).toEqual({ status: "due_soon" });
  });

  it("follows in-app navigation between links without a reload", () => {
    const loc = renderAt("/administration/compliance-register");
    expect(selectedTab()).toBe("Vehicles");
    expect(lastInput("complianceTracking.vehicles.list")).toBeUndefined();

    act(() => loc.navigate(strip(DASHBOARD_NAV.insuranceExpiring)));
    expect(selectedTab()).toBe("Insurance register");
    expect(lastInput("insuranceRecords.list")).toEqual({ status: "expiring" });

    act(() => loc.navigate(strip(DASHBOARD_NAV.generatorsOverdue)));
    expect(selectedTab()).toBe("Generators");
    expect(lastInput("complianceTracking.generators.list")).toEqual({ status: "overdue" });

    act(() => loc.navigate(strip(DASHBOARD_NAV.vehiclesExpiring)));
    expect(selectedTab()).toBe("Vehicles");
    expect(lastInput("complianceTracking.vehicles.list")).toEqual({ status: "expiring" });
  });
});
