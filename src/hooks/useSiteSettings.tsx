import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SiteSetting } from '@/types/cargo';

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
}

interface SiteSettingsContextType {
  logoUrl: string;
  chinaWarehouseAddress: ChinaWarehouseAddress;
  homepageBanner: HomepageBanner;
  homepageWidgets: HomepageWidget[];
  pricing: Pricing;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const defaultSettings: SiteSettingsContextType = {
  logoUrl: '/placeholder.svg',
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
  pricing: {
    per_kg: 8000,
    per_cubic_meter: 312000,
    china_per_kg: 2500,
  },
  isLoading: true,
  refresh: async () => {},
};

const SiteSettingsContext = createContext<SiteSettingsContextType>(defaultSettings);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Omit<SiteSettingsContextType, 'refresh' | 'isLoading'>>({
    logoUrl: defaultSettings.logoUrl,
    chinaWarehouseAddress: defaultSettings.chinaWarehouseAddress,
    homepageBanner: defaultSettings.homepageBanner,
    homepageWidgets: defaultSettings.homepageWidgets,
    pricing: defaultSettings.pricing,
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
        
        setSettings({
          logoUrl: (settingsMap.get('logo_url') as string) || defaultSettings.logoUrl,
          chinaWarehouseAddress: (settingsMap.get('china_warehouse_address') as ChinaWarehouseAddress) || defaultSettings.chinaWarehouseAddress,
          homepageBanner: (settingsMap.get('homepage_banner') as HomepageBanner) || defaultSettings.homepageBanner,
          homepageWidgets: (settingsMap.get('homepage_widgets') as HomepageWidget[]) || defaultSettings.homepageWidgets,
          pricing: (settingsMap.get('pricing') as Pricing) || defaultSettings.pricing,
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
