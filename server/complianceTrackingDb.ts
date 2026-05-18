import { asc, eq } from "drizzle-orm";
import {
  assets,
  buildingSafety,
  donorReporting,
  generatorCompliance,
  sites,
  vehicleCompliance,
} from "../drizzle/schema";
import * as db from "./db";

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export type DocComplianceStatus = "compliant" | "expiring" | "non_compliant";
export type GeneratorServiceStatus = "serviced" | "due_soon" | "overdue";
export type DonorReportStatus = "submitted" | "due_soon" | "overdue" | "pending";

export function documentComplianceStatus(
  dates: (string | null | undefined)[]
): DocComplianceStatus {
  const today = startOfDay(new Date());
  let hasExpiring = false;
  for (const raw of dates) {
    const iso = toIso(raw);
    if (!iso) continue;
    const d = startOfDay(new Date(iso));
    if (d < today) return "non_compliant";
    const days = daysUntil(iso);
    if (days != null && days <= 30) hasExpiring = true;
  }
  return hasExpiring ? "expiring" : "compliant";
}

export function generatorServiceStatus(nextServiceDue: string | null): GeneratorServiceStatus {
  if (!nextServiceDue) return "serviced";
  const days = daysUntil(nextServiceDue);
  if (days == null) return "serviced";
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "serviced";
}

export function donorReportStatus(
  dueDate: string,
  submittedDate: string | null
): DonorReportStatus {
  if (submittedDate) return "submitted";
  const days = daysUntil(dueDate);
  if (days != null && days < 0) return "overdue";
  if (days != null && days <= 14) return "due_soon";
  return "pending";
}

export type ComplianceSummary = {
  totalRecords: number;
  compliantCount: number;
  compliantPct: number;
  expiringSoonCount: number;
  nonCompliantCount: number;
};

function tallyStatus(
  statuses: string[]
): Pick<ComplianceSummary, "compliantCount" | "expiringSoonCount" | "nonCompliantCount"> {
  let compliantCount = 0;
  let expiringSoonCount = 0;
  let nonCompliantCount = 0;
  for (const s of statuses) {
    if (s === "compliant" || s === "serviced" || s === "submitted") compliantCount++;
    else if (s === "expiring" || s === "due_soon" || s === "pending") expiringSoonCount++;
    else nonCompliantCount++;
  }
  return { compliantCount, expiringSoonCount, nonCompliantCount };
}

export async function getComplianceSummary(): Promise<ComplianceSummary> {
  const [vehicles, generators, buildings, donors] = await Promise.all([
    listVehicleCompliance(),
    listGeneratorCompliance(),
    listBuildingSafety(),
    listDonorReporting(),
  ]);
  const statuses = [
    ...vehicles.map((v) => v.status),
    ...generators.map((g) => g.status),
    ...buildings.map((b) => b.status),
    ...donors.map((d) => d.status),
  ];
  const totalRecords = statuses.length;
  const { compliantCount, expiringSoonCount, nonCompliantCount } = tallyStatus(statuses);
  return {
    totalRecords,
    compliantCount,
    compliantPct: totalRecords ? Math.round((compliantCount / totalRecords) * 100) : 100,
    expiringSoonCount,
    nonCompliantCount,
  };
}

export async function countVehiclesExpiringSoon(): Promise<number> {
  const rows = await listVehicleCompliance({ status: "expiring" });
  return rows.length;
}

export async function countGeneratorsOverdue(): Promise<number> {
  const rows = await listGeneratorCompliance({ status: "overdue" });
  return rows.length;
}

export async function countDonorReportsDueSoon(): Promise<number> {
  const rows = await listDonorReporting({ status: "due_soon" });
  return rows.length;
}

export type VehicleComplianceRow = {
  id: number;
  assetId: number;
  assetCode: string | null;
  description: string;
  branch: string | null;
  plateNumber: string | null;
  roadWorthinessExpiry: string | null;
  insuranceExpiry: string | null;
  licenceExpiry: string | null;
  lastInspectionDate: string | null;
  status: DocComplianceStatus;
  notes: string | null;
};

