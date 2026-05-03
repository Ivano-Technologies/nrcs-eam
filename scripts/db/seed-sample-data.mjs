import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as dotenv from "dotenv";
import * as schema from "../../drizzle/schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 10 });
const db = drizzle(sql, { schema, mode: "default" });

console.log("🌱 Starting sample data population...\n");

const assetCategoryData = [
  { name: "Computer", description: "IT and computing equipment" },
  { name: "Furniture & Fixtures", description: "Office furniture and fixtures" },
  { name: "Generator", description: "Power generation equipment" },
  { name: "Land", description: "Land assets" },
  { name: "Land & Building", description: "Buildings and land & building" },
  { name: "Medical Equipment", description: "Medical and healthcare equipment" },
  { name: "Office Equipment", description: "Office furniture and equipment" },
  { name: "Vehicle", description: "Transportation vehicles and ambulances" },
];

console.log("Inserting asset categories...");
const categoryIds = {};
for (const cat of assetCategoryData) {
  const [inserted] = await db
    .insert(schema.assetCategories)
    .values(cat)
    .returning({ id: schema.assetCategories.id });
  categoryIds[cat.name] = inserted.id;
  console.log(`✓ Created category: ${cat.name}`);
}

const sites = [
  { name: "NRCS Headquarters", address: "11 Eko Akete Close, Victoria Island", city: "Lagos", state: "Lagos", country: "Nigeria", contactPerson: "Dr. Abubakar Ibrahim", contactPhone: "+234-1-2614009", latitude: "6.4281", longitude: "3.4219" },
  { name: "Abuja Regional Office", address: "Plot 1234 Central Business District", city: "Abuja", state: "FCT", country: "Nigeria", contactPerson: "Mrs. Fatima Mohammed", contactPhone: "+234-9-4612345", latitude: "9.0765", longitude: "7.3986" },
  { name: "Kano State Branch", address: "45 Murtala Mohammed Way", city: "Kano", state: "Kano", country: "Nigeria", contactPerson: "Alhaji Musa Danladi", contactPhone: "+234-64-632145", latitude: "12.0022", longitude: "8.5920" },
  { name: "Port Harcourt Office", address: "23 Aba Road", city: "Port Harcourt", state: "Rivers", country: "Nigeria", contactPerson: "Mr. Chidi Okafor", contactPhone: "+234-84-234567", latitude: "4.8156", longitude: "7.0498" },
  { name: "Ibadan Zonal Office", address: "78 Iwo Road", city: "Ibadan", state: "Oyo", country: "Nigeria", contactPerson: "Chief Adebayo Ogunleye", contactPhone: "+234-2-8123456", latitude: "7.3775", longitude: "3.9470" },
  { name: "Kaduna Branch", address: "12 Constitution Road", city: "Kaduna", state: "Kaduna", country: "Nigeria", contactPerson: "Mal. Ibrahim Yakubu", contactPhone: "+234-62-245678", latitude: "10.5105", longitude: "7.4165" },
  { name: "Enugu State Office", address: "56 Okpara Avenue", city: "Enugu", state: "Enugu", country: "Nigeria", contactPerson: "Mr. Emeka Nwankwo", contactPhone: "+234-42-456789", latitude: "6.5244", longitude: "7.5105" },
  { name: "Maiduguri Emergency Center", address: "Baga Road", city: "Maiduguri", state: "Borno", country: "Nigeria", contactPerson: "Dr. Zainab Usman", contactPhone: "+234-76-234567", latitude: "11.8333", longitude: "13.1500" },
  { name: "Calabar Coastal Office", address: "34 Marian Road", city: "Calabar", state: "Cross River", country: "Nigeria", contactPerson: "Mrs. Grace Bassey", contactPhone: "+234-87-345678", latitude: "4.9517", longitude: "8.3417" },
  { name: "Jos Plateau Office", address: "89 Ahmadu Bello Way", city: "Jos", state: "Plateau", country: "Nigeria", contactPerson: "Mr. Daniel Gyang", contactPhone: "+234-73-456789", latitude: "9.8965", longitude: "8.8583" },
];

