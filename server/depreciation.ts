/**
 * Asset Depreciation Calculator
 * Supports straight-line and declining balance methods
 */

export interface DepreciationInput {
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  depreciationStartDate: Date;
  method: 'straight-line' | 'declining-balance' | 'none';
  decliningBalanceRate?: number; // Default 2 for double-declining balance
}

export interface DepreciationResult {
  method: string;
  annualDepreciation: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
  depreciationPercentage: number;
  yearsElapsed: number;
  remainingYears: number;
  schedule: DepreciationScheduleEntry[];
}

export interface DepreciationScheduleEntry {
  year: number;
  date: string;
  beginningValue: number;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  endingValue: number;
}

/**
 * Calculate straight-line depreciation
 * Formula: (Cost - Residual Value) / Useful Life
 */
export function calculateStraightLineDepreciation(input: DepreciationInput): DepreciationResult {
  const { acquisitionCost, residualValue, usefulLifeYears, depreciationStartDate } = input;
  
  const depreciableAmount = acquisitionCost - residualValue;
  const annualDepreciation = depreciableAmount / usefulLifeYears;
  
  const now = new Date();
  const startDate = new Date(depreciationStartDate);
  const yearsElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const effectiveYearsElapsed = Math.min(yearsElapsed, usefulLifeYears);
  
  const accumulatedDepreciation = annualDepreciation * effectiveYearsElapsed;
  const currentBookValue = Math.max(acquisitionCost - accumulatedDepreciation, residualValue);
  const depreciationPercentage = (accumulatedDepreciation / acquisitionCost) * 100;
  const remainingYears = Math.max(usefulLifeYears - yearsElapsed, 0);
  
  // Generate depreciation schedule
  const schedule: DepreciationScheduleEntry[] = [];
  for (let year = 1; year <= usefulLifeYears; year++) {
    const yearDate = new Date(startDate);
    yearDate.setFullYear(startDate.getFullYear() + year);
    
    const beginningValue = year === 1 
      ? acquisitionCost 
      : Math.max(acquisitionCost - (annualDepreciation * (year - 1)), residualValue);
    
    const depreciationExpense = Math.min(annualDepreciation, beginningValue - residualValue);
    const accumulated = Math.min(annualDepreciation * year, depreciableAmount);
    const endingValue = Math.max(acquisitionCost - accumulated, residualValue);
    
    schedule.push({
      year,
      date: yearDate.toISOString().split('T')[0],
      beginningValue: Math.round(beginningValue * 100) / 100,
      depreciationExpense: Math.round(depreciationExpense * 100) / 100,
      accumulatedDepreciation: Math.round(accumulated * 100) / 100,
      endingValue: Math.round(endingValue * 100) / 100,
    });
  }
  
  return {
    method: 'Straight-Line',
    annualDepreciation: Math.round(annualDepreciation * 100) / 100,
    accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
    currentBookValue: Math.round(currentBookValue * 100) / 100,
    depreciationPercentage: Math.round(depreciationPercentage * 100) / 100,
    yearsElapsed: Math.round(effectiveYearsElapsed * 100) / 100,
    remainingYears: Math.round(remainingYears * 100) / 100,
    schedule,
  };
}

/**
 * Calculate declining balance depreciation
 * Formula: Book Value × (Rate / Useful Life)
 * Default rate is 2 for double-declining balance (200%)
 */
export function calculateDecliningBalanceDepreciation(input: DepreciationInput): DepreciationResult {
  const { acquisitionCost, residualValue, usefulLifeYears, depreciationStartDate, decliningBalanceRate = 2 } = input;
  
  const rate = decliningBalanceRate / usefulLifeYears;
  const now = new Date();
  const startDate = new Date(depreciationStartDate);
  const yearsElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const effectiveYearsElapsed = Math.min(yearsElapsed, usefulLifeYears);
  
  // Generate schedule and calculate current values
  const schedule: DepreciationScheduleEntry[] = [];
  let bookValue = acquisitionCost;
  let totalAccumulated = 0;
  
  for (let year = 1; year <= usefulLifeYears; year++) {
    const yearDate = new Date(startDate);
    yearDate.setFullYear(startDate.getFullYear() + year);
    
    const beginningValue = bookValue;
    let depreciationExpense = bookValue * rate;
    
    // Don't depreciate below residual value
    if (bookValue - depreciationExpense < residualValue) {
      depreciationExpense = bookValue - residualValue;
    }
    
    totalAccumulated += depreciationExpense;
    bookValue -= depreciationExpense;
    
    schedule.push({
      year,
      date: yearDate.toISOString().split('T')[0],
      beginningValue: Math.round(beginningValue * 100) / 100,
      depreciationExpense: Math.round(depreciationExpense * 100) / 100,
      accumulatedDepreciation: Math.round(totalAccumulated * 100) / 100,
      endingValue: Math.round(bookValue * 100) / 100,
    });
  }
  
  // Calculate current values based on years elapsed
  let currentBookValue = acquisitionCost;
  let accumulatedDepreciation = 0;
  
  for (let i = 0; i < Math.floor(effectiveYearsElapsed) && i < schedule.length; i++) {
    accumulatedDepreciation = schedule[i].accumulatedDepreciation;
    currentBookValue = schedule[i].endingValue;
  }
  
  // Handle partial year
  if (effectiveYearsElapsed % 1 > 0 && Math.floor(effectiveYearsElapsed) < schedule.length) {
    const partialYear = effectiveYearsElapsed % 1;
    const nextYearDepreciation = schedule[Math.floor(effectiveYearsElapsed)].depreciationExpense;
    accumulatedDepreciation += nextYearDepreciation * partialYear;
    currentBookValue -= nextYearDepreciation * partialYear;
  }
  
  const depreciationPercentage = (accumulatedDepreciation / acquisitionCost) * 100;
  const remainingYears = Math.max(usefulLifeYears - yearsElapsed, 0);
  
  // Calculate average annual depreciation from schedule
  const totalDepreciation = schedule.reduce((sum, entry) => sum + entry.depreciationExpense, 0);
  const annualDepreciation = totalDepreciation / usefulLifeYears;
  
  return {
    method: `Declining Balance (${decliningBalanceRate}x)`,
    annualDepreciation: Math.round(annualDepreciation * 100) / 100,
    accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
    currentBookValue: Math.round(currentBookValue * 100) / 100,
    depreciationPercentage: Math.round(depreciationPercentage * 100) / 100,
    yearsElapsed: Math.round(effectiveYearsElapsed * 100) / 100,
    remainingYears: Math.round(remainingYears * 100) / 100,
    schedule,
  };
}

/**
 * Calculate depreciation based on method
 */
export function calculateDepreciation(input: DepreciationInput): DepreciationResult | null {
  if (input.method === 'none' || !input.depreciationStartDate) {
    return null;
  }
  
  if (input.method === 'straight-line') {
    return calculateStraightLineDepreciation(input);
  }
  
  if (input.method === 'declining-balance') {
    return calculateDecliningBalanceDepreciation(input);
  }
  
  return null;
}

/**
 * Estimate useful life based on asset category
 */
export function estimateUsefulLife(categoryName: string): number {
  const lifespans: Record<string, number> = {
    'vehicles': 5,
    'computers': 3,
    'furniture': 7,
    'equipment': 10,
    'machinery': 15,
    'buildings': 30,
    'medical equipment': 7,
    'office equipment': 5,
    'tools': 5,
  };
  
  const category = categoryName.toLowerCase();
  for (const [key, years] of Object.entries(lifespans)) {
    if (category.includes(key)) {
      return years;
    }
  }
  
  return 5; // Default 5 years
}
