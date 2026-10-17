/**
 * Insurance register ?status= deep link (Chief smoke #147 item 5): the filter must apply on a direct load
 * of the dashboard "Insurance expiring" link and follow in-app navigation. wouter's useLocation() has no
 * query string, so the page reads useSearch().
 */
import { act, cleanup, render } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_NAV } from "@shared/dashboardNav";

const listInputs: Array<{ status?: string }> = [];

vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    trpc: {
      useUtils: () => ({ insuranceRecords: { list: { invalidate: vi.fn() } } }),
      insuranceRecords: {
        list: {
          useQuery: (input: { status?: string }) => {
            listInputs.push(input);
            return { data: [] };
          },
        },
        create: { useMutation: mutation },
        delete: { useMutation: mutation },
        exportExcel: { useMutation: mutation },
      },
      sites: { list: { useQuery: () => ({ data: [] }) } },
    },
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));

import { InsuranceRegisterContent, parseInsuranceStatus } from "../InsuranceRegister";

function renderAt(path: string) {
  const loc = memoryLocation({ path, record: true });
  render(
    <Router hook={loc.hook} searchHook={loc.searchHook}>
      <InsuranceRegisterContent embedded />
    </Router>,
  );
  return loc;
}

const lastStatus = () => listInputs[listInputs.length - 1]?.status;

describe("Insurance register ?status= deep link", () => {
  beforeEach(() => {
    listInputs.length = 0;
  });
  afterEach(cleanup);

  it("parses status from a useSearch() value, with or without the leading ?", () => {
    expect(parseInsuranceStatus("tab=insurance&status=expiring")).toBe("expiring");
    expect(parseInsuranceStatus("?status=expired")).toBe("expired");
    expect(parseInsuranceStatus("status=active")).toBe("active");
    expect(parseInsuranceStatus("status=bogus")).toBeUndefined();
    expect(parseInsuranceStatus("")).toBeUndefined();
  });

  it("filters on a direct load of the dashboard 'Insurance expiring' link", () => {
    renderAt(DASHBOARD_NAV.insuranceExpiring.replace(/^\/app/, ""));
    expect(lastStatus()).toBe("expiring");
  });

  it("follows in-app navigation between statuses and back to unfiltered", () => {
    const loc = renderAt("/administration/compliance-register?tab=insurance");
    expect(lastStatus()).toBeUndefined();

    act(() => loc.navigate("/administration/compliance-register?tab=insurance&status=expiring"));
    expect(lastStatus()).toBe("expiring");

    act(() => loc.navigate("/administration/compliance-register?tab=insurance&status=expired"));
    expect(lastStatus()).toBe("expired");

    act(() => loc.navigate("/administration/compliance-register?tab=insurance"));
    expect(lastStatus()).toBeUndefined();
  });
});