console.log("Inserting sites...");
const siteIds = [];
for (const site of sites) {
  const [inserted] = await db.insert(schema.sites).values(site).returning({ id: schema.sites.id });
  siteIds.push(inserted.id);
  console.log(`✓ Created site: ${site.name}`);
}

const vendors = [
  { name: "Global Medical Supplies Ltd", contactPerson: "Mr. John Adeyemi", email: "john@globalmedical.ng", phone: "+234-1-7654321", address: "45 Broad Street, Lagos" },
  { name: "TechFix Solutions", contactPerson: "Eng. Sarah Okonkwo", email: "sarah@techfix.ng", phone: "+234-1-8765432", address: "12 Allen Avenue, Ikeja" },
  { name: "AutoCare Nigeria", contactPerson: "Mr. Ahmed Bello", email: "ahmed@autocare.ng", phone: "+234-9-2345678", address: "78 Wuse Zone 5, Abuja" },
  { name: "PowerGen Systems", contactPerson: "Mrs. Blessing Obi", email: "blessing@powergen.ng", phone: "+234-1-9876543", address: "23 Apapa Road, Lagos" },
  { name: "OfficeMax Supplies", contactPerson: "Mr. Tunde Bakare", email: "tunde@officemax.ng", phone: "+234-1-3456789", address: "56 Ikorodu Road, Lagos" },
  { name: "SecureNet Technologies", contactPerson: "Dr. Amina Hassan", email: "amina@securenet.ng", phone: "+234-9-8765432", address: "34 Garki II, Abuja" },
  { name: "CleanPro Services", contactPerson: "Mr. Chukwuma Eze", email: "chukwuma@cleanpro.ng", phone: "+234-1-2345678", address: "90 Herbert Macaulay Way, Yaba" },
];

console.log("\nInserting vendors...");
const vendorIds = [];
for (const v of vendors) {
  const [inserted] = await db
    .insert(schema.vendors)
    .values({ name: v.name, contactPerson: v.contactPerson, email: v.email, phone: v.phone, address: v.address })
    .returning({ id: schema.vendors.id });
  vendorIds.push(inserted.id);
  console.log(`✓ Created vendor: ${v.name}`);
}

const assetCategoryNames = [
  "Computer",
  "Furniture & Fixtures",
  "Generator",
  "Land",
  "Land & Building",
  "Medical Equipment",
  "Office Equipment",
  "Vehicle",
];
const assetTypes = {
  Computer: ["Desktop Computer", "Laptop", "Printer", "Server", "Network Router"],
  "Furniture & Fixtures": ["Office Desk", "Filing Cabinet", "Conference Table", "Air Conditioner", "Projector"],
  Generator: ["5KVA Generator", "10KVA Generator", "15KVA Generator", "20KVA Generator"],
  Land: ["Plot A", "Plot B"],
  "Land & Building": ["Office Building", "Warehouse"],
  "Medical Equipment": ["Ambulance Stretcher", "First Aid Kit", "Medical Refrigerator", "Blood Pressure Monitor", "Oxygen Concentrator"],
  "Office Equipment": ["Two-Way Radio", "Satellite Phone", "Mobile Phone", "Walkie-Talkie"],
  Vehicle: ["Ambulance", "Pickup Truck", "SUV", "Van", "Motorcycle"],
};

const statuses = ["operational", "maintenance", "retired"];
const manufacturers = ["Toyota", "HP", "Dell", "Mikano", "Samsung", "Motorola", "Medtronic", "Philips"];

console.log("\nInserting assets...");
const assets = [];
let assetCount = 0;

