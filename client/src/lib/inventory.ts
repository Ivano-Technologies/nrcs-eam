import { ITEM_CATEGORY_VALUES, type ItemCategory } from "@shared/itemCategory";

export type ItemCategoryRow = { readonly value: ItemCategory; readonly label: string; readonly hint?: string };

export const ITEM_CATEGORIES: ReadonlyArray<ItemCategoryRow> = [
  { value: "food_nutrition", label: "Food & Nutrition" },
  { value: "shelter_nfi", label: "Shelter & NFI", hint: "Tents, blankets, tarpaulins" },
  { value: "wash", label: "WASH", hint: "Water, sanitation, hygiene" },
  { value: "medical_supplies", label: "Medical Supplies" },
  { value: "emergency_kits", label: "Emergency Kits", hint: "Dignity, Hygiene, Family" },
  { value: "equipment_tools", label: "Equipment & Tools" },
  { value: "other", label: "Other" },
];

const VALUE_SET = new Set<string>(ITEM_CATEGORY_VALUES);

export function isItemCategoryValue(s: string | null | undefined): s is ItemCategory {
  return s != null && VALUE_SET.has(s);
}

export function itemCategoryLabel(value: ItemCategory | null | undefined): string {
  if (value == null) return "—";
  const row = ITEM_CATEGORIES.find((c) => c.value === value);
  return row?.label ?? String(value);
}
