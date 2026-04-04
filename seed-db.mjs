import { drizzle } from "drizzle-orm/mysql2";
import { sites, assetCategories } from "./drizzle/schema.ts";
import * as dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function seed() {
  console.log("Seeding database...");

  // Seed sites
  const siteData = [
    {
      name: "NRCS Headquarters - Abuja",
      address: "11 Eko Akete Close, Off Okotie Eboh Street",
      city: "Abuja",
      state: "FCT",
      country: "Nigeria",
      contactPerson: "Admin",
      contactPhone: "+234-XXX-XXXX",
      isActive: true,
    },
    {
      name: "NRCS Lagos Branch",
      address: "Lagos Office Complex",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      isActive: true,
    },
    {
      name: "NRCS Kano Branch",
      address: "Kano Office",
      city: "Kano",
      state: "Kano",
      country: "Nigeria",
      isActive: true,
    },
  ];

  for (const site of siteData) {
    await db.insert(sites).values(site).onDuplicateKeyUpdate({ set: { name: site.name } });
  }

  // Seed asset categories
  const categoryData = [
    { name: "Vehicles", description: "Cars, trucks, ambulances, and other vehicles" },
    { name: "Buildings", description: "Office buildings, warehouses, and facilities" },
    { name: "Machinery", description: "Generators, pumps, and industrial equipment" },
    { name: "Medical Equipment", description: "Medical devices and healthcare equipment" },
    { name: "IT Equipment", description: "Computers, servers, and networking devices" },
    { name: "Furniture", description: "Office furniture and fixtures" },
    { name: "Communication Equipment", description: "Radios, phones, and communication devices" },
  ];

  for (const category of categoryData) {
    await db.insert(assetCategories).values(category).onDuplicateKeyUpdate({ set: { name: category.name } });
  }

  console.log("Database seeded successfully!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
