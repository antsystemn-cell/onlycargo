/**
 * Cargo Price Calculation Logic
 * 
 * RULE: Final price = MAX(volumePrice, weightPrice)
 * NOT the sum of both prices.
 * 
 * TIERED PRICING:
 * - Weight: If > weightThreshold (default 1000kg), use discounted tier rate
 * - Volume: If > volumeThreshold (default 10m³), use discounted tier rate
 */

export interface TieredPricingConfig {
  weightThreshold: number;      // kg threshold for tier pricing (default: 1000)
  weightTierPrice: number;      // price per kg when above threshold (default: 830)
  volumeThreshold: number;      // m³ threshold for tier pricing (default: 10)
  volumeTierPrice: number;      // price per m³ when above threshold (default: 260000)
}

export const DEFAULT_TIER_CONFIG: TieredPricingConfig = {
  weightThreshold: 1000,
  weightTierPrice: 830,
  volumeThreshold: 10,
  volumeTierPrice: 260000,
};

export interface PriceCalculationInput {
  weight: number | null;
  length: number | null;  // in cm
  width: number | null;   // in cm
  height: number | null;  // in cm
  weightRate: number;     // price per kg (normal rate)
  volumeRate: number;     // price per cubic meter (normal rate)
  tierConfig?: TieredPricingConfig;  // optional tier configuration
}

export interface PriceCalculationResult {
  weightPrice: number;
  volumePrice: number;
  finalPrice: number;
  cubicMeters: number;
  usedMethod: 'weight' | 'volume';
  usedTierPricing: boolean;
  tierInfo?: {
    weightUsedTier: boolean;
    volumeUsedTier: boolean;
    effectiveWeightRate: number;
    effectiveVolumeRate: number;
  };
}

/**
 * Calculate cargo price using the MAX(volume, weight) rule with tiered pricing support
 */
export function calculateCargoPrice(input: PriceCalculationInput): PriceCalculationResult {
  const { weight, length, width, height, weightRate, volumeRate, tierConfig } = input;
  const config = tierConfig || DEFAULT_TIER_CONFIG;

  // Calculate cubic meters (convert cm³ to m³)
  const cubicMeters = ((length || 0) * (width || 0) * (height || 0)) / 1000000;
  const actualWeight = weight || 0;

  // Determine effective rates based on tier thresholds
  const weightUsedTier = actualWeight > config.weightThreshold;
  const volumeUsedTier = cubicMeters > config.volumeThreshold;

  const effectiveWeightRate = weightUsedTier ? config.weightTierPrice : weightRate;
  const effectiveVolumeRate = volumeUsedTier ? config.volumeTierPrice : volumeRate;

  // Calculate individual prices with tiered rates
  const weightPrice = actualWeight * effectiveWeightRate;
  const volumePrice = cubicMeters * effectiveVolumeRate;

  // Use MAX of the two, not SUM
  const finalPrice = Math.max(weightPrice, volumePrice);
  const usedMethod = volumePrice > weightPrice ? 'volume' : 'weight';
  const usedTierPricing = (usedMethod === 'weight' && weightUsedTier) || 
                          (usedMethod === 'volume' && volumeUsedTier);

  return {
    weightPrice: Math.round(weightPrice),
    volumePrice: Math.round(volumePrice),
    finalPrice: Math.round(finalPrice),
    cubicMeters: Math.round(cubicMeters * 10000) / 10000,
    usedMethod,
    usedTierPricing,
    tierInfo: {
      weightUsedTier,
      volumeUsedTier,
      effectiveWeightRate,
      effectiveVolumeRate,
    },
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
 * Calculate charged weight (max of actual and volumetric) with tiered pricing
 */
export function calculateChargedWeight(
  actualWeight: number,
  length: number,
  width: number,
  height: number,
  tierConfig?: TieredPricingConfig
): { 
  chargedWeight: number; 
  volumetricWeight: number;
  usedTierPricing: boolean;
  tierApplied: 'weight' | 'volume' | null;
} {
  const config = tierConfig || DEFAULT_TIER_CONFIG;
  const volumetricWeight = calculateVolumetricWeight(length, width, height);
  const chargedWeight = Math.max(actualWeight, volumetricWeight);
  
  // Determine if tier pricing applies
  const usesVolumetric = volumetricWeight > actualWeight;
  const cubicMeters = (length * width * height) / 1000000;
  
  let usedTierPricing = false;
  let tierApplied: 'weight' | 'volume' | null = null;
  
  if (usesVolumetric && cubicMeters > config.volumeThreshold) {
    usedTierPricing = true;
    tierApplied = 'volume';
  } else if (!usesVolumetric && actualWeight > config.weightThreshold) {
    usedTierPricing = true;
    tierApplied = 'weight';
  }

  return {
    chargedWeight: Math.ceil(chargedWeight),
    volumetricWeight: Math.round(volumetricWeight * 100) / 100,
    usedTierPricing,
    tierApplied,
  };
}

/**
 * Calculate price with tiered logic for calculator page
 * Uses charged weight (max of actual vs volumetric) with tier discounts
 */
export function calculateTieredPrice(
  actualWeight: number,
  length: number,
  width: number,
  height: number,
  normalRate: number,
  tierConfig?: TieredPricingConfig
): {
  chargedWeight: number;
  volumetricWeight: number;
  price: number;
  usedMethod: 'weight' | 'volumetric';
  usedTierPricing: boolean;
  effectiveRate: number;
} {
  const config = tierConfig || DEFAULT_TIER_CONFIG;
  const volumetricWeight = calculateVolumetricWeight(length, width, height);
  const chargedWeight = Math.max(actualWeight, volumetricWeight);
  const usedMethod = volumetricWeight > actualWeight ? 'volumetric' : 'weight';
  
  // Check if tier pricing applies
  const usedTierPricing = chargedWeight > config.weightThreshold;
  const effectiveRate = usedTierPricing ? config.weightTierPrice : normalRate;
  
  const price = chargedWeight * effectiveRate;

  return {
    chargedWeight: Math.ceil(chargedWeight),
    volumetricWeight: Math.round(volumetricWeight * 100) / 100,
    price: Math.round(price),
    usedMethod,
    usedTierPricing,
    effectiveRate,
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
