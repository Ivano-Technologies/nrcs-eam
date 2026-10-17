/**
 * ?status= deep links on Receipts, Stock counts, Requisitions and Facilities (Chief's #147 recheck):
 * a valid value filters, a missing or unknown value resets to All (also on in-app navigation), and
 * Requisitions only takes its own filter values.
 */
import { act, cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { path: string; input: unknown };
const calls: Call[] = [];

vi.mock("@/lib/trpc", () => {
  const make = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      get(_t, key: string) {
        if (key === "useQuery")
          return (input: unknown) => {
            calls.push({ path: path.join("."), input });
            return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
          };
        if (key === "useInfiniteQuery")
          return (input: unknown) => {
            calls.push({ path: path.join("."), input });
            return { data: { pages: [] }, isLoading: false, isError: false, refetch: vi.fn(), fetchNextPage: vi.fn() };
          };
        if (key === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
        if (key === "useUtils") return () => make(["utils"]);
        if (key === "then") return undefined;
        return make([...path, key]);
      },
    });
  return { trpc: make([]) };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin", siteId: 1 }, loading: false }) }));

import Receipts from "../Receipts";
import StockCounts from "../StockCounts";
import Requisitions from "../Requisitions";

function lastStatus(path: string): unknown {
  const hits = calls.filter((c) => c.path === path);
  expect(hits.length, `${path} should be queried`).toBeGreaterThan(0);
  return (hits[hits.length - 1].input as { status?: unknown } | undefined)?.status;
}

function renderAt(Page: ComponentType, path: string) {
  const loc = memoryLocation({ path, record: true });
  render(
    <Router hook={loc.hook} searchHook={loc.searchHook}>
      <Page />
    </Router>,
  );
  return loc;
}

const PAGES = [
  { name: "Receipts", Page: Receipts, path: "/app/inventory/receipts", query: "inventoryV2.receipts.list", value: "draft" },
  { name: "Stock counts", Page: StockCounts, path: "/app/inventory/counts", query: "inventoryV2.counts.list", value: "in_progress" },
  { name: "Requisitions", Page: Requisitions, path: "/app/inventory/requisitions", query: "inventoryV2.requisitions.list", value: "submitted" },
] as const;

describe("?status= deep links", () => {
  beforeEach(() => {
    calls.length = 0;
    window.matchMedia = ((q: string) => ({
      matches: q.includes("min-width"),
      media: q,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  for (const { name, Page, path, query, value } of PAGES) {
    it(`${name}: filters from ?status=, then resets to All when the URL has no status`, () => {
      const loc = renderAt(Page, `${path}?status=${value}`);
      expect(lastStatus(query)).toBe(value);

      act(() => loc.navigate(path));
      expect(lastStatus(query)).toBeUndefined();

      act(() => loc.navigate(`${path}?status=${value}`));
      expect(lastStatus(query)).toBe(value);

      act(() => loc.navigate(`${path}?status=not-a-status`));
      expect(lastStatus(query)).toBeUndefined();
    });
  }

  it("Requisitions: takes branch_approved, hq_approved and cancelled; approved falls back to All", () => {
    const path = "/app/inventory/requisitions";
    const loc = renderAt(Requisitions, `${path}?status=branch_approved`);
    const q = "inventoryV2.requisitions.list";
    expect(lastStatus(q)).toBe("branch_approved");
    act(() => loc.navigate(`${path}?status=hq_approved`));
    expect(lastStatus(q)).toBe("hq_approved");
    act(() => loc.navigate(`${path}?status=cancelled`));
    expect(lastStatus(q)).toBe("cancelled");
    act(() => loc.navigate(`${path}?status=approved`));
    expect(lastStatus(q)).toBeUndefined();
  });
});
