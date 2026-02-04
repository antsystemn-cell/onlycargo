import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DeliveryZone } from '@/types/cargo';

export function useDeliveryZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchZones() {
      try {
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (error) throw error;
        setZones(data as DeliveryZone[]);
      } catch (error) {
        console.error('Failed to fetch delivery zones:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchZones();
  }, []);

  /**
   * Detect which zone a point is in based on polygon
   * Returns null if point is outside all zones
   */
  const detectZone = (lat: number, lng: number): DeliveryZone | null => {
    for (const zone of zones) {
      if (zone.polygon && isPointInPolygon(lat, lng, zone.polygon)) {
        return zone;
      }
    }
    // Default to last zone (usually outermost/cheapest) if no polygon match
    return zones[zones.length - 1] || null;
  };

  return {
    zones,
    isLoading,
    detectZone,
  };
}

interface Point {
  lat: number;
  lng: number;
}

/**
 * Ray casting algorithm to check if point is inside polygon
 * Supports both GeoJSON format and simple Point[] format
 */
function isPointInPolygon(lat: number, lng: number, polygon: any): boolean {
  // Handle simple Point[] format (array of {lat, lng})
  if (Array.isArray(polygon) && polygon.length > 0 && typeof polygon[0].lat === 'number') {
    const coords = polygon as Point[];
    let inside = false;
    
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i].lng, yi = coords[i].lat;
      const xj = coords[j].lng, yj = coords[j].lat;
      
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }
  
  // Handle GeoJSON format
  if (polygon?.coordinates?.[0]) {
    const coords = polygon.coordinates[0];
    let inside = false;
    
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0], yi = coords[i][1];
      const xj = coords[j][0], yj = coords[j][1];
      
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }
  
  return false;
}