export async function listVehicleCompliance(filters?: {
  status?: DocComplianceStatus;
}): Promise<VehicleComplianceRow[]> {
  const database = await db.getDb();
  if (!database) return [];

  const rows = await database
    .select({
      id: vehicleCompliance.id,
      assetId: vehicleCompliance.assetId,
      assetCode: assets.assetCode,
      description: assets.name,
      branch: sites.name,
      plateNumber: vehicleCompliance.plateNumber,
      roadWorthinessExpiry: vehicleCompliance.roadWorthinessExpiry,
      insuranceExpiry: vehicleCompliance.insuranceExpiry,
      licenceExpiry: vehicleCompliance.licenceExpiry,
      lastInspectionDate: vehicleCompliance.lastInspectionDate,
      notes: vehicleCompliance.notes,
    })
    .from(vehicleCompliance)
    .innerJoin(assets, eq(vehicleCompliance.assetId, assets.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .orderBy(asc(assets.assetCode));

  const out: VehicleComplianceRow[] = [];
  for (const r of rows) {
    const status = documentComplianceStatus([
      toIso(r.roadWorthinessExpiry),
      toIso(r.insuranceExpiry),
      toIso(r.licenceExpiry),
    ]);
    if (filters?.status && status !== filters.status) continue;
    out.push({
      id: r.id,
      assetId: r.assetId,
      assetCode: r.assetCode,
      description: r.description,
      branch: r.branch,
      plateNumber: r.plateNumber,
      roadWorthinessExpiry: toIso(r.roadWorthinessExpiry),
      insuranceExpiry: toIso(r.insuranceExpiry),
      licenceExpiry: toIso(r.licenceExpiry),
      lastInspectionDate: toIso(r.lastInspectionDate),
      status,
      notes: r.notes,
    });
  }
  return out;
}

export async function upsertVehicleCompliance(
  input: {
    id?: number;
    assetId: number;
    plateNumber?: string | null;
    roadWorthinessExpiry?: string | null;
    insuranceExpiry?: string | null;
    licenceExpiry?: string | null;
    lastInspectionDate?: string | null;
    notes?: string | null;
    createdBy: number;
  }
): Promise<number> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const now = new Date();
  const values = {
    assetId: input.assetId,
    plateNumber: input.plateNumber ?? null,
    roadWorthinessExpiry: input.roadWorthinessExpiry ? parseIsoDate(input.roadWorthinessExpiry) : null,
    insuranceExpiry: input.insuranceExpiry ? parseIsoDate(input.insuranceExpiry) : null,
    licenceExpiry: input.licenceExpiry ? parseIsoDate(input.licenceExpiry) : null,
    lastInspectionDate: input.lastInspectionDate ? parseIsoDate(input.lastInspectionDate) : null,
    notes: input.notes ?? null,
    updatedAt: now,
  };
  if (input.id) {
    await database.update(vehicleCompliance).set(values).where(eq(vehicleCompliance.id, input.id));
    return input.id;
  }
  const [row] = await database
    .insert(vehicleCompliance)
    .values({ ...values, createdBy: input.createdBy, createdAt: now })
    .returning({ id: vehicleCompliance.id });
  return row!.id;
}

export async function deleteVehicleCompliance(id: number) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  await database.delete(vehicleCompliance).where(eq(vehicleCompliance.id, id));
}

export type GeneratorComplianceRow = {
  id: number;
  assetId: number;
  assetCode: string | null;
  description: string;
  branch: string | null;
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  serviceProvider: string | null;
  runningHoursAtService: number | null;
  safetyCertExpiry: string | null;
  status: GeneratorServiceStatus;
  notes: string | null;
};

