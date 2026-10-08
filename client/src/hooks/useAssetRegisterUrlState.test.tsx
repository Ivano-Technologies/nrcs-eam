import { act, cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { useAssetRegisterUrlState } from "./useAssetRegisterUrlState";

afterEach(() => {
  cleanup();
});

function setup(initial: string) {
  const loc = memoryLocation({ path: initial, record: true });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Router hook={loc.hook} searchHook={loc.searchHook}>
      {children}
    </Router>
  );
  const hook = renderHook(() => useAssetRegisterUrlState(), { wrapper });
  return { loc, ...hook };
}

const current = (loc: ReturnType<typeof memoryLocation>) => loc.history![loc.history!.length - 1];

describe("useAssetRegisterUrlState", () => {
  it("restores filters from the URL on load", () => {
    const { result } = setup("/app/assets?status=in_store&siteId=3&page=2&pageSize=25");
    expect(result.current.state).toMatchObject({ status: "in_store", site: "3", page: 1, pageSize: "25" });
  });

  it("writes filter changes to the URL with replace and resets the page", () => {
    const { result, loc } = setup("/app/assets?page=4");
    act(() => result.current.setStatusFilter("disposed"));
    expect(result.current.state.page).toBe(0);
    expect(current(loc)).toBe("/app/assets?status=disposed");
    expect(loc.history).toHaveLength(1);
  });

  it("keeps the page when sorting and when paging", () => {
    const { result, loc } = setup("/app/assets");
    act(() => result.current.setPage(2));
    act(() => result.current.setSort("name", "asc"));
    expect(current(loc)).toBe("/app/assets?page=3&sort=name&dir=asc");
  });

  it("picks up external URL changes (back/forward, deep links)", () => {
    const { result, loc } = setup("/app/assets?status=in_use");
    act(() => loc.navigate("/app/assets?siteId=9&type=asset"));
    expect(result.current.state).toMatchObject({ status: "all", site: "9", itemType: "asset" });
  });

  it("clearFilters removes filter params but keeps sort", () => {
    const { result, loc } = setup("/app/assets?q=x&status=in_use&sort=name&dir=asc");
    act(() => result.current.clearFilters());
    expect(current(loc)).toBe("/app/assets?sort=name&dir=asc");
  });
});
