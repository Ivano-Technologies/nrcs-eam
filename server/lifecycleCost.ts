import * as db from './db';

/**
 * Calculate Total Cost of Ownership (TCO) for an asset
 * TCO = Purchase Cost + Maintenance Costs + Downtime Costs + Disposal Costs
 */
export interface LifecycleCostAnalysis {
  assetId: number;
  assetTag: string;
  assetName: string;
  purchaseCost: number;
  maintenanceCosts: number;
  downtimeCosts: number;
  disposalCosts: number;
  totalCostOfOwnership: number;
  ageInDays: number;
  costPerDay: number;
  maintenanceCount: number;
  downtimeHours: number;
}

/**
 * Calculate lifecycle costs for a single asset
 */
export async function calculateAssetLifecycleCost(assetId: number): Promise<LifecycleCostAnalysis | null> {
  const asset = await db.getAssetById(assetId);
  if (!asset) return null;
  
  // Purchase cost
  const purchaseCost = parseFloat(asset.acquisitionCost?.toString() || '0');
  
  // Maintenance costs from work orders
  const workOrders = await db.getAssetWorkOrders(assetId);
  const maintenanceCosts = workOrders.reduce((sum: number, wo: any) => {
    return sum + parseFloat(wo.actualCost?.toString() || wo.estimatedCost?.toString() || '0');
  }, 0);
  
  // Downtime costs (estimated at $100/hour for operational assets)
  const downtimeHours = workOrders.reduce((sum: number, wo: any) => {
    if (wo.actualStart && wo.actualEnd) {
      const hours = (new Date(wo.actualEnd).getTime() - new Date(wo.actualStart).getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }
    return sum;
  }, 0);
  const downtimeCosts = downtimeHours * 100; // $100/hour downtime cost
  
  // Disposal costs (estimated at 5% of purchase cost for retired assets)
  const disposalCosts = asset.status === 'disposed' || asset.status === 'retired' 
    ? purchaseCost * 0.05 
    : 0;
  
  // Total Cost of Ownership
  const totalCostOfOwnership = purchaseCost + maintenanceCosts + downtimeCosts + disposalCosts;
  
  // Age calculation
  const ageInDays = asset.acquisitionDate 
    ? Math.floor((Date.now() - new Date(asset.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Cost per day
  const costPerDay = ageInDays > 0 ? totalCostOfOwnership / ageInDays : totalCostOfOwnership;
  
  return {
    assetId: asset.id,
    assetTag: asset.assetTag,
    assetName: asset.name,
    purchaseCost,
    maintenanceCosts,
    downtimeCosts,
    disposalCosts,
    totalCostOfOwnership,
    ageInDays,
    costPerDay,
    maintenanceCount: workOrders.length,
    downtimeHours,
  };
}

/**
 * Calculate lifecycle costs for all assets in a category
 */
export async function calculateCategoryLifecycleCosts(categoryId: number): Promise<LifecycleCostAnalysis[]> {
  const assets = await db.getAllAssets({ categoryId });
  const analyses: LifecycleCostAnalysis[] = [];
  
  for (const asset of assets) {
    const analysis = await calculateAssetLifecycleCost(asset.id);
    if (analysis) {
      analyses.push(analysis);
    }
  }
  
  return analyses;
}

/**
 * Get lifecycle cost summary by category
 */
export interface CategoryCostSummary {
  categoryId: number;
  categoryName: string;
  assetCount: number;
  totalTCO: number;
  averageTCO: number;
  totalMaintenanceCosts: number;
  totalDowntimeCosts: number;
  averageCostPerDay: number;
}

export async function getCategoryCostSummary(): Promise<CategoryCostSummary[]> {
  const categories = await db.getAllAssetCategories();
  const summaries: CategoryCostSummary[] = [];
  
  for (const category of categories) {
    const analyses = await calculateCategoryLifecycleCosts(category.id);
    
    if (analyses.length > 0) {
      const totalTCO = analyses.reduce((sum, a) => sum + a.totalCostOfOwnership, 0);
      const totalMaintenanceCosts = analyses.reduce((sum, a) => sum + a.maintenanceCosts, 0);
      const totalDowntimeCosts = analyses.reduce((sum, a) => sum + a.downtimeCosts, 0);
      const averageCostPerDay = analyses.reduce((sum, a) => sum + a.costPerDay, 0) / analyses.length;
      
      summaries.push({
        categoryId: category.id,
        categoryName: category.name,
        assetCount: analyses.length,
        totalTCO,
        averageTCO: totalTCO / analyses.length,
        totalMaintenanceCosts,
        totalDowntimeCosts,
        averageCostPerDay,
      });
    }
  }
  
  // Sort by total TCO descending
  return summaries.sort((a, b) => b.totalTCO - a.totalTCO);
}

/**
 * Get cost optimization recommendations
 */
export interface CostOptimizationRecommendation {
  assetId: number;
  assetTag: string;
  assetName: string;
  issue: string;
  recommendation: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

export async function getCostOptimizationRecommendations(): Promise<CostOptimizationRecommendation[]> {
  const assets = await db.getAllAssets();
  const recommendations: CostOptimizationRecommendation[] = [];
  
  for (const asset of assets) {
    const analysis = await calculateAssetLifecycleCost(asset.id);
    if (!analysis) continue;
    
    // High maintenance cost assets
    if (analysis.maintenanceCosts > analysis.purchaseCost * 0.5) {
      recommendations.push({
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        issue: `Maintenance costs (${analysis.maintenanceCosts.toFixed(2)}) exceed 50% of purchase cost`,
        recommendation: 'Consider replacing this asset with a newer model to reduce ongoing maintenance expenses',
        potentialSavings: analysis.maintenanceCosts * 0.3, // Estimated 30% savings
        priority: 'high',
      });
    }
    
    // High downtime assets
    if (analysis.downtimeHours > 100) {
      recommendations.push({
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        issue: `Excessive downtime (${analysis.downtimeHours.toFixed(1)} hours)`,
        recommendation: 'Implement predictive maintenance or consider backup equipment to minimize operational disruption',
        potentialSavings: analysis.downtimeCosts * 0.4, // Estimated 40% reduction in downtime
        priority: 'high',
      });
    }
    
    // Old assets with high cost per day
    if (analysis.ageInDays > 1825 && analysis.costPerDay > 50) { // 5+ years old
      recommendations.push({
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        issue: `Asset is ${Math.floor(analysis.ageInDays / 365)} years old with high daily cost (${analysis.costPerDay.toFixed(2)}/day)`,
        recommendation: 'Evaluate replacement with modern equipment that may have better efficiency and lower operating costs',
        potentialSavings: analysis.costPerDay * 365 * 0.25, // Estimated 25% annual savings
        priority: 'medium',
      });
    }
  }
  
  // Sort by potential savings descending
  return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
}
