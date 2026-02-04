import { useState, useEffect, useRef } from 'react';
import { MapPin, Locate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeliveryMapPickerProps {
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

// Ulaanbaatar center coordinates
const UB_CENTER = { lat: 47.9184, lng: 106.9177 };

export function DeliveryMapPicker({ onLocationSelect, selectedLocation }: DeliveryMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // For now, we'll use a simple coordinate picker
  // In production, you'd integrate Google Maps or Mapbox
  const [coords, setCoords] = useState(selectedLocation || UB_CENTER);

  useEffect(() => {
    if (selectedLocation) {
      setCoords(selectedLocation);
    }
  }, [selectedLocation]);

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

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Calculate relative position within the map container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to lat/lng (simplified - in production use actual map API)
    // This maps the container to approximately Ulaanbaatar area
    const lat = UB_CENTER.lat + (0.5 - y / rect.height) * 0.1;
    const lng = UB_CENTER.lng + (x / rect.width - 0.5) * 0.2;

    const newCoords = { lat, lng };
    setCoords(newCoords);
    onLocationSelect(newCoords);
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
        className="relative h-48 rounded-lg border bg-gradient-to-br from-blue-50 to-green-50 cursor-crosshair overflow-hidden"
        onClick={handleMapClick}
      >
        {/* Simple grid overlay to simulate map */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="border border-gray-200/50" />
          ))}
        </div>

        {/* Zone labels */}
        <div className="absolute top-2 left-2 text-xs font-medium text-blue-600 bg-white/80 px-2 py-1 rounded">
          А бүс
        </div>
        <div className="absolute top-2 right-2 text-xs font-medium text-yellow-600 bg-white/80 px-2 py-1 rounded">
          B бүс
        </div>
        <div className="absolute bottom-2 left-2 text-xs font-medium text-red-600 bg-white/80 px-2 py-1 rounded">
          C бүс
        </div>

        {/* Center marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-gray-500">
          Улаанбаатар
        </div>

        {/* Selected location marker */}
        {coords && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${50 + (coords.lng - UB_CENTER.lng) * 500}%`,
              top: `${50 - (coords.lat - UB_CENTER.lat) * 1000}%`,
            }}
          >
            <MapPin className="h-8 w-8 text-primary fill-primary/20" />
          </div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
          Газрын зураг дээр дарна уу
        </div>
      </div>

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
