import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SiteSetting } from '@/types/cargo';
import { DEFAULT_TIER_CONFIG, type TieredPricingConfig } from '@/lib/priceCalculation';

interface ChinaWarehouseAddress {
  receiver: string;
  phone: string;
  region: string;
  address: string;
}

interface HomepageBanner {
  enabled: boolean;
  title: string;
  description: string;
  imageUrl?: string;
  backgroundImage?: string;
}

interface HomepageWidget {
  id: string;
  title: string;
  icon: string;
  enabled: boolean;
}

interface Pricing {
  per_kg: number;
  per_cubic_meter: number;
  china_per_kg: number;
  // Tiered pricing configuration
  tier_weight_threshold: number;      // kg threshold (default: 1000)
  tier_weight_price: number;          // price per kg above threshold (default: 830)
  tier_volume_threshold: number;      // m³ threshold (default: 10)
  tier_volume_price: number;          // price per m³ above threshold (default: 260000)
}

interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
}

type SeoSettingsMap = Record<string, PageSeo>;

interface SiteSettingsContextType {
  logoUrl: string;
  faviconUrl: string;
  chinaWarehouseAddress: ChinaWarehouseAddress;
  homepageBanner: HomepageBanner;
  homepageWidgets: HomepageWidget[];
  pricing: Pricing;
  tierConfig: TieredPricingConfig;
  seoSettings: SeoSettingsMap;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const defaultPricing: Pricing = {
  per_kg: 8000,
  per_cubic_meter: 312000,
  china_per_kg: 2500,
  tier_weight_threshold: DEFAULT_TIER_CONFIG.weightThreshold,
  tier_weight_price: DEFAULT_TIER_CONFIG.weightTierPrice,
  tier_volume_threshold: DEFAULT_TIER_CONFIG.volumeThreshold,
  tier_volume_price: DEFAULT_TIER_CONFIG.volumeTierPrice,
};

const defaultSettings: SiteSettingsContextType = {
  logoUrl: '/placeholder.svg',
  faviconUrl: '/favicon.ico',
  chinaWarehouseAddress: {
    receiver: '唯一OnlyCargo',
    phone: '13694788211',
    region: '内蒙古，锡林郭勒盟，二连浩特市, 肯特街',
    address: '白音布日特物流巴图收',
  },
  homepageBanner: {
    enabled: true,
    title: 'Онлайн карго үйлчилгээ',
    description: 'Хятадаас Монгол руу хурдан, найдвартай тээвэр',
  },
  homepageWidgets: [
    { id: 'calculator', title: 'Тооцоолуур', icon: 'calculator', enabled: true },
    { id: 'tracking', title: 'Ачаа хайх', icon: 'search', enabled: true },
    { id: 'address', title: 'Хятад хаяг', icon: 'map-pin', enabled: true },
  ],
  pricing: defaultPricing,
  tierConfig: DEFAULT_TIER_CONFIG,
  seoSettings: {},
  isLoading: true,
  refresh: async () => {},
};

const SiteSettingsContext = createContext<SiteSettingsContextType>(defaultSettings);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Omit<SiteSettingsContextType, 'refresh' | 'isLoading'>>({
    logoUrl: defaultSettings.logoUrl,
    faviconUrl: defaultSettings.faviconUrl,
    chinaWarehouseAddress: defaultSettings.chinaWarehouseAddress,
    homepageBanner: defaultSettings.homepageBanner,
    homepageWidgets: defaultSettings.homepageWidgets,
    pricing: defaultSettings.pricing,
    tierConfig: defaultSettings.tierConfig,
    seoSettings: defaultSettings.seoSettings,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*');

      if (error) throw error;

      if (data) {
        const settingsMap = new Map(data.map((s: SiteSetting) => [s.key, s.value]));
        
        const pricingData = (settingsMap.get('pricing') as Pricing) || defaultPricing;
        
        // Merge with defaults to ensure tier fields exist
        const mergedPricing: Pricing = {
          per_kg: pricingData.per_kg ?? defaultPricing.per_kg,
          per_cubic_meter: pricingData.per_cubic_meter ?? defaultPricing.per_cubic_meter,
          china_per_kg: pricingData.china_per_kg ?? defaultPricing.china_per_kg,
          tier_weight_threshold: pricingData.tier_weight_threshold ?? defaultPricing.tier_weight_threshold,
          tier_weight_price: pricingData.tier_weight_price ?? defaultPricing.tier_weight_price,
          tier_volume_threshold: pricingData.tier_volume_threshold ?? defaultPricing.tier_volume_threshold,
          tier_volume_price: pricingData.tier_volume_price ?? defaultPricing.tier_volume_price,
        };

        // Build tier config from pricing
        const tierConfig: TieredPricingConfig = {
          weightThreshold: mergedPricing.tier_weight_threshold,
          weightTierPrice: mergedPricing.tier_weight_price,
          volumeThreshold: mergedPricing.tier_volume_threshold,
          volumeTierPrice: mergedPricing.tier_volume_price,
        };
        
        setSettings({
          logoUrl: (settingsMap.get('logo_url') as string) || defaultSettings.logoUrl,
          faviconUrl: (settingsMap.get('favicon_url') as string) || defaultSettings.faviconUrl,
          chinaWarehouseAddress: (settingsMap.get('china_warehouse_address') as ChinaWarehouseAddress) || defaultSettings.chinaWarehouseAddress,
          homepageBanner: (settingsMap.get('homepage_banner') as HomepageBanner) || defaultSettings.homepageBanner,
          homepageWidgets: (settingsMap.get('homepage_widgets') as HomepageWidget[]) || defaultSettings.homepageWidgets,
          pricing: mergedPricing,
          tierConfig,
          seoSettings: (settingsMap.get('seo_settings') as SeoSettingsMap) || defaultSettings.seoSettings,
        });
      }
    } catch (error) {
      console.error('Failed to fetch site settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ ...settings, isLoading, refresh: fetchSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  }
  return context;
}
