import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('🌱 Starting sample data population...\n');

// Sample Asset Categories
const assetCategoryData = [
  { name: 'Medical Equipment', description: 'Medical and healthcare equipment' },
  { name: 'Vehicles', description: 'Transportation vehicles and ambulances' },
  { name: 'IT Equipment', description: 'Computers, servers, and IT infrastructure' },
  { name: 'Generators', description: 'Power generation equipment' },
  { name: 'Office Equipment', description: 'Office furniture and equipment' },
  { name: 'Communication Equipment', description: 'Radios, phones, and communication devices' }
];

console.log('Inserting asset categories...');
const categoryIds = {};
for (const cat of assetCategoryData) {
  const [result] = await db.insert(schema.assetCategories).values(cat);
  categoryIds[cat.name] = result.insertId;
  console.log(`✓ Created category: ${cat.name}`);
}

// Sample Sites (10 locations across Nigeria)
const sites = [
  { name: 'NRCS Headquarters', address: '11 Eko Akete Close, Victoria Island', city: 'Lagos', state: 'Lagos', country: 'Nigeria', contactPerson: 'Dr. Abubakar Ibrahim', phone: '+234-1-2614009', latitude: 6.4281, longitude: 3.4219 },
  { name: 'Abuja Regional Office', address: 'Plot 1234 Central Business District', city: 'Abuja', state: 'FCT', country: 'Nigeria', contactPerson: 'Mrs. Fatima Mohammed', phone: '+234-9-4612345', latitude: 9.0765, longitude: 7.3986 },
  { name: 'Kano State Branch', address: '45 Murtala Mohammed Way', city: 'Kano', state: 'Kano', country: 'Nigeria', contactPerson: 'Alhaji Musa Danladi', phone: '+234-64-632145', latitude: 12.0022, longitude: 8.5920 },
  { name: 'Port Harcourt Office', address: '23 Aba Road', city: 'Port Harcourt', state: 'Rivers', country: 'Nigeria', contactPerson: 'Mr. Chidi Okafor', phone: '+234-84-234567', latitude: 4.8156, longitude: 7.0498 },
  { name: 'Ibadan Zonal Office', address: '78 Iwo Road', city: 'Ibadan', state: 'Oyo', country: 'Nigeria', contactPerson: 'Chief Adebayo Ogunleye', phone: '+234-2-8123456', latitude: 7.3775, longitude: 3.9470 },
  { name: 'Kaduna Branch', address: '12 Constitution Road', city: 'Kaduna', state: 'Kaduna', country: 'Nigeria', contactPerson: 'Mal. Ibrahim Yakubu', phone: '+234-62-245678', latitude: 10.5105, longitude: 7.4165 },
  { name: 'Enugu State Office', address: '56 Okpara Avenue', city: 'Enugu', state: 'Enugu', country: 'Nigeria', contactPerson: 'Mr. Emeka Nwankwo', phone: '+234-42-456789', latitude: 6.5244, longitude: 7.5105 },
  { name: 'Maiduguri Emergency Center', address: 'Baga Road', city: 'Maiduguri', state: 'Borno', country: 'Nigeria', contactPerson: 'Dr. Zainab Usman', phone: '+234-76-234567', latitude: 11.8333, longitude: 13.1500 },
  { name: 'Calabar Coastal Office', address: '34 Marian Road', city: 'Calabar', state: 'Cross River', country: 'Nigeria', contactPerson: 'Mrs. Grace Bassey', phone: '+234-87-345678', latitude: 4.9517, longitude: 8.3417 },
  { name: 'Jos Plateau Office', address: '89 Ahmadu Bello Way', city: 'Jos', state: 'Plateau', country: 'Nigeria', contactPerson: 'Mr. Daniel Gyang', phone: '+234-73-456789', latitude: 9.8965, longitude: 8.8583 }
];

console.log('Inserting sites...');
const siteIds = [];
for (const site of sites) {
  const [result] = await db.insert(schema.sites).values(site);
  siteIds.push(result.insertId);
  console.log(`✓ Created site: ${site.name}`);
}