for (let i = 0; i < siteIds.length; i++) {
  const siteId = siteIds[i];
  const assetsPerSite = 5 + Math.floor(Math.random() * 3);

  for (let j = 0; j < assetsPerSite; j++) {
    const category = assetCategoryNames[Math.floor(Math.random() * assetCategoryNames.length)];
    const types = assetTypes[category];
    const type = types[Math.floor(Math.random() * types.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];

    const purchaseDate = new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), 1);
    const purchaseCost = 50000 + Math.floor(Math.random() * 950000);
    const currentValue = String(Math.round(purchaseCost * (0.5 + Math.random() * 0.4)));

    const warrantyMonths = [12, 24, 36, 48][Math.floor(Math.random() * 4)];
    const warrantyExpiry = new Date(purchaseDate);
    warrantyExpiry.setMonth(warrantyExpiry.getMonth() + warrantyMonths);

    const asset = {
      name: `${type} - ${String(assetCount + 1).padStart(3, "0")}`,
      assetTag: `NRCS-${category.substring(0, 3).toUpperCase()}-${String(assetCount + 1).padStart(4, "0")}`,
      categoryId: categoryIds[category],
      status,
      siteId,
      manufacturer,
      model: `${manufacturer}-${Math.floor(Math.random() * 9000) + 1000}`,
      serialNumber: `SN${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      acquisitionDate: purchaseDate,
      acquisitionCost: String(purchaseCost),
      currentValue,
      warrantyExpiry,
      description: `${type} for ${sites[i].name}`,
      barcode: `BC${Math.random().toString(36).substring(2, 14).toUpperCase()}`,
    };

    const [inserted] = await db.insert(schema.assets).values(asset).returning({ id: schema.assets.id });
    assets.push({ id: inserted.id, ...asset, siteId });
    assetCount++;
  }
}
console.log(`✓ Created ${assetCount} assets`);

const workOrderStatuses = ["pending", "in_progress", "completed", "cancelled"];
const priorities = ["low", "medium", "high", "critical"];
const workOrderTypes = ["corrective", "preventive", "inspection", "emergency"];

console.log("\nInserting work orders...");
for (let i = 0; i < 25; i++) {
  const asset = assets[Math.floor(Math.random() * assets.length)];
  const status = workOrderStatuses[Math.floor(Math.random() * workOrderStatuses.length)];
  const priority = priorities[Math.floor(Math.random() * priorities.length)];
  const type = workOrderTypes[Math.floor(Math.random() * workOrderTypes.length)];

  const createdDate = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  const dueDate = new Date(createdDate);
  dueDate.setDate(dueDate.getDate() + 7 + Math.floor(Math.random() * 14));

  const workOrder = {
    workOrderNumber: `WO-${String(i + 1).padStart(5, "0")}`,
    title: `${type} - ${asset.name}`,
    description: `${type} required for ${asset.name} at ${sites.find((s) => s.name)?.name || "site"}`,
    assetId: asset.id,
    siteId: asset.siteId,
    status,
    priority,
    type,
    requestedBy: 1,
    createdAt: createdDate,
    scheduledStart: dueDate,
    estimatedCost: String(5000 + Math.floor(Math.random() * 45000)),
  };

  if (status === "completed") {
    const actualEnd = new Date(dueDate);
    actualEnd.setDate(actualEnd.getDate() - Math.floor(Math.random() * 3));
    workOrder.actualEnd = actualEnd;
    workOrder.actualCost = String(Number(workOrder.estimatedCost) * (0.8 + Math.random() * 0.4));
  }

  await db.insert(schema.workOrders).values(workOrder);
}
console.log("✓ Created 25 work orders");

console.log("\nInserting financial transactions...");
for (let i = 0; i < 30; i++) {
  const isExpense = Math.random() > 0.5;
  const amount = 10000 + Math.floor(Math.random() * 490000);
  const date = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

  await db.insert(schema.financialTransactions).values({
    transactionType: isExpense ? "maintenance" : "revenue",
    amount: String(amount),
    transactionDate: date,
    createdBy: 1,
    description: isExpense ? "Equipment maintenance and repairs" : "Donor contribution",
    vendorId: isExpense ? vendorIds[Math.floor(Math.random() * vendorIds.length)] : null,
    assetId: isExpense ? assets[Math.floor(Math.random() * assets.length)].id : null,
  });
}
console.log("✓ Created 30 financial transactions");

console.log("\n✅ Sample data population completed successfully!");
console.log(`\nSummary:`);
console.log(`- Asset Categories: ${assetCategoryData.length}`);
console.log(`- Sites: ${sites.length}`);
console.log(`- Vendors: ${vendors.length}`);
console.log(`- Assets: ${assetCount}`);
console.log(`- Work Orders: 25`);
console.log(`- Financial Transactions: 30`);

await sql.end({ timeout: 10 });
process.exit(0);
