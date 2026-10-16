import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  buildAssetRegisterSearch,
  normalizeSearch,
  parseAssetRegisterSearch,
  sameAssetRegisterState,
  type AssetRegisterUrlState,
} from "@/lib/assetRegisterUrlState";

type FilterKey = "search" | "status" | "category" | "site" | "itemType" | "pageSize";

/**
 * Asset Register filters, sort and pagination persisted in the URL search params.
 *
 * - Initial state comes from the URL, so links like `/app/assets?status=in_store&siteId=3` restore the view.
 * - State changes are written back with `replace` (no history entry per keystroke).
 * - External URL changes (back/forward, sidebar link, Facility → Assets deep link) are read back into state.
 * - Changing a filter or the page size resets to the first page; sorting keeps the current page.
 */
export function useAssetRegisterUrlState() {
  const [location, navigate] = useLocation();
  const urlSearch = useSearch();
  const [state, setState] = useState<AssetRegisterUrlState>(() => parseAssetRegisterSearch(urlSearch));

  const latest = useRef({ location, urlSearch, navigate });
  // Declared before the sync effects so they always see the current location/search.
  useEffect(() => {
    latest.current = { location, urlSearch, navigate };
  });
  /** Last query string this hook wrote, so the URL→state effect ignores our own writes. */
  const lastWritten = useRef<string | null>(null);

  // URL -> state
  useEffect(() => {
    const normalized = normalizeSearch(urlSearch);
    if (lastWritten.current !== null && normalized === lastWritten.current) return;
    lastWritten.current = null;
    const parsed = parseAssetRegisterSearch(normalized);
    setState((prev) => (sameAssetRegisterState(prev, parsed) ? prev : parsed));
  }, [urlSearch]);

  // state -> URL (only depends on state; location/search are read from a ref to avoid
  // writing stale state back over an external URL change in the same commit)
  useEffect(() => {
    const { location: path, urlSearch: current, navigate: go } = latest.current;
    const next = buildAssetRegisterSearch(state, current);
    if (next === normalizeSearch(current)) return;
    lastWritten.current = next;
    go(next ? `${path}?${next}` : path, { replace: true });
  }, [state]);

  const setFilter = useCallback((key: FilterKey, value: string) => {
    setState((prev) => (prev[key] === value ? prev : { ...prev, [key]: value, page: 0 }));
  }, []);

  const setSearchTerm = useCallback((v: string) => setFilter("search", v), [setFilter]);
  const setStatusFilter = useCallback((v: string) => setFilter("status", v), [setFilter]);
  const setCategoryFilter = useCallback((v: string) => setFilter("category", v), [setFilter]);
  const setSiteFilter = useCallback((v: string) => setFilter("site", v), [setFilter]);
  const setItemTypeFilter = useCallback((v: string) => setFilter("itemType", v), [setFilter]);
  const setPageSize = useCallback((v: string) => setFilter("pageSize", v), [setFilter]);

  const setPage = useCallback((next: number | ((prev: number) => number)) => {
    setState((prev) => {
      const page = Math.max(0, typeof next === "function" ? next(prev.page) : next);
      return page === prev.page ? prev : { ...prev, page };
    });
  }, []);

  const setSort = useCallback(
    (sortBy: AssetRegisterUrlState["sortBy"], sortDir: AssetRegisterUrlState["sortDir"]) => {
      setState((prev) =>
        prev.sortBy === sortBy && prev.sortDir === sortDir ? prev : { ...prev, sortBy, sortDir }
      );
    },
    []
  );

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      search: "",
      status: "all",
      category: "all",
      site: "all",
      itemType: "all",
      page: 0,
    }));
  }, []);

  return {
    state,
    setSearchTerm,
    setStatusFilter,
    setCategoryFilter,
    setSiteFilter,
    setItemTypeFilter,
    setPageSize,
    setPage,
    setSort,
    clearFilters,
  };
}