// Sample Vendors
const vendors = [
  { name: 'Global Medical Supplies Ltd', contactPerson: 'Mr. John Adeyemi', email: 'john@globalmedical.ng', phone: '+234-1-7654321', address: '45 Broad Street, Lagos', category: 'Medical Equipment' },
  { name: 'TechFix Solutions', contactPerson: 'Eng. Sarah Okonkwo', email: 'sarah@techfix.ng', phone: '+234-1-8765432', address: '12 Allen Avenue, Ikeja', category: 'IT Services' },
  { name: 'AutoCare Nigeria', contactPerson: 'Mr. Ahmed Bello', email: 'ahmed@autocare.ng', phone: '+234-9-2345678', address: '78 Wuse Zone 5, Abuja', category: 'Vehicle Maintenance' },
  { name: 'PowerGen Systems', contactPerson: 'Mrs. Blessing Obi', email: 'blessing@powergen.ng', phone: '+234-1-9876543', address: '23 Apapa Road, Lagos', category: 'Generators' },
  { name: 'OfficeMax Supplies', contactPerson: 'Mr. Tunde Bakare', email: 'tunde@officemax.ng', phone: '+234-1-3456789', address: '56 Ikorodu Road, Lagos', category: 'Office Supplies' },
  { name: 'SecureNet Technologies', contactPerson: 'Dr. Amina Hassan', email: 'amina@securenet.ng', phone: '+234-9-8765432', address: '34 Garki II, Abuja', category: 'Security Systems' },
  { name: 'CleanPro Services', contactPerson: 'Mr. Chukwuma Eze', email: 'chukwuma@cleanpro.ng', phone: '+234-1-2345678', address: '90 Herbert Macaulay Way, Yaba', category: 'Cleaning Services' }
];

console.log('\nInserting vendors...');
const vendorIds = [];
for (const vendor of vendors) {
  const [result] = await db.insert(schema.vendors).values(vendor);
  vendorIds.push(result.insertId);
  console.log(`✓ Created vendor: ${vendor.name}`);
}

// Sample Assets (50+ assets)
const assetCategories = ['Medical Equipment', 'Vehicles', 'IT Equipment', 'Generators', 'Office Equipment', 'Communication Equipment'];
const assetTypes = {
  'Medical Equipment': ['Ambulance Stretcher', 'First Aid Kit', 'Medical Refrigerator', 'Blood Pressure Monitor', 'Oxygen Concentrator'],
  'Vehicles': ['Ambulance', 'Pickup Truck', 'SUV', 'Van', 'Motorcycle'],
  'IT Equipment': ['Desktop Computer', 'Laptop', 'Printer', 'Server', 'Network Router'],
  'Generators': ['5KVA Generator', '10KVA Generator', '15KVA Generator', '20KVA Generator'],
  'Office Equipment': ['Office Desk', 'Filing Cabinet', 'Conference Table', 'Air Conditioner', 'Projector'],
  'Communication Equipment': ['Two-Way Radio', 'Satellite Phone', 'Mobile Phone', 'Walkie-Talkie']
};

const statuses = ['operational', 'maintenance', 'retired'];
const manufacturers = ['Toyota', 'HP', 'Dell', 'Mikano', 'Samsung', 'Motorola', 'Medtronic', 'Philips'];

console.log('\nInserting assets...');
const assets = [];
let assetCount = 0;

