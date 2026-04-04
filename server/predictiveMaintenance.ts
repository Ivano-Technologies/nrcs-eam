import * as db from './db';

/**
 * Predictive Maintenance System
 * Analyzes historical maintenance data to predict future failures
 * and automatically create preventive work orders
 */

export interface MaintenancePrediction {
  assetId: number;
  assetTag: string;
  assetName: string;
  predictedFailureDate: Date;
  confidence: number; // 0-100%
  reason: string;
  recommendedAction: string;
  estimatedCost: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Analyze maintenance patterns for an asset
 */
export async function analyzeAssetMaintenancePattern(assetId: number): Promise<MaintenancePrediction | null> {
  const asset = await db.getAssetById(assetId);
  if (!asset) return null;
  
  const workOrders = await db.getAssetWorkOrders(assetId);
  const completedWorkOrders = workOrders.filter(wo => wo.status === 'completed' && wo.actualEnd);
  
  if (completedWorkOrders.length < 2) {
    // Not enough data for prediction
    return null;
  }
  
  // Sort by completion date
  completedWorkOrders.sort((a, b) => {
    const dateA = new Date(a.actualEnd!).getTime();
    const dateB = new Date(b.actualEnd!).getTime();
    return dateA - dateB;
  });
  
  // Calculate average time between maintenance events
  const intervals: number[] = [];
  for (let i = 1; i < completedWorkOrders.length; i++) {
    const prevDate = new Date(completedWorkOrders[i-1]!.actualEnd!).getTime();
    const currDate = new Date(completedWorkOrders[i]!.actualEnd!).getTime();
    const daysBetween = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    intervals.push(daysBetween);
  }
  
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const stdDev = Math.sqrt(
    intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
  );
  
  // Predict next maintenance date
  const lastMaintenanceDate = new Date(completedWorkOrders[completedWorkOrders.length - 1]!.actualEnd!);
  const predictedDays = Math.max(avgInterval - stdDev, avgInterval * 0.8); // Conservative estimate
  const predictedFailureDate = new Date(lastMaintenanceDate.getTime() + predictedDays * 24 * 60 * 60 * 1000);
  
  // Calculate confidence based on consistency of intervals
  const consistency = 1 - (stdDev / avgInterval);
  const confidence = Math.min(Math.max(consistency * 100, 20), 95); // 20-95% range
  
  // Determine priority based on time until predicted failure
  const daysUntilFailure = (predictedFailureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  let priority: 'low' | 'medium' | 'high' | 'critical';
  if (daysUntilFailure < 7) priority = 'critical';
  else if (daysUntilFailure < 14) priority = 'high';
  else if (daysUntilFailure < 30) priority = 'medium';
  else priority = 'low';
  
  // Estimate cost based on historical average
  const avgCost = completedWorkOrders.reduce((sum, wo) => {
    return sum + parseFloat(wo.actualCost?.toString() || wo.estimatedCost?.toString() || '0');
  }, 0) / completedWorkOrders.length;
  
  return {
    assetId: asset.id,
    assetTag: asset.assetTag,
    assetName: asset.name,
    predictedFailureDate,
    confidence: Math.round(confidence),
    reason: `Based on ${completedWorkOrders.length} maintenance events with average interval of ${Math.round(avgInterval)} days`,
    recommendedAction: `Schedule preventive maintenance before ${predictedFailureDate.toLocaleDateString()}`,
    estimatedCost: Math.round(avgCost),
    priority,
  };
}

/**
 * Get all maintenance predictions for active assets
 */
export async function getAllMaintenancePredictions(): Promise<MaintenancePrediction[]> {
  const assets = await db.getAllAssets({ status: 'operational' });
  const predictions: MaintenancePrediction[] = [];
  
  for (const asset of assets) {
    const prediction = await analyzeAssetMaintenancePattern(asset.id);
    if (prediction) {
      predictions.push(prediction);
    }
  }
  
  // Sort by predicted failure date (soonest first)
  return predictions.sort((a, b) => 
    a.predictedFailureDate.getTime() - b.predictedFailureDate.getTime()
  );
}

/**
 * Get high-priority predictions (critical and high)
 */
export async function getHighPriorityPredictions(): Promise<MaintenancePrediction[]> {
  const allPredictions = await getAllMaintenancePredictions();
  return allPredictions.filter(p => p.priority === 'critical' || p.priority === 'high');
}

/**
 * Auto-create preventive work order from prediction
 */
export async function createPreventiveWorkOrderFromPrediction(
  prediction: MaintenancePrediction,
  userId: number
): Promise<number> {
  const asset = await db.getAssetById(prediction.assetId);
  if (!asset) throw new Error('Asset not found');
  
  // Generate work order number
  const workOrderNumber = `WO-PRED-${Date.now()}`;
  
  // Schedule for 3 days before predicted failure
  const scheduledDate = new Date(prediction.predictedFailureDate.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  const workOrder = await db.createWorkOrder({
    workOrderNumber,
    title: `Predictive Maintenance - ${asset.name}`,
    description: `Automated preventive maintenance work order created by predictive AI system.\n\n${prediction.reason}\n\nConfidence: ${prediction.confidence}%\n\nRecommended Action: ${prediction.recommendedAction}`,
    assetId: prediction.assetId,
    siteId: asset.siteId,
    type: 'preventive',
    priority: prediction.priority,
    status: 'pending',
    requestedBy: userId,
    scheduledStart: scheduledDate,
    estimatedCost: prediction.estimatedCost.toString(),
  });
  
  if (!workOrder) throw new Error('Failed to create work order');
  return workOrder.id;
}

/**
 * Batch create work orders for all high-priority predictions
 */
export async function autoCreatePreventiveWorkOrders(userId: number): Promise<number[]> {
  const highPriorityPredictions = await getHighPriorityPredictions();
  const workOrderIds: number[] = [];
  
  for (const prediction of highPriorityPredictions) {
    // Check if there's already a pending work order for this asset
    const existingWorkOrders = await db.getAssetWorkOrders(prediction.assetId);
    const hasPendingWorkOrder = existingWorkOrders.some(
      wo => wo.status === 'pending' || wo.status === 'assigned' || wo.status === 'in_progress'
    );
    
    if (!hasPendingWorkOrder) {
      const workOrderId = await createPreventiveWorkOrderFromPrediction(prediction, userId);
      workOrderIds.push(workOrderId);
    }
  }
  
  return workOrderIds;
}
