import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polygon } from '@react-google-maps/api';
import { Locate, Info, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';
import { useIsMobile } from '@/hooks/use-mobile';

interface DeliveryMapPickerProps {
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

const UB_CENTER = { lat: 47.9184, lng: 106.9177 };

const containerStyle = { width: '100%', height: '224px' };

const zoneColors: Record<string, string> = {
  ZONE_A: '#22c55e',
  ZONE_B: '#eab308',
  ZONE_C: '#ef4444',
};

interface Point { lat: number; lng: number; }

export function DeliveryMapPicker({ onLocationSelect, selectedLocation }: DeliveryMapPickerProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const isMobile = useIsMobile();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const { zones, detectZone } = useDeliveryZones();

  const [coords, setCoords] = useState(selectedLocation || UB_CENTER);
  const [detectedZone, setDetectedZone] = useState<typeof zones[0] | null>(null);

  useEffect(() => {
    if (selectedLocation) setCoords(selectedLocation);
  }, [selectedLocation]);

  useEffect(() => {
    if (coords && zones.length > 0) {
      setDetectedZone(detectZone(coords.lat, coords.lng));
    }
  }, [coords, zones, detectZone]);

  // Desktop: click to place pin
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (isMobile) return; // Mobile uses center pin instead
    if (!e.latLng) return;
    const newCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setCoords(newCoords);
    onLocationSelect(newCoords);
  }, [onLocationSelect, isMobile]);

  // Desktop: drag pin to new location
  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const newCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setCoords(newCoords);
    onLocationSelect(newCoords);
  }, [onLocationSelect]);

  // Mobile: when map stops moving, use center as selected location
  const handleMapIdle = useCallback(() => {
    if (!isMobile || !mapRef.current) return;
    const center = mapRef.current.getCenter();
    if (!center) return;
    const newCoords = { lat: center.lat(), lng: center.lng() };
    setCoords(newCoords);
    onLocationSelect(newCoords);
  }, [isMobile, onLocationSelect]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Таны browser байршил тодорхойлохыг дэмждэггүй байна');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCoords(newCoords);
        onLocationSelect(newCoords);
        setIsLocating(false);
      },
      () => {
        alert('Байршил тодорхойлоход алдаа гарлаа');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const getPolygonPaths = (polygon: any): google.maps.LatLngLiteral[] | null => {
    if (Array.isArray(polygon) && polygon.length > 0 && typeof polygon[0].lat === 'number') {
      return polygon as Point[];
    }
    if (polygon?.coordinates?.[0]) {
      return polygon.coordinates[0].map((c: number[]) => ({ lat: c[1], lng: c[0] }));
    }
    return null;
  };

  if (!isLoaded) {
    return (
      <div className="h-56 rounded-lg border bg-muted flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Газрын зураг ачааллаж байна...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="address">Дэлгэрэнгүй хаяг</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Байр, орц, тоот..."
        />
      </div>

      <div className="rounded-lg overflow-hidden border relative">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={coords}
          zoom={13}
          onClick={handleMapClick}
          onLoad={handleMapLoad}
          onIdle={handleMapIdle}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
          }}
        >
          {/* Zone polygons */}
          {zones.map((zone) => {
            const paths = getPolygonPaths(zone.polygon);
            if (!paths || paths.length < 3) return null;
            const color = zoneColors[zone.code] || '#3b82f6';
            return (
              <Polygon
                key={zone.id}
                paths={paths}
                options={{
                  fillColor: color,
                  fillOpacity: 0.15,
                  strokeColor: color,
                  strokeWeight: 2,
                }}
              />
            );
          })}

          {/* Desktop: draggable marker */}
          {!isMobile && (
            <Marker
              position={coords}
              draggable
              onDragEnd={handleMarkerDragEnd}
            />
          )}
        </GoogleMap>

        {/* Mobile: fixed center pin */}
        {isMobile && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <MapPin className="h-8 w-8 text-destructive -mt-8 drop-shadow-lg" />
          </div>
        )}
      </div>

      {detectedZone && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-green-800">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">
            <strong>{detectedZone.name}</strong> - {detectedZone.description}
          </span>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleGetCurrentLocation}
        disabled={isLocating}
      >
        <Locate className="h-4 w-4 mr-2" />
        {isLocating ? 'Тодорхойлж байна...' : 'Миний байршил'}
      </Button>

      {coords && (
        <p className="text-xs text-muted-foreground text-center">
          Байршил: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
