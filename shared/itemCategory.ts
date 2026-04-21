import { z } from "zod";

/** Stored on `inventory_catalogue.item_category` (taxonomy), distinct from IFRC `category` varchar. */
export const ITEM_CATEGORY_VALUES = [
  "food_nutrition",
  "shelter_nfi",
  "wash",
  "medical_supplies",
  "emergency_kits",
  "equipment_tools",
  "other",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORY_VALUES)[number];

export const itemCategoryZod = z.enum(ITEM_CATEGORY_VALUES);
