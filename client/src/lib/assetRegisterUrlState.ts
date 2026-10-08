/**
 * Asset Register filter / sort / pagination state <-> URL search params.
 *
 * Only filters the backend `assets.registerList` query actually supports are persisted:
 * search, register status, category group, facility (siteId), item type, sort, page and page size.
 * Defaults are omitted from the URL so a clean register keeps a clean `/app/assets` link.
 */

export const ASSET_REGISTER_SORT_KEYS = [
  "itemType",
  "categoryName",
  "subCategory",
  "name",
  "assetTag",
  "serialNumber",
  "acquisitionCost",
  "currentDepreciatedValue",
  "acquisitionMethod",
  "projectRef",
  "yearAcquired",
  "acquisitionCondition",
  "registerStatus",
  "assignedToName",
  "department",
  "siteName",
  "physicalCondition",
  "lastCheckedAt",
  "notes",
  "createdAt",
] as const;

export type AssetRegisterSortKey = (typeof ASSET_REGISTER_SORT_KEYS)[number];

const SORT_KEY_SET: ReadonlySet<string> = new Set(ASSET_REGISTER_SORT_KEYS);

export function isAssetRegisterSortKey(value: string): value is AssetRegisterSortKey {
  return SORT_KEY_SET.has(value);
}

export const ASSET_REGISTER_STATUS_VALUES = [
  "in_use",
  "in_store",
  "under_maintenance",
  "disposed",
  "to_be_disposed",
  "out_of_order",
  "beyond_repair",
] as const;

export const ASSET_REGISTER_PAGE_SIZES = ["25", "50", "100", "all"] as const;

export type AssetRegisterUrlState = {
  /** Free-text search (description, code, serial). */
  search: string;
  /** Register status key or "all". */
  status: string;
  /** Category group: comma-joined category ids, or "all". */
  category: string;
  /** Facility id as a string, or "all". */
  site: string;
  /** "asset" | "inventory" | "all". */
  itemType: string;
  sortBy: AssetRegisterSortKey;
  sortDir: "asc" | "desc";
  /** Zero-based page index (the URL carries it one-based). */
  page: number;
  pageSize: string;
};

export const ASSET_REGISTER_URL_DEFAULTS: AssetRegisterUrlState = {
  search: "",
  status: "all",
  category: "all",
  site: "all",
  itemType: "all",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 0,
  pageSize: "50",
};

/** URL param names. `siteId` is kept for existing deep links (e.g. Facility → Assets). */
export const ASSET_REGISTER_URL_KEYS = {
  search: "q",
  status: "status",
  category: "category",
  site: "siteId",
  itemType: "type",
  sortBy: "sort",
  sortDir: "dir",
  page: "page",
  pageSize: "pageSize",
} as const satisfies Record<keyof AssetRegisterUrlState, string>;

function toParams(search: string | URLSearchParams): URLSearchParams {
  if (search instanceof URLSearchParams) return new URLSearchParams(search);
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function isPositiveIntString(v: string): boolean {
  return /^\d+$/.test(v) && Number(v) > 0;
}

/** Normalise a category group param: sorted, de-duplicated positive ids joined by comma. */
function parseCategory(raw: string | null): string {
  if (!raw) return "all";
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(isPositiveIntString)
        .map(Number)
    )
  ).sort((a, b) => a - b);
  return ids.length ? ids.join(",") : "all";
}

/** Parse URL search params into register state; unknown or invalid values fall back to defaults. */
export function parseAssetRegisterSearch(search: string | URLSearchParams): AssetRegisterUrlState {
  const p = toParams(search);
  const K = ASSET_REGISTER_URL_KEYS;
  const d = ASSET_REGISTER_URL_DEFAULTS;

  const status = p.get(K.status);
  const site = p.get(K.site)?.trim() ?? "";
  const itemType = p.get(K.itemType);
  const sortBy = p.get(K.sortBy) ?? "";
  const sortDir = p.get(K.sortDir);
  const page = p.get(K.page)?.trim() ?? "";
  const pageSize = p.get(K.pageSize);

  return {
    search: p.get(K.search) ?? d.search,
    status:
      status && (ASSET_REGISTER_STATUS_VALUES as readonly string[]).includes(status) ? status : d.status,
    category: parseCategory(p.get(K.category)),
    site: isPositiveIntString(site) ? String(Number(site)) : d.site,
    itemType: itemType === "asset" || itemType === "inventory" ? itemType : d.itemType,
    sortBy: isAssetRegisterSortKey(sortBy) ? sortBy : d.sortBy,
    sortDir: sortDir === "asc" || sortDir === "desc" ? sortDir : d.sortDir,
    page: isPositiveIntString(page) ? Number(page) - 1 : d.page,
    pageSize:
      pageSize && (ASSET_REGISTER_PAGE_SIZES as readonly string[]).includes(pageSize) ? pageSize : d.pageSize,
  };
}

/**
 * Merge register state into an existing query string (other params are preserved).
 * Returns the query string without a leading "?" ("" when everything is default).
 */
export function buildAssetRegisterSearch(
  state: AssetRegisterUrlState,
  existing: string | URLSearchParams = ""
): string {
  const p = toParams(existing);
  const K = ASSET_REGISTER_URL_KEYS;
  const d = ASSET_REGISTER_URL_DEFAULTS;
  const put = (key: string, value: string, isDefault: boolean) => {
    if (isDefault || value === "") p.delete(key);
    else p.set(key, value);
  };
  const search = state.search.trim() === "" ? "" : state.search;
  put(K.search, search, search === d.search);
  put(K.status, state.status, state.status === d.status);
  put(K.category, state.category, state.category === d.category);
  put(K.site, state.site, state.site === d.site);
  put(K.itemType, state.itemType, state.itemType === d.itemType);
  put(K.sortBy, state.sortBy, state.sortBy === d.sortBy);
  put(K.sortDir, state.sortDir, state.sortDir === d.sortDir);
  put(K.page, String(state.page + 1), state.page <= 0);
  put(K.pageSize, state.pageSize, state.pageSize === d.pageSize);
  return p.toString();
}

/** Canonical form of a query string for equality checks (no leading "?"). */
export function normalizeSearch(search: string): string {
  return toParams(search).toString();
}

export function sameAssetRegisterState(a: AssetRegisterUrlState, b: AssetRegisterUrlState): boolean {
  return (Object.keys(ASSET_REGISTER_URL_DEFAULTS) as (keyof AssetRegisterUrlState)[]).every(
    (k) => a[k] === b[k]
  );
}
