# NRCS EAM System - Inactive Features Audit

**Date:** January 21, 2026
**Version:** e37aa9ab

## Executive Summary

This audit identifies all inactive, placeholder, or "coming soon" features in the NRCS EAM system that need implementation.

---

## 🔴 Critical Inactive Features (High Priority)

### 1. **Maintenance Schedule Management**
- **Location:** `/maintenance` page
- **Issue:** "Add Schedule" button shows "Feature coming soon" toast
- **Impact:** Users cannot create maintenance schedules
- **Backend Status:** Backend procedures exist (`maintenance.create`)
- **Fix Required:** Connect frontend form to backend mutation

### 2. **Inventory Item Management**
- **Location:** `/inventory` page
- **Issue:** "Add Item" button shows "Feature coming soon" toast
- **Impact:** Users cannot add inventory items
- **Backend Status:** Backend procedures exist (`inventory.create`)
- **Fix Required:** Create add item dialog and connect to backend

### 3. **Vendor Management**
- **Location:** `/vendors` page
- **Issue:** "Add Vendor" button shows "Feature coming soon" toast
- **Impact:** Users cannot add new vendors
- **Backend Status:** Backend procedures exist (`vendors.create`)
- **Fix Required:** Create add vendor dialog and connect to backend

### 4. **Compliance Record Management**
- **Location:** `/compliance` page
- **Issue:** "Add Record" button shows "Feature coming soon" toast
- **Impact:** Users cannot create compliance records
- **Backend Status:** Backend procedures exist (`compliance.create`)
- **Fix Required:** Create add compliance record dialog and connect to backend

### 5. **Camera Scanning Features**
- **Location:** `/scanner` and `/mobile-work-orders` pages
- **Issue:** Camera scan buttons show "coming soon" messages
- **Impact:** Users cannot use QR/barcode scanning
- **Backend Status:** Backend ready
- **Fix Required:** Implement camera access and QR code scanning library integration

---

## 🟡 Medium Priority Inactive Features

### 6. **Mobile Work Order Photo Capture**
- **Location:** `/mobile-work-order/:id` detail page
- **Issue:** "Take Photo" button shows "Camera feature coming soon"
- **Impact:** Field technicians cannot attach photos during work
- **Backend Status:** Photo upload API exists
- **Fix Required:** Implement camera access for mobile devices

### 7. **QuickBooks Integration**
- **Location:** `/quickbooks` settings page
- **Issue:** Form exists but integration not functional
- **Impact:** Financial data must be manually synced
- **Backend Status:** Settings storage exists, API integration incomplete
- **Fix Required:** Implement QuickBooks OAuth and API sync

---

## 🟢 Low Priority / Enhancement Features

### 8. **PWA Installation**
- **Location:** Sidebar footer
- **Issue:** Install button appears but PWA manifest may need optimization
- **Impact:** Users can't install as native app
- **Fix Required:** Verify PWA manifest and service worker configuration

---

## ✅ Fully Functional Features (Verified)

- ✅ Asset Management (CRUD operations)
- ✅ Work Order Management
- ✅ Site Management with inline editing
- ✅ User Management with admin controls
- ✅ Financial Transaction tracking with inline editing
- ✅ Photo Upload (bulk with captions)
- ✅ Reports Generation (PDF/Excel)
- ✅ Email Notifications
- ✅ Dashboard Analytics
- ✅ Asset Map (Google Maps integration)
- ✅ Audit Trail
- ✅ Activity Log
- ✅ Legal Pages (Terms & Privacy)

---

## Recommended Fix Order

### Phase 1: Core Operations (Critical)
1. Maintenance Schedule Add functionality
2. Inventory Item Add functionality
3. Vendor Add functionality
4. Compliance Record Add functionality

### Phase 2: Mobile Enhancement (Medium)
5. Camera scanning for Asset Scanner
6. Mobile photo capture for work orders

### Phase 3: Integration (Medium)
7. QuickBooks integration completion

### Phase 4: Enhancement (Low)
8. PWA optimization

---

## Implementation Estimates

- **Phase 1 (Critical):** 4-6 hours
- **Phase 2 (Mobile):** 3-4 hours
- **Phase 3 (Integration):** 6-8 hours (requires QuickBooks credentials)
- **Phase 4 (PWA):** 1-2 hours

**Total Estimated Time:** 14-20 hours

---

## Notes

- All backend procedures are already implemented
- Most fixes involve creating frontend dialogs and connecting to existing APIs
- Camera features require browser permissions and library integration
- QuickBooks integration requires valid API credentials from the user
