# NRCS Enterprise Asset Management System
## Bulk Import Guide

**Version 1.0** | Nigerian Red Cross Society

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Bulk Import Overview](#bulk-import-overview)
4. [Importing Sites](#importing-sites)
5. [Importing Asset Categories](#importing-asset-categories)
6. [Importing Assets](#importing-assets)
7. [Importing Vendors](#importing-vendors)
8. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
9. [Best Practices](#best-practices)

---

## Introduction

The NRCS EAM System provides bulk import functionality to help you quickly populate your asset management database with existing data. This guide walks you through the process of importing sites, asset categories, assets, and vendors using Excel spreadsheets.

**Benefits of Bulk Import:**
- Save time by uploading hundreds of records at once
- Reduce data entry errors with template-based imports
- Maintain data consistency across your organization
- Migrate existing data from other systems easily

---

## Prerequisites

Before starting the bulk import process, ensure you have:

1. **Admin Access** - Only administrators can perform bulk imports
2. **Microsoft Excel** or compatible spreadsheet software (Google Sheets, LibreOffice Calc)
3. **Clean Data** - Organized and validated data ready for import
4. **Internet Connection** - Required for uploading files to the system

---

## Bulk Import Overview

The bulk import process follows these general steps:

1. **Download Template** - Get the Excel template for the data type you want to import
2. **Fill Template** - Enter your data following the template format
3. **Validate Data** - Check for errors, duplicates, and missing required fields
4. **Upload File** - Import the completed Excel file into the system
5. **Review Results** - Check the import summary for any errors or warnings

**Recommended Import Order:**
1. Sites (locations must exist before assigning assets)
2. Asset Categories (categories must exist before creating assets)
3. Vendors (optional, can be done anytime)
4. Assets (requires sites and categories to be imported first)

---

## Importing Sites

Sites represent physical locations where assets are deployed (headquarters, branches, warehouses, etc.).

### Step 1: Download Site Template

1. Navigate to **Sites** page from the sidebar menu
2. Click the **Download Template** button
3. Save the Excel file to your computer

### Step 2: Fill Site Template

The site template contains the following columns:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **name** | Yes | Site name | NRCS Headquarters |
| **address** | Yes | Street address | 11 Eko Akete Close, VI |
| **city** | Yes | City name | Lagos |
| **state** | Yes | State/province | Lagos |
| **country** | Yes | Country name | Nigeria |
| **contactPerson** | No | Site manager name | Dr. Abubakar Ibrahim |
| **contactPhone** | No | Phone number | +234-1-2614009 |
| **latitude** | No | GPS latitude | 6.4281 |
| **longitude** | No | GPS longitude | 3.4219 |

**Important Notes:**
- All required fields must be filled
- Site names must be unique
- GPS coordinates enable map visualization
- Phone numbers should include country code

### Step 3: Upload Site Template

1. Return to the **Sites** page
2. Click the **Import** button
3. Select your completed Excel file
4. Click **Upload** to start the import
5. Review the import summary showing successful and failed records

### Step 4: Verify Imported Sites

1. Check the Sites list to confirm all records were imported
2. Review any error messages for failed imports
3. Correct errors in the Excel file and re-import if needed
4. Verify GPS coordinates appear correctly on the Asset Map

---

## Importing Asset Categories

Asset categories help organize assets into logical groups (Medical Equipment, Vehicles, IT Equipment, etc.).

### Step 1: Navigate to Asset Categories

1. Go to **Asset Categories** page from the sidebar
2. Review existing categories (if any)
3. Plan your category structure before importing

### Step 2: Create Categories Manually

Currently, asset categories are created individually through the UI:

1. Click **Add Category** button
2. Enter category name (e.g., "Medical Equipment")
3. Enter description (e.g., "Medical and healthcare equipment")
4. Click **Save**

**Recommended Categories for NRCS:**
- Medical Equipment
- Vehicles & Ambulances
- IT Equipment
- Generators & Power Equipment
- Office Equipment & Furniture
- Communication Equipment
- Emergency Response Equipment

---

## Importing Assets

Assets are the core records in the EAM system representing equipment, vehicles, and other physical items.

### Step 1: Download Asset Template

1. Navigate to **Assets** page from the sidebar
2. Click the **Download Template** button
3. Save the Excel file to your computer

### Step 2: Fill Asset Template

The asset template contains the following columns:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **assetTag** | Yes | Unique identifier | NRCS-MED-0001 |
| **name** | Yes | Asset name | Blood Pressure Monitor |
| **description** | No | Detailed description | Digital BP monitor for clinic |
| **categoryId** | Yes | Category ID number | 1 |
| **siteId** | Yes | Site ID number | 1 |
| **status** | Yes | operational/maintenance/retired | operational |
| **manufacturer** | No | Manufacturer name | Omron |
| **model** | No | Model number | HEM-7120 |
| **serialNumber** | No | Serial number | SN123456789 |
| **acquisitionDate** | No | Purchase date | 2024-01-15 |
| **acquisitionCost** | No | Purchase price | 45000 |
| **currentValue** | No | Current value | 40000 |
| **warrantyExpiry** | No | Warranty end date | 2026-01-15 |
| **barcode** | No | Barcode value | BC001 |
| **latitude** | No | GPS latitude | 6.4281 |
| **longitude** | No | GPS longitude | 3.4219 |

**Important Notes:**
- **assetTag** must be unique across all assets
- **categoryId** and **siteId** must reference existing records (check IDs in the system first)
- **status** must be one of: operational, maintenance, retired
- Dates should be in YYYY-MM-DD format
- Costs should be numeric values without currency symbols
- GPS coordinates enable asset tracking on the map

### Step 3: Get Category and Site IDs

Before filling the template, you need to know the ID numbers for categories and sites:

**To find Category IDs:**
1. Go to **Asset Categories** page
2. Note the ID number for each category you'll use
3. Use these IDs in the categoryId column

**To find Site IDs:**
1. Go to **Sites** page
2. Note the ID number for each site
3. Use these IDs in the siteId column

### Step 4: Upload Asset Template

1. Return to the **Assets** page
2. Click the **Import** button
3. Select your completed Excel file
4. Click **Upload** to start the import
5. Review the import summary

### Step 5: Verify Imported Assets

1. Check the Assets list to confirm all records were imported
2. Click on individual assets to verify details
3. Check the **Asset Map** to see assets with GPS coordinates
4. Generate QR codes for assets that need physical labels

---

## Importing Vendors

Vendors are suppliers and service providers for your organization.

### Step 1: Download Vendor Template

1. Navigate to **Vendors** page from the sidebar
2. Click the **Download Template** button (if available)
3. Save the Excel file to your computer

### Step 2: Fill Vendor Template

The vendor template typically contains:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **name** | Yes | Vendor company name | Global Medical Supplies Ltd |
| **contactPerson** | No | Primary contact | John Okafor |
| **email** | No | Email address | john@globalmed.ng |
| **phone** | No | Phone number | +234-1-7654321 |
| **address** | No | Physical address | Lagos, Nigeria |
| **isActive** | No | Active status (1 or 0) | 1 |

### Step 3: Upload and Verify

Follow the same upload process as sites and assets, then verify the vendor list.

---

## Common Issues and Troubleshooting

### Issue: "Duplicate entry" error

**Cause:** Asset tag, site name, or other unique field already exists in the database

**Solution:**
- Check existing records before importing
- Ensure all asset tags are unique
- Remove or rename duplicate entries in your Excel file

### Issue: "Invalid category ID" or "Invalid site ID"

**Cause:** The categoryId or siteId in your template doesn't match an existing record

**Solution:**
- Verify category and site IDs exist in the system
- Import sites and categories before importing assets
- Double-check ID numbers in your template

### Issue: "Required field missing"

**Cause:** A required column is empty

**Solution:**
- Fill all required fields (marked with "Yes" in templates)
- Check for blank rows in your Excel file
- Ensure column headers match the template exactly

### Issue: "Invalid date format"

**Cause:** Dates are not in the correct format

**Solution:**
- Use YYYY-MM-DD format (e.g., 2024-01-15)
- Avoid regional date formats (MM/DD/YYYY or DD/MM/YYYY)
- Remove any time components from date cells

### Issue: "Invalid status value"

**Cause:** Status field contains an invalid value

**Solution:**
- Use only: operational, maintenance, or retired
- Check for typos or extra spaces
- Ensure consistent lowercase spelling

---

## Best Practices

### Data Preparation

1. **Clean Your Data First**
   - Remove duplicate records
   - Standardize naming conventions
   - Validate phone numbers and email addresses
   - Check for special characters that might cause issues

2. **Use Consistent Formatting**
   - Standardize date formats (YYYY-MM-DD)
   - Use consistent naming (e.g., "NRCS Headquarters" not "HQ" or "Head Office")
   - Apply uniform asset tag patterns (e.g., NRCS-CAT-0001)

3. **Start Small**
   - Test with 5-10 records first
   - Verify the import process works correctly
   - Then proceed with full dataset

### Import Strategy

1. **Follow the Recommended Order**
   - Sites first (assets need site IDs)
   - Categories second (assets need category IDs)
   - Vendors anytime
   - Assets last (requires sites and categories)

2. **Backup Before Importing**
   - Export existing data before bulk imports
   - Keep original Excel files as backups
   - Document any data transformations

3. **Validate After Each Import**
   - Check record counts match expectations
   - Spot-check random records for accuracy
   - Verify relationships (assets assigned to correct sites)

### Asset Tag Conventions

Use a consistent asset tag format:
- **NRCS-[CATEGORY]-[NUMBER]**
- Examples:
  - NRCS-MED-0001 (Medical Equipment)
  - NRCS-VEH-0001 (Vehicles)
  - NRCS-IT-0001 (IT Equipment)
  - NRCS-GEN-0001 (Generators)

Benefits:
- Easy to identify asset type at a glance
- Simplifies inventory audits
- Enables efficient barcode/QR code scanning

### GPS Coordinates

For accurate asset tracking on the map:
- Use decimal degrees format (e.g., 6.4281, 3.4219)
- Latitude range: -90 to 90
- Longitude range: -180 to 180
- Get coordinates from Google Maps or GPS devices
- Verify coordinates show correct location on Asset Map

---

## Support

For additional help with bulk imports:

1. **Check the Implementation Plan** - Review `/IMPLEMENTATION_PLAN.md` for technical details
2. **Contact System Administrator** - Your admin can help troubleshoot import issues
3. **Review Audit Logs** - Check Activity Log page for detailed error messages
4. **Test Environment** - Practice imports in a test environment first

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Nigerian Red Cross Society - Enterprise Asset Management System**
