import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SiteSetting } from '@/types/cargo';
import { DEFAULT_TIER_CONFIG, type TieredPricingConfig } from '@/lib/priceCalculation';

export interface ChinaWarehouseAddress {
  id: string;
  label: string;
  receiver: string;
  phone: string;
  region: string;
  address: string;
  prefix: string;
}

export type KoreaWarehouseAddress = ChinaWarehouseAddress;

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
  tier_weight_threshold: number;
  tier_weight_price: number;
  tier_volume_threshold: number;
  tier_volume_price: number;
}

interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
  og_image?: string;
}

type SeoSettingsMap = Record<string, PageSeo>;

export interface PaymentIconConfig {
  qpay_icon_url?: string;
  omniway_icon_url?: string;
  storepay_icon_url?: string;
}

interface SiteSettingsContextType {
  logoUrl: string;
  faviconUrl: string;
  chinaWarehouseAddresses: ChinaWarehouseAddress[];
  koreaWarehouseAddresses: KoreaWarehouseAddress[];
  homepageBanner: HomepageBanner;
  homepageWidgets: HomepageWidget[];
  pricing: Pricing;
  tierConfig: TieredPricingConfig;
  paymentIcons: PaymentIconConfig;
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

const defaultChinaAddresses: ChinaWarehouseAddress[] = [
  {
    id: 'default-1',
    label: 'Эрээн',
    receiver: '唯一OnlyCargo',
    phone: '13694788211',
    region: '内蒙古，锡林郭勒盟，二连浩特市, 肯特街',
    address: '白音布日特物流巴图收',
    prefix: 'ONLY',
  },
];

const defaultKoreaAddresses: KoreaWarehouseAddress[] = [
  {
    id: 'korea-default-1',
    label: 'Инчон агуулах',
    receiver: 'OnlyCargo Korea',
    phone: '010-5375-2204',
    region: '인천광역시 서구 (Incheon Seo-gu)',
    address: '원당대로205번길 32-8',
    prefix: 'ONLY',
  },
];

const defaultSettings: SiteSettingsContextType = {
  logoUrl: '/placeholder.svg',
  faviconUrl: '/favicon.ico',
  chinaWarehouseAddresses: defaultChinaAddresses,
  koreaWarehouseAddresses: defaultKoreaAddresses,
  homepageBanner: {
    enabled: true,
    title: 'Онлайн карго үйлчилгээ',
    description: 'Хятадаас Монгол руу хурдан, найдвартай тээвэр',
  },
  homepageWidgets: [
    { id: 'calculator', title: 'Тооцоолуур', icon: 'calculator', enabled: true },
    { id: 'tracking', title: 'Ачаа хайх', icon: 'search', enabled: true },
    { id: 'address', title: 'Хятад хаяг', icon: 'map-pin', enabled: true },
    { id: 'korea-address', title: 'Солонгос хаяг', icon: 'map-pin', enabled: true },
  ],
  pricing: defaultPricing,
  tierConfig: DEFAULT_TIER_CONFIG,
  paymentIcons: {},
  seoSettings: {},
  isLoading: true,
  refresh: async () => {},
};

const SiteSettingsContext = createContext<SiteSettingsContextType>(defaultSettings);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Omit<SiteSettingsContextType, 'refresh' | 'isLoading'>>({
    logoUrl: defaultSettings.logoUrl,
    faviconUrl: defaultSettings.faviconUrl,
    chinaWarehouseAddresses: defaultSettings.chinaWarehouseAddresses,
    koreaWarehouseAddresses: defaultSettings.koreaWarehouseAddresses,
    homepageBanner: defaultSettings.homepageBanner,
    homepageWidgets: defaultSettings.homepageWidgets,
    pricing: defaultSettings.pricing,
    tierConfig: defaultSettings.tierConfig,
    paymentIcons: defaultSettings.paymentIcons,
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
        
        const mergedPricing: Pricing = {
          per_kg: pricingData.per_kg ?? defaultPricing.per_kg,
          per_cubic_meter: pricingData.per_cubic_meter ?? defaultPricing.per_cubic_meter,
          china_per_kg: pricingData.china_per_kg ?? defaultPricing.china_per_kg,
          tier_weight_threshold: pricingData.tier_weight_threshold ?? defaultPricing.tier_weight_threshold,
          tier_weight_price: pricingData.tier_weight_price ?? defaultPricing.tier_weight_price,
          tier_volume_threshold: pricingData.tier_volume_threshold ?? defaultPricing.tier_volume_threshold,
          tier_volume_price: pricingData.tier_volume_price ?? defaultPricing.tier_volume_price,
        };

        const tierConfig: TieredPricingConfig = {
          weightThreshold: mergedPricing.tier_weight_threshold,
          weightTierPrice: mergedPricing.tier_weight_price,
          volumeThreshold: mergedPricing.tier_volume_threshold,
          volumeTierPrice: mergedPricing.tier_volume_price,
        };

        // Support both old single address format and new array format
        const rawAddresses = settingsMap.get('china_warehouse_addresses');
        let chinaWarehouseAddresses: ChinaWarehouseAddress[] = defaultChinaAddresses;
        if (Array.isArray(rawAddresses) && rawAddresses.length > 0) {
          chinaWarehouseAddresses = rawAddresses as ChinaWarehouseAddress[];
        }

        const rawKoreaAddresses = settingsMap.get('korea_warehouse_addresses');
        let koreaWarehouseAddresses: KoreaWarehouseAddress[] = defaultKoreaAddresses;
        if (Array.isArray(rawKoreaAddresses) && rawKoreaAddresses.length > 0) {
          koreaWarehouseAddresses = rawKoreaAddresses as KoreaWarehouseAddress[];
        }
        
        setSettings({
          logoUrl: (settingsMap.get('logo_url') as string) || defaultSettings.logoUrl,
          faviconUrl: (settingsMap.get('favicon_url') as string) || defaultSettings.faviconUrl,
          chinaWarehouseAddresses,
          koreaWarehouseAddresses,
          homepageBanner: (settingsMap.get('homepage_banner') as HomepageBanner) || defaultSettings.homepageBanner,
          homepageWidgets: (settingsMap.get('homepage_widgets') as HomepageWidget[]) || defaultSettings.homepageWidgets,
          pricing: mergedPricing,
          tierConfig,
          paymentIcons: (settingsMap.get('payment_icons') as PaymentIconConfig) || defaultSettings.paymentIcons,
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
