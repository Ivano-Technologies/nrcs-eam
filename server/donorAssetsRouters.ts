import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { managerOrAdminProcedure } from "./routers/roleProcedures";
import * as donorDb from "./donorAssetsDb";
import { buildDonorAssetsWorkbook } from "./donorAssetsExcel";

const filtersZod = z
  .object({
    donor: z.string().optional(),
    siteId: z.number().optional(),
    categoryId: z.number().optional(),
    yearFrom: z.number().int().optional(),
    yearTo: z.number().int().optional(),
  })
  .optional();

export const donorAssetsRouter = router({
  report: protectedProcedure.input(filtersZod).query(({ input }) => donorDb.getDonorAssetsReport(input)),

  exportExcel: managerOrAdminProcedure.input(filtersZod).mutation(async ({ input }) => {
    const report = await donorDb.getDonorAssetsReport(input);
    const buffer = await buildDonorAssetsWorkbook(report);
    return {
      filename: `nrcs-donor-assets-${new Date().toISOString().slice(0, 10)}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: buffer.toString("base64"),
    };
  }),
});
