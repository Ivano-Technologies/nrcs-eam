import { describe, expect, it } from "vitest";
import type { GrnFinalizeContext } from "./grnStockLedger";
import { validateGrnFinalize } from "./grnStockLedger";

const baseGrn = {
  id: 1,
  grnNumber: "NRCS-LOC-2026-0001",
  countryCode: "NG",
  consignmentNumber: null,
  delegationLocationId: 10,
  receivedFrom: "Donor A",
  dateOfArrival: "2026-06-01",
  documentWellReceived: true,
  incompleteDocumentsNotes: null,
  meansOfTransport: "road" as const,
  awbNumber: null,
  waybillCmrNumber: null,
  blNumber: null,
  flightNumber: null,
  registrationNumber: null,
  vesselName: null,
  deliveredByName: null,
  deliveredByFunction: null,
  deliveredByDate: null,
  deliveredBySignatureUrl: null,
  receivedByName: null,
  receivedByFunction: null,
  receivedByDate: null,
  receivedBySignatureUrl: null,
  comments: null,
  copiesPrinted: {},
  createdBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  finalizedBy: null,
  finalizedAt: null,
};

function ctx(status: "draft" | "pending_approval" | "finalized", lines: GrnFinalizeContext["lines"]): GrnFinalizeContext {
  return {
    grn: { ...baseGrn, status },
    lines,
  };
}

const lineWithCtn = {
  id: 1,
  grnId: 1,
  consignmentNumber: null,
  description: "Rice",
  ctnOrDonor: null,
  ctnId: 42,
  nbOfUnits: 10,
  unitType: "bags",
  weightKg: null,
  receivedInGoodCondition: true,
  claimNotes: null,
  lineOrder: 0,
};

describe("validateGrnFinalize", () => {
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 42 }],
        }),
      }),
    }),
  } as unknown as Parameters<typeof validateGrnFinalize>[0];

  it("rejects finalized GRN", async () => {
    await expect(validateGrnFinalize(mockDb, ctx("finalized", [lineWithCtn]))).rejects.toThrow(
      "not in a finalizable state"
    );
  });

  it("rejects empty lines", async () => {
    await expect(validateGrnFinalize(mockDb, ctx("draft", []))).rejects.toThrow("no line items");
  });

  it("rejects missing CTN", async () => {
    await expect(
      validateGrnFinalize(mockDb, ctx("draft", [{ ...lineWithCtn, ctnId: null }]))
    ).rejects.toThrow("CTN is required");
  });

  it("accepts draft with CTN when CTN exists", async () => {
    await expect(validateGrnFinalize(mockDb, ctx("draft", [lineWithCtn]))).resolves.toBeUndefined();
  });

  it("accepts pending_approval status", async () => {
    await expect(validateGrnFinalize(mockDb, ctx("pending_approval", [lineWithCtn]))).resolves.toBeUndefined();
  });
});
