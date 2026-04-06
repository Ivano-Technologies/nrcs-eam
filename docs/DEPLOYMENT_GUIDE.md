# NRCS EAM System - Deployment Guide

## Overview

The NRCS Enterprise Asset Management (EAM) System is a comprehensive web application for managing physical assets, work orders, maintenance schedules, inventory, vendors, financial tracking, and compliance for the Nigerian Red Cross Society.

## Features

### Core Modules
1. **Dashboard** - Real-time metrics and key performance indicators
2. **Asset Management** - Track machines, buildings, vehicles, and equipment
3. **Work Orders** - Create, assign, and track maintenance work
4. **Preventive Maintenance** - Schedule recurring maintenance tasks
5. **Inventory Control** - Manage spare parts and supplies with reorder alerts
6. **Vendor Management** - Track suppliers and contractors
7. **Financial Tracking** - Monitor costs, depreciation, and expenses
8. **Compliance** - Track regulatory requirements and audits
9. **Multi-Site Management** - Manage assets across multiple locations
10. **User Management** - Role-based access control (Admin, Manager, Technician, User)

### Key Capabilities
- **Offline Support** - Read-only access when offline with automatic sync
- **Role-Based Access** - Different permissions for different user roles
- **Mobile Responsive** - Works on desktop, tablet, and mobile devices
- **Multi-Site** - Manage assets across multiple Nigerian Red Cross locations
- **Nigerian Red Cross Branding** - Integrated logo and color scheme

## System Requirements

### For Users (Accessing the Application)
- **Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Internet Connection**: Required for initial load and data sync (offline mode available after first load)
- **Screen Resolution**: Minimum 1024x768 (responsive design adapts to mobile)

### For Deployment (Hosting)
- **Platform**: Manus hosting (built-in) or any Node.js hosting provider
- **Database**: MySQL/TiDB (provided by Manus)
- **Node.js**: Version 22.x or higher
- **Storage**: Cloud storage for attachments (provided by Manus)

## Accessing the Application

### Web Access
The application is accessible via web browser at the published URL. Users can:
1. Open the URL in any modern web browser
2. Log in using Manus OAuth authentication
3. Access features based on their assigned role

### Sharing with Team Members
To share the application with team members:
1. Click the **Publish** button in the Manus interface
2. Share the published URL with team members
3. Team members click the link and log in with their Manus accounts
4. Admin can assign roles to users in the **Users** section

### Mobile Access
The application is fully responsive and works on mobile devices:
1. Open the published URL on a mobile browser
2. The interface automatically adapts to mobile screen size
3. All features are accessible on mobile devices

### Offline Access
After the first visit, the application supports offline mode:
1. Visit the application while online at least once
2. The service worker caches essential resources
3. When offline, users can view (read-only) previously loaded data
4. Changes sync automatically when connection is restored

## User Roles and Permissions

### Admin
- Full access to all modules
- Can create, edit, and delete all records
- Can manage users and assign roles
- Access to financial and compliance data

### Manager
- Can create and edit assets, work orders, and maintenance schedules
- Can view financial and compliance data
- Cannot manage users or delete critical records

### Technician
- Can view assets and work orders
- Can update work order status and add completion notes
- Limited access to financial data

### User
- Read-only access to most modules
- Can view assets, work orders, and inventory
- Cannot create or modify records

## Initial Setup

### 1. First Login (Admin)
1. Access the application URL
2. Log in with your Manus account
3. The system owner is automatically assigned Admin role

### 2. Configure Sites
1. Navigate to **Sites** in the sidebar
2. Review the pre-configured sites (Abuja HQ, Lagos, Kano)
3. Add additional sites as needed:
   - Click **Add Site**
   - Enter site name, address, and contact information
   - Click **Create Site**

### 3. Review Asset Categories
Pre-configured categories include:
- Vehicles
- Buildings
- Machinery
- Medical Equipment
- IT Equipment
- Furniture
- Communication Equipment

Add custom categories if needed.

### 4. Add Team Members
1. Share the application URL with team members
2. After they log in, go to **Users** section
3. Assign appropriate roles to each user
   - Note: Role assignment requires database access (contact admin)

### 5. Start Adding Assets
1. Navigate to **Assets**
2. Click **Add Asset**
3. Fill in asset details:
   - Asset Tag (unique identifier)
   - Name
   - Category
   - Site
   - Manufacturer, model, serial number
   - Location within site
4. Click **Create Asset**

## Daily Operations

### Creating Work Orders
1. Go to **Work Orders**
2. Click **Create Work Order**
3. Fill in details:
   - Work order number
   - Title and description
   - Select asset and site
   - Set type (Corrective, Preventive, Inspection, Emergency)
   - Set priority (Low, Medium, High, Critical)
   - Assign to technician (if admin)
4. Click **Create Work Order**

### Tracking Maintenance
1. Navigate to **Maintenance**
2. View upcoming maintenance in next 30 days
3. Review all active schedules
4. Create new maintenance schedules as needed

### Managing Inventory
1. Go to **Inventory**
2. View current stock levels
3. Monitor low stock alerts
4. Add new inventory items
5. Track inventory transactions

### Monitoring Dashboard
1. Dashboard shows real-time metrics:
   - Total assets and operational status
   - Pending and in-progress work orders
   - Low stock alerts
   - Upcoming maintenance
2. Use Quick Actions for common tasks

## Troubleshooting

### Cannot Access Application
- Check internet connection
- Verify the URL is correct
- Clear browser cache and cookies
- Try a different browser

### Offline Mode Not Working
- Ensure you visited the site while online at least once
- Check browser settings allow service workers
- Try refreshing the page while online

### Cannot See Certain Features
- Check your user role and permissions
- Contact admin to verify role assignment
- Some features are admin-only

### Data Not Syncing
- Check internet connection
- Refresh the page
- Log out and log back in
- Contact support if issue persists

## Data Management

### Backup
- All data is automatically backed up by Manus platform
- Database snapshots available through Manus interface
- Export data through Database panel if needed

### Data Export
- Use the Database panel in Manus interface
- Export tables to CSV for reporting
- Download full database backup

## Security

### Authentication
- Uses Manus OAuth for secure authentication
- No passwords stored in the application
- Session management handled by Manus platform

### Data Protection
- All data encrypted in transit (HTTPS)
- Database access restricted to authenticated users
- Role-based access control enforces permissions

### Best Practices
- Assign minimum necessary permissions to users
- Regularly review user access
- Log out when using shared devices
- Report suspicious activity to admin

## Support and Maintenance

### Getting Help
- Review this documentation first
- Check the Manus help center: https://help.manus.im
- Contact Nigerian Red Cross IT support

### Updates
- Application updates deployed through Manus platform
- No user action required for updates
- Check changelog for new features

### Reporting Issues
- Document the issue with screenshots
- Note what you were trying to do
- Report to admin or IT support
- Include browser and device information

## Appendix

### Pre-Configured Data
The system comes with:
- 3 sites (Abuja HQ, Lagos Branch, Kano Branch)
- 7 asset categories
- All necessary database tables

### Technical Details
- Built with React 19 and Node.js
- Uses MySQL/TiDB database
- Hosted on Manus platform
- Service worker for offline support

### Customization
For customization requests:
- Logo and branding updates
- Additional asset categories
- Custom reports
- Integration with other systems

Contact the development team or Manus support.
