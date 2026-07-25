import { z } from "zod";

export const assetItemTypeInputZod = z.enum(["Asset", "Inventory", "asset", "inventory"]);

export function normalizeAssetItemType(
  value: z.infer<typeof assetItemTypeInputZod> | undefined
): "Asset" | "Inventory" {
  return value?.toLowerCase() === "inventory" ? "Inventory" : "Asset";
}
