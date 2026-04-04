/**
 * Dashboard Customization System
 * Allows users to personalize their dashboard widgets and layout
 */

export interface DashboardWidget {
  id: string;
  type: 'metrics' | 'chart' | 'list' | 'calendar';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: any;
  visible: boolean;
}

export interface DashboardLayout {
  userId: number;
  widgets: DashboardWidget[];
  theme: 'light' | 'dark';
  defaultView: string;
}

// Default dashboard widgets
export const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'total-assets',
    type: 'metrics',
    title: 'Total Assets',
    position: { x: 0, y: 0, w: 3, h: 2 },
    config: { metric: 'totalAssets' },
    visible: true,
  },
  {
    id: 'pending-work-orders',
    type: 'metrics',
    title: 'Pending Work Orders',
    position: { x: 3, y: 0, w: 3, h: 2 },
    config: { metric: 'pendingWorkOrders' },
    visible: true,
  },
  {
    id: 'upcoming-maintenance',
    type: 'list',
    title: 'Upcoming Maintenance',
    position: { x: 0, y: 2, w: 6, h: 4 },
    config: { limit: 5 },
    visible: true,
  },
  {
    id: 'asset-status-chart',
    type: 'chart',
    title: 'Asset Status Distribution',
    position: { x: 6, y: 0, w: 6, h: 4 },
    config: { chartType: 'pie' },
    visible: true,
  },
];

/**
 * Get user's dashboard layout or return default
 */
export function getUserDashboardLayout(userId: number): DashboardLayout {
  // In a real implementation, this would fetch from database
  // For now, return default layout
  return {
    userId,
    widgets: DEFAULT_WIDGETS,
    theme: 'light',
    defaultView: 'dashboard',
  };
}

/**
 * Save user's dashboard customization
 */
export function saveDashboardLayout(userId: number, layout: Partial<DashboardLayout>): boolean {
  // In a real implementation, this would save to database
  // For now, return success
  return true;
}

/**
 * Reset dashboard to default layout
 */
export function resetDashboardLayout(userId: number): DashboardLayout {
  return {
    userId,
    widgets: DEFAULT_WIDGETS,
    theme: 'light',
    defaultView: 'dashboard',
  };
}
