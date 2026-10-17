import { describe, expect, it } from "vitest";
import {
  FACILITY_STATUS_FILTERS,
  RECEIPT_STATUS_FILTERS,
  REQUISITION_STATUS_FILTERS,
  STOCK_COUNT_STATUS_FILTERS,
  statusFilterFromSearch,
} from "./statusFilterParam";

describe("statusFilterFromSearch", () => {
  it("accepts a page's real filter values, with or without the leading ?", () => {
    expect(statusFilterFromSearch("?status=draft", RECEIPT_STATUS_FILTERS)).toBe("draft");
    expect(statusFilterFromSearch("status=in_progress", STOCK_COUNT_STATUS_FILTERS)).toBe("in_progress");
    expect(statusFilterFromSearch("status=inactive&view=map", FACILITY_STATUS_FILTERS)).toBe("inactive");
  });

  it("falls back to all when status is missing, empty or unknown", () => {
    expect(statusFilterFromSearch("", RECEIPT_STATUS_FILTERS)).toBe("all");
    expect(statusFilterFromSearch("view=map", FACILITY_STATUS_FILTERS)).toBe("all");
    expect(statusFilterFromSearch("status=", STOCK_COUNT_STATUS_FILTERS)).toBe("all");
    expect(statusFilterFromSearch("status=bogus", FACILITY_STATUS_FILTERS)).toBe("all");
  });

  it("requisitions: takes branch_approved, hq_approved and cancelled; approved is not a requisition filter", () => {
    for (const s of ["draft", "submitted", "branch_approved", "hq_approved", "fulfilled", "rejected", "cancelled"]) {
      expect(statusFilterFromSearch(`status=${s}`, REQUISITION_STATUS_FILTERS)).toBe(s);
    }
    expect(statusFilterFromSearch("status=approved", REQUISITION_STATUS_FILTERS)).toBe("all");
  });
});
