import { useState, useEffect, useRef } from 'react';
import { MapPin, Locate, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';

interface DeliveryMapPickerProps {
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

// Ulaanbaatar center coordinates
const UB_CENTER = { lat: 47.9184, lng: 106.9177 };
const MAP_BOUNDS = { 
  minLat: 47.85, maxLat: 48.0,
  minLng: 106.75, maxLng: 107.1 
};

interface Point {
  lat: number;
  lng: number;
}

export function DeliveryMapPicker({ onLocationSelect, selectedLocation }: DeliveryMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const { zones, detectZone } = useDeliveryZones();

  const [coords, setCoords] = useState(selectedLocation || UB_CENTER);
  const [detectedZone, setDetectedZone] = useState<typeof zones[0] | null>(null);

  useEffect(() => {
    if (selectedLocation) {
      setCoords(selectedLocation);
    }
  }, [selectedLocation]);

  // Detect zone when coordinates change
  useEffect(() => {
    if (coords && zones.length > 0) {
      const zone = detectZone(coords.lat, coords.lng);
      setDetectedZone(zone);
    }
  }, [coords, zones, detectZone]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Таны browser байршил тодорхойлохыг дэмждэггүй байна');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCoords(newCoords);
        onLocationSelect(newCoords);
        setIsLocating(false);
      },
      (error) => {
        console.error('Location error:', error);
        alert('Байршил тодорхойлоход алдаа гарлаа');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Convert lat/lng to pixel position
  const toPixel = (point: Point, rect: DOMRect): { x: number; y: number } => {
    const x = ((point.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * rect.width;
    const y = ((MAP_BOUNDS.maxLat - point.lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * rect.height;
    return { x, y };
  };

  // Convert pixel position to lat/lng
  const toLatLng = (x: number, y: number, rect: DOMRect): Point => {
    const lng = MAP_BOUNDS.minLng + (x / rect.width) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
    const lat = MAP_BOUNDS.maxLat - (y / rect.height) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
    return { lat, lng };
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newCoords = toLatLng(x, y, rect);
    setCoords(newCoords);
    onLocationSelect(newCoords);
  };

  // Generate SVG path for zone polygon
  const getZonePath = (polygon: Point[], rect: DOMRect): string => {
    if (!polygon || polygon.length < 3) return '';
    const points = polygon.map((p) => toPixel(p, rect));
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  };

  const zoneColors: Record<string, string> = {
    'ZONE_A': '#22c55e',
    'ZONE_B': '#eab308',
    'ZONE_C': '#ef4444',
  };

  return (
    <div className="space-y-3">
      {/* Address input */}
      <div className="space-y-2">
        <Label htmlFor="address">Дэлгэрэнгүй хаяг</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Байр, орц, тоот..."
        />
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        className="relative h-56 rounded-lg border bg-gradient-to-br from-blue-50 to-green-50 cursor-crosshair overflow-hidden"
        onClick={handleMapClick}
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 pointer-events-none">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className="border border-gray-200/30" />
          ))}
        </div>

        {/* Zone polygons */}
        {mapRef.current && zones.map((zone) => {
          const zonePolygon = zone.polygon as Point[] | null;
          if (!zonePolygon || zonePolygon.length < 3) return null;
          
          const rect = mapRef.current!.getBoundingClientRect();
          const color = zoneColors[zone.code] || '#3b82f6';
          
          return (
            <svg key={zone.id} className="absolute inset-0 w-full h-full pointer-events-none">
              <path
                d={getZonePath(zonePolygon, rect)}
                fill={`${color}30`}
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          );
        })}

        {/* Center marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 bg-white/80 px-1 rounded pointer-events-none">
          Улаанбаатар
        </div>

        {/* Selected location marker */}
        {coords && mapRef.current && (() => {
          const rect = mapRef.current.getBoundingClientRect();
          const pixel = toPixel(coords, rect);
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
              style={{ left: pixel.x, top: pixel.y }}
            >
              <MapPin className="h-8 w-8 text-primary fill-primary/20" />
            </div>
          );
        })()}

        {/* Instructions */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded pointer-events-none">
          Газрын зураг дээр дарна уу
        </div>
      </div>

      {/* Detected zone info */}
      {detectedZone && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-green-800">
          <Info className="h-4 w-4" />
          <span className="text-sm">
            <strong>{detectedZone.name}</strong> - {detectedZone.description}
          </span>
        </div>
      )}

      {/* Location button */}
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

      {/* Coordinates display */}
      {coords && (
        <p className="text-xs text-muted-foreground text-center">
          Байршил: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