for (let i = 0; i < siteIds.length; i++) {
  const siteId = siteIds[i];
  const assetsPerSite = 5 + Math.floor(Math.random() * 3); // 5-7 assets per site
  
  for (let j = 0; j < assetsPerSite; j++) {
    const category = assetCategories[Math.floor(Math.random() * assetCategories.length)];
    const types = assetTypes[category];
    const type = types[Math.floor(Math.random() * types.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
    
    const purchaseDate = new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), 1);
    const purchaseCost = 50000 + Math.floor(Math.random() * 950000); // 50k - 1M
    const currentValue = purchaseCost * (0.5 + Math.random() * 0.4); // 50-90% of purchase cost
    
    const warrantyMonths = [12, 24, 36, 48][Math.floor(Math.random() * 4)];
    const warrantyExpiry = new Date(purchaseDate);
    warrantyExpiry.setMonth(warrantyExpiry.getMonth() + warrantyMonths);
    
    const asset = {
      name: `${type} - ${String(assetCount + 1).padStart(3, '0')}`,
      assetTag: `NRCS-${category.substring(0, 3).toUpperCase()}-${String(assetCount + 1).padStart(4, '0')}`,
      categoryId: categoryIds[category],
      status,
      siteId,
      manufacturer,
      model: `${manufacturer}-${Math.floor(Math.random() * 9000) + 1000}`,
      serialNumber: `SN${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      acquisitionDate: purchaseDate,
      acquisitionCost: purchaseCost,
      currentValue,
      warrantyExpiry,
      description: `${type} for ${sites[i].name}`,
      barcode: `BC${Math.random().toString(36).substring(2, 14).toUpperCase()}`
    };
    
    const [result] = await db.insert(schema.assets).values(asset);
    assets.push({ id: result.insertId, ...asset });
    assetCount++;
  }
}
console.log(`✓ Created ${assetCount} assets`);

// Sample Work Orders
const workOrderStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const workOrderTypes = ['corrective', 'preventive', 'inspection', 'emergency'];

console.log('\nInserting work orders...');
for (let i = 0; i < 25; i++) {
  const asset = assets[Math.floor(Math.random() * assets.length)];
  const status = workOrderStatuses[Math.floor(Math.random() * workOrderStatuses.length)];
  const priority = priorities[Math.floor(Math.random() * priorities.length)];
  const type = workOrderTypes[Math.floor(Math.random() * workOrderTypes.length)];
  
  const createdDate = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  const dueDate = new Date(createdDate);
  dueDate.setDate(dueDate.getDate() + 7 + Math.floor(Math.random() * 14)); // 7-21 days
  
  const workOrder = {
    workOrderNumber: `WO-${String(i + 1).padStart(5, '0')}`,
    title: `${type} - ${asset.name}`,
    description: `${type} required for ${asset.name} at ${sites.find(s => s.name)?.name || 'site'}`,
    assetId: asset.id,
    siteId: asset.siteId,
    status,
    priority,
    type,
    requestedBy: 1, // Default to first user
    createdAt: createdDate,
    scheduledStart: dueDate,
    estimatedCost: 5000 + Math.floor(Math.random() * 45000)
  };
  
  if (status === 'completed') {
    workOrder.completedAt = new Date(dueDate);
    workOrder.completedAt.setDate(workOrder.completedAt.getDate() - Math.floor(Math.random() * 3));
    workOrder.actualCost = workOrder.estimatedCost * (0.8 + Math.random() * 0.4);
  }
  
  await db.insert(schema.workOrders).values(workOrder);
}
console.log('✓ Created 25 work orders');

// Sample Financial Transactions
console.log('\nInserting financial transactions...');
const transactionTypes = ['expense', 'income'];
for (let i = 0; i < 30; i++) {
  const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
  const amount = 10000 + Math.floor(Math.random() * 490000);
  const date = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  
  await db.insert(schema.financialTransactions).values({
    type,
    amount,
    category: type === 'expense' ? 'Maintenance' : 'Donation',
    description: type === 'expense' ? 'Equipment maintenance and repairs' : 'Donor contribution',
    date,
    vendorId: type === 'expense' ? vendorIds[Math.floor(Math.random() * vendorIds.length)] : null,
    assetId: type === 'expense' ? assets[Math.floor(Math.random() * assets.length)].id : null
  });
}
console.log('✓ Created 30 financial transactions');

console.log('\n✅ Sample data population completed successfully!');
console.log(`\nSummary:`);
console.log(`- Asset Categories: ${assetCategoryData.length}`);
console.log(`- Sites: ${sites.length}`);
console.log(`- Vendors: ${vendors.length}`);
console.log(`- Assets: ${assetCount}`);
console.log(`- Work Orders: 25`);
console.log(`- Financial Transactions: 30`);

await connection.end();
process.exit(0);
