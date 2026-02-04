/**
 * Cargo Price Calculation Logic
 * 
 * RULE: Final price = MAX(volumePrice, weightPrice)
 * NOT the sum of both prices.
 */

export interface PriceCalculationInput {
  weight: number | null;
  length: number | null;  // in cm
  width: number | null;   // in cm
  height: number | null;  // in cm
  weightRate: number;     // price per kg
  volumeRate: number;     // price per cubic meter
}

export interface PriceCalculationResult {
  weightPrice: number;
  volumePrice: number;
  finalPrice: number;
  cubicMeters: number;
  usedMethod: 'weight' | 'volume';
}

/**
 * Calculate cargo price using the MAX(volume, weight) rule
 */
export function calculateCargoPrice(input: PriceCalculationInput): PriceCalculationResult {
  const { weight, length, width, height, weightRate, volumeRate } = input;

  // Calculate cubic meters (convert cm³ to m³)
  const cubicMeters = ((length || 0) * (width || 0) * (height || 0)) / 1000000;

  // Calculate individual prices
  const weightPrice = (weight || 0) * weightRate;
  const volumePrice = cubicMeters * volumeRate;

  // Use MAX of the two, not SUM
  const finalPrice = Math.max(weightPrice, volumePrice);
  const usedMethod = volumePrice > weightPrice ? 'volume' : 'weight';

  return {
    weightPrice: Math.round(weightPrice),
    volumePrice: Math.round(volumePrice),
    finalPrice: Math.round(finalPrice),
    cubicMeters: Math.round(cubicMeters * 10000) / 10000,
    usedMethod,
  };
}

/**
 * Calculate volumetric weight for freight calculator
 * Formula: (L × W × H) / 5000
 */
export function calculateVolumetricWeight(
  length: number,
  width: number,
  height: number
): number {
  return (length * width * height) / 5000;
}

/**
 * Calculate charged weight (max of actual and volumetric)
 */
export function calculateChargedWeight(
  actualWeight: number,
  length: number,
  width: number,
  height: number
): { chargedWeight: number; volumetricWeight: number } {
  const volumetricWeight = calculateVolumetricWeight(length, width, height);
  const chargedWeight = Math.max(actualWeight, volumetricWeight);

  return {
    chargedWeight: Math.ceil(chargedWeight),
    volumetricWeight: Math.round(volumetricWeight * 100) / 100,
  };
}

/**
 * Format price in Mongolian Tugrik
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString()}₮`;
}

/**
 * Format cubic meters with unit
 */
export function formatCubicMeters(m3: number): string {
  return `${m3.toFixed(4)} м³`;
}
