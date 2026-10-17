/**
 * Facilities ?status= deep link (Chief's #147 recheck): a valid value filters, no status resets to All on
 * in-app navigation, and other query params (view) don't reset a filter the user picked.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => {
  const make = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      get(_t, key: string) {
        if (key === "useQuery") return () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
        if (key === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
        if (key === "useUtils") return () => make(["utils"]);
        if (key === "then") return undefined;
        return make([...path, key]);
      },
    });
  return { trpc: make([]) };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin", siteId: 1 }, loading: false }) }));
vi.mock("@/components/facilities/FacilitiesMap", () => ({ FacilitiesMap: () => null }));
// The real toolbar is covered by its own tests; here it just shows the status and lets us pick one.
vi.mock("@/components/facilities/FacilitiesToolbar", () => ({
  FacilitiesToolbar: (p: { status: string; onStatus: (s: "all" | "active" | "inactive") => void }) => (
    <div>
      <span data-testid="status">{p.status}</span>
      <button type="button" onClick={() => p.onStatus("inactive")}>
        Pick inactive
      </button>
    </div>
  ),
}));

import { FacilitiesPage } from "../Facilities";

const status = () => screen.getByTestId("status").textContent;

function renderAt(path: string) {
  const loc = memoryLocation({ path, record: true });
  render(
    <Router hook={loc.hook} searchHook={loc.searchHook}>
      <FacilitiesPage segment="all" />
    </Router>,
  );
  return loc;
}

describe("Facilities ?status= deep link", () => {
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({
      matches: q.includes("min-width"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  it("filters from ?status= and resets to All when the URL has no status or an unknown one", () => {
    const loc = renderAt("/facilities/all?status=inactive");
    expect(status()).toBe("inactive");
    act(() => loc.navigate("/facilities/all"));
    expect(status()).toBe("all");
    act(() => loc.navigate("/facilities/all?status=active"));
    expect(status()).toBe("active");
    act(() => loc.navigate("/facilities/all?status=bogus"));
    expect(status()).toBe("all");
  });

  it("keeps a filter the user picked when another query param changes", () => {
    const loc = renderAt("/facilities/all");
    fireEvent.click(screen.getByRole("button", { name: "Pick inactive" }));
    expect(status()).toBe("inactive");
    act(() => loc.navigate("/facilities/all?view=table"));
    expect(status()).toBe("inactive");
  });
});