export async function listGeneratorCompliance(filters?: {
  status?: GeneratorServiceStatus;
}): Promise<GeneratorComplianceRow[]> {
  const database = await db.getDb();
  if (!database) return [];

  const rows = await database
    .select({
      id: generatorCompliance.id,
      assetId: generatorCompliance.assetId,
      assetCode: assets.assetCode,
      description: assets.name,
      branch: sites.name,
      lastServiceDate: generatorCompliance.lastServiceDate,
      nextServiceDue: generatorCompliance.nextServiceDue,
      serviceProvider: generatorCompliance.serviceProvider,
      runningHoursAtService: generatorCompliance.runningHoursAtService,
      safetyCertExpiry: generatorCompliance.safetyCertExpiry,
      notes: generatorCompliance.notes,
    })
    .from(generatorCompliance)
    .innerJoin(assets, eq(generatorCompliance.assetId, assets.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .orderBy(asc(assets.assetCode));

  const out: GeneratorComplianceRow[] = [];
  for (const r of rows) {
    const status = generatorServiceStatus(toIso(r.nextServiceDue));
    if (filters?.status && status !== filters.status) continue;
    out.push({
      id: r.id,
      assetId: r.assetId,
      assetCode: r.assetCode,
      description: r.description,
      branch: r.branch,
      lastServiceDate: toIso(r.lastServiceDate),
      nextServiceDue: toIso(r.nextServiceDue),
      serviceProvider: r.serviceProvider,
      runningHoursAtService: r.runningHoursAtService,
      safetyCertExpiry: toIso(r.safetyCertExpiry),
      status,
      notes: r.notes,
    });
  }
  return out;
}

export async function upsertGeneratorCompliance(input: {
  id?: number;
  assetId: number;
  lastServiceDate?: string | null;
  nextServiceDue?: string | null;
  serviceProvider?: string | null;
  runningHoursAtService?: number | null;
  safetyCertExpiry?: string | null;
  notes?: string | null;
  createdBy: number;
}): Promise<number> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const now = new Date();
  const values = {
    assetId: input.assetId,
    lastServiceDate: input.lastServiceDate ? parseIsoDate(input.lastServiceDate) : null,
    nextServiceDue: input.nextServiceDue ? parseIsoDate(input.nextServiceDue) : null,
    serviceProvider: input.serviceProvider ?? null,
    runningHoursAtService: input.runningHoursAtService ?? null,
    safetyCertExpiry: input.safetyCertExpiry ? parseIsoDate(input.safetyCertExpiry) : null,
    notes: input.notes ?? null,
    updatedAt: now,
  };
  if (input.id) {
    await database.update(generatorCompliance).set(values).where(eq(generatorCompliance.id, input.id));
    return input.id;
  }
  const [row] = await database
    .insert(generatorCompliance)
    .values({ ...values, createdBy: input.createdBy, createdAt: now })
    .returning({ id: generatorCompliance.id });
  return row!.id;
}

export async function deleteGeneratorCompliance(id: number) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  await database.delete(generatorCompliance).where(eq(generatorCompliance.id, id));
}

export type BuildingSafetyRow = {
  id: number;
  siteId: number;
  facilityCode: string | null;
  facilityName: string;
  state: string | null;
  certificateType: string;
  issuingAuthority: string | null;
  certificateNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: DocComplianceStatus;
  notes: string | null;
};

export async function listBuildingSafety(filters?: {
  status?: DocComplianceStatus;
}): Promise<BuildingSafetyRow[]> {
  const database = await db.getDb();
  if (!database) return [];

  const rows = await database
    .select({
      id: buildingSafety.id,
      siteId: buildingSafety.siteId,
      facilityCode: sites.code,
      facilityName: sites.name,
      state: sites.state,
      certificateType: buildingSafety.certificateType,
      issuingAuthority: buildingSafety.issuingAuthority,
      certificateNumber: buildingSafety.certificateNumber,
      issueDate: buildingSafety.issueDate,
      expiryDate: buildingSafety.expiryDate,
      notes: buildingSafety.notes,
    })
    .from(buildingSafety)
    .innerJoin(sites, eq(buildingSafety.siteId, sites.id))
    .orderBy(asc(sites.name));

  const out: BuildingSafetyRow[] = [];
  for (const r of rows) {
    const status = documentComplianceStatus([toIso(r.expiryDate)]);
    if (filters?.status && status !== filters.status) continue;
    out.push({
      id: r.id,
      siteId: r.siteId,
      facilityCode: r.facilityCode,
      facilityName: r.facilityName,
      state: r.state,
      certificateType: r.certificateType,
      issuingAuthority: r.issuingAuthority,
      certificateNumber: r.certificateNumber,
      issueDate: toIso(r.issueDate),
      expiryDate: toIso(r.expiryDate),
      status,
      notes: r.notes,
    });
  }
  return out;
}

