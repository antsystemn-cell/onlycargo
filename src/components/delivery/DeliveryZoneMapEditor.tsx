import { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Marker } from '@react-google-maps/api';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Point {
  lat: number;
  lng: number;
}

interface DeliveryZoneMapEditorProps {
  polygon: Point[];
  onPolygonChange: (polygon: Point[]) => void;
  zoneColor?: string;
}

const UB_CENTER = { lat: 47.9184, lng: 106.9177 };
const containerStyle = { width: '100%', height: '320px' };

export function DeliveryZoneMapEditor({ polygon, onPolygonChange, zoneColor = '#3b82f6' }: DeliveryZoneMapEditorProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;
    const point: Point = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    onPolygonChange([...polygon, point]);
  }, [isDrawing, polygon, onPolygonChange]);

  const handleMarkerDragEnd = useCallback((index: number, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const updated = [...polygon];
    updated[index] = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    onPolygonChange(updated);
  }, [polygon, onPolygonChange]);

  const handleRemovePoint = (index: number) => {
    onPolygonChange(polygon.filter((_, i) => i !== index));
    setSelectedPointIndex(null);
  };

  const handleClearPolygon = () => {
    onPolygonChange([]);
    setSelectedPointIndex(null);
  };

  if (!isLoaded) {
    return (
      <div className="h-80 rounded-lg border bg-muted flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Газрын зураг ачааллаж байна...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Бүсийн хүрээ ({polygon.length} цэг)</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isDrawing ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsDrawing(!isDrawing)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {isDrawing ? 'Зогсоох' : 'Цэг нэмэх'}
          </Button>
          {polygon.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleClearPolygon}>
              <Trash2 className="h-4 w-4 mr-1" />
              Арилгах
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={polygon.length > 0 ? polygon[0] : UB_CENTER}
          zoom={12}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            draggableCursor: isDrawing ? 'crosshair' : undefined,
          }}
        >
          {/* Zone polygon */}
          {polygon.length >= 3 && (
            <Polygon
              paths={polygon}
              options={{
                fillColor: zoneColor,
                fillOpacity: 0.2,
                strokeColor: zoneColor,
                strokeWeight: 2,
                strokeOpacity: 0.8,
              }}
            />
          )}

          {/* Draggable vertex markers */}
          {polygon.map((point, index) => (
            <Marker
              key={index}
              position={point}
              draggable
              onDragEnd={(e) => handleMarkerDragEnd(index, e)}
              onClick={() => setSelectedPointIndex(index === selectedPointIndex ? null : index)}
              label={{
                text: `${index + 1}`,
                color: '#fff',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: zoneColor,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              }}
            />
          ))}
        </GoogleMap>
      </div>

      {/* Selected point actions */}
      {selectedPointIndex !== null && selectedPointIndex < polygon.length && (
        <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/50">
          <span className="text-sm text-muted-foreground">
            Цэг #{selectedPointIndex + 1}: {polygon[selectedPointIndex].lat.toFixed(5)}, {polygon[selectedPointIndex].lng.toFixed(5)}
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => handleRemovePoint(selectedPointIndex)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Устгах
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {isDrawing ? 'Газрын зураг дээр дарж цэг нэмнэ үү. Цэгүүдийг чирж зөөх боломжтой.' : 'Цэг нэмэх товчийг дарна уу'}
      </p>
    </div>
  );
}
