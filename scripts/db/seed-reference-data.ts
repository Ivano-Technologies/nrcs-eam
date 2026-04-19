/**
 * Seed minimum reference data after a full reset (or fresh DB).
 * Does NOT seed sites, vendors, or assets.
 *
 * Usage: pnpm exec tsx scripts/db/seed-reference-data.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { appSettings, assetCategories, emailTemplates } from "../../drizzle/schema";
import { getDb, resetDbConnection } from "../../server/db";

const ASSET_CATEGORY_NAMES = [
  "Vehicle",
  "Furniture & Fixtures",
  "Generator",
  "Land",
  "Land & Building",
  "Medical Equipment",
  "Office Equipment",
  "Communications Equipment",
  "Computer Equipment",
  "IT Equipment",
  "Other Equipment",
  "Software",
  "Visibility",
  "Building",
  "Power Source",
] as const;

type TemplateRow = {
  templateType: string;
  subject: string;
  htmlContent: string;
  textContent: string;
};

function templates(): TemplateRow[] {
  const wrap = (title: string, body: string) => ({
    subject: title,
    htmlContent: `<!DOCTYPE html><html><body><h1>${title}</h1><p>${body}</p><p>— NRCS EAM</p></body></html>`,
    textContent: `${title}\n\n${body}\n\n— NRCS EAM`,
  });

  return [
    {
      templateType: "welcome",
      ...wrap("Welcome to NRCS EAM", "Your account has been approved. You can sign in with your email and password."),
    },
    {
      templateType: "password_reset",
      ...wrap("Password reset", "Use the link from your authentication provider to reset your password."),
    },
    {
      templateType: "low_stock_alert",
      ...wrap("Low stock alert", "An inventory item has fallen below its minimum stock level."),
    },
    {
      templateType: "maintenance_due_reminder",
      ...wrap("Maintenance due", "A preventive maintenance schedule is due soon. Review the Maintenance module."),
    },
    {
      templateType: "work_order_assigned",
      ...wrap("Work order assigned", "A work order has been assigned to you or your team."),
    },
  ];
}

async function main(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("No database connection (check DATABASE_URL).");
    process.exit(1);
  }

  console.log("Seeding app_settings…");
  const settings: { key: string; value: string }[] = [
    { key: "openRegistration", value: "false" },
    { key: "emailNotifyNewUserRequests", value: "true" },
    { key: "emailNotifyLowStock", value: "true" },
    { key: "emailNotifyOverdueMaintenance", value: "true" },
  ];

  for (const { key, value } of settings) {
    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  console.log("Seeding asset categories…");
  let catAdded = 0;
  for (const name of ASSET_CATEGORY_NAMES) {
    const existing = await db.select({ id: assetCategories.id }).from(assetCategories).where(eq(assetCategories.name, name)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(assetCategories).values({ name, description: null });
    catAdded++;
  }
  console.log(`  Categories inserted: ${catAdded} (skipped existing by name).`);

  console.log("Seeding email templates…");
  let tplAdded = 0;
  for (const t of templates()) {
    const existing = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.templateType, t.templateType))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(emailTemplates)
        .set({
          subject: t.subject,
          htmlContent: t.htmlContent,
          textContent: t.textContent,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.templateType, t.templateType));
    } else {
      await db.insert(emailTemplates).values({
        templateType: t.templateType,
        subject: t.subject,
        htmlContent: t.htmlContent,
        textContent: t.textContent,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tplAdded++;
    }
  }
  console.log(`  Email templates: ${tplAdded} inserted, others upserted by template_type.`);

  console.log("\nReference data seed completed.\n");

  await resetDbConnection();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await resetDbConnection();
  process.exit(1);
});