export async function upsertBuildingSafety(input: {
  id?: number;
  siteId: number;
  certificateType: string;
  issuingAuthority?: string | null;
  certificateNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  createdBy: number;
}): Promise<number> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const now = new Date();
  const values = {
    siteId: input.siteId,
    certificateType: input.certificateType,
    issuingAuthority: input.issuingAuthority ?? null,
    certificateNumber: input.certificateNumber ?? null,
    issueDate: input.issueDate ? parseIsoDate(input.issueDate) : null,
    expiryDate: input.expiryDate ? parseIsoDate(input.expiryDate) : null,
    notes: input.notes ?? null,
    updatedAt: now,
  };
  if (input.id) {
    await database.update(buildingSafety).set(values).where(eq(buildingSafety.id, input.id));
    return input.id;
  }
  const [row] = await database
    .insert(buildingSafety)
    .values({ ...values, createdBy: input.createdBy, createdAt: now })
    .returning({ id: buildingSafety.id });
  return row!.id;
}

export async function deleteBuildingSafety(id: number) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  await database.delete(buildingSafety).where(eq(buildingSafety.id, id));
}

export type DonorReportingRow = {
  id: number;
  donorName: string;
  programmeRef: string | null;
  assetId: number | null;
  siteId: number | null;
  assetOrFacility: string;
  reportType: string;
  dueDate: string;
  submittedDate: string | null;
  status: DonorReportStatus;
  notes: string | null;
};

export async function listDonorReporting(filters?: {
  status?: DonorReportStatus;
}): Promise<DonorReportingRow[]> {
  const database = await db.getDb();
  if (!database) return [];

  const rows = await database
    .select({
      id: donorReporting.id,
      donorName: donorReporting.donorName,
      programmeRef: donorReporting.programmeRef,
      assetId: donorReporting.assetId,
      siteId: donorReporting.siteId,
      assetName: assets.name,
      assetCode: assets.assetCode,
      siteName: sites.name,
      reportType: donorReporting.reportType,
      dueDate: donorReporting.dueDate,
      submittedDate: donorReporting.submittedDate,
      notes: donorReporting.notes,
    })
    .from(donorReporting)
    .leftJoin(assets, eq(donorReporting.assetId, assets.id))
    .leftJoin(sites, eq(donorReporting.siteId, sites.id))
    .orderBy(asc(donorReporting.dueDate));

  const out: DonorReportingRow[] = [];
  for (const r of rows) {
    const due = toIso(r.dueDate) ?? "";
    const submitted = toIso(r.submittedDate);
    const status = donorReportStatus(due, submitted);
    if (filters?.status && status !== filters.status) continue;
    out.push({
      id: r.id,
      donorName: r.donorName,
      programmeRef: r.programmeRef,
      assetId: r.assetId,
      siteId: r.siteId,
      assetOrFacility: r.assetName ?? r.siteName ?? "—",
      reportType: r.reportType,
      dueDate: due,
      submittedDate: submitted,
      status,
      notes: r.notes,
    });
  }
  return out;
}

export async function upsertDonorReporting(input: {
  id?: number;
  donorName: string;
  programmeRef?: string | null;
  assetId?: number | null;
  siteId?: number | null;
  reportType: string;
  dueDate: string;
  submittedDate?: string | null;
  notes?: string | null;
  createdBy: number;
}): Promise<number> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const now = new Date();
  const submitted = input.submittedDate ? parseIsoDate(input.submittedDate) : null;
  const status = donorReportStatus(input.dueDate, input.submittedDate ?? null);
  const values = {
    donorName: input.donorName,
    programmeRef: input.programmeRef ?? null,
    assetId: input.assetId ?? null,
    siteId: input.siteId ?? null,
    reportType: input.reportType,
    dueDate: parseIsoDate(input.dueDate),
    submittedDate: submitted,
    status,
    notes: input.notes ?? null,
    updatedAt: now,
  };
  if (input.id) {
    await database.update(donorReporting).set(values).where(eq(donorReporting.id, input.id));
    return input.id;
  }
  const [row] = await database
    .insert(donorReporting)
    .values({ ...values, createdBy: input.createdBy, createdAt: now })
    .returning({ id: donorReporting.id });
  return row!.id;
}

export async function deleteDonorReporting(id: number) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  await database.delete(donorReporting).where(eq(donorReporting.id, id));
}

export async function lookupAssetByCode(assetCode: string) {
  const database = await db.getDb();
  if (!database) return null;
  const [row] = await database
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      name: assets.name,
      siteName: sites.name,
    })
    .from(assets)
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .where(eq(assets.assetCode, assetCode))
    .limit(1);
  return row ?? null;
}
