import { useState, useEffect, useRef } from 'react';
import { MapPin, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

// Ulaanbaatar center coordinates
const UB_CENTER = { lat: 47.9184, lng: 106.9177 };
const MAP_BOUNDS = { 
  minLat: 47.85, maxLat: 48.0,
  minLng: 106.75, maxLng: 107.1 
};

export function DeliveryZoneMapEditor({ polygon, onPolygonChange, zoneColor = '#3b82f6' }: DeliveryZoneMapEditorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

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
    if (!isDrawing) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const point = toLatLng(x, y, rect);
    onPolygonChange([...polygon, point]);
  };

  const handlePointClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPointIndex(index === selectedPointIndex ? null : index);
  };

  const handleRemovePoint = (index: number) => {
    const newPolygon = polygon.filter((_, i) => i !== index);
    onPolygonChange(newPolygon);
    setSelectedPointIndex(null);
  };

  const handleClearPolygon = () => {
    onPolygonChange([]);
    setSelectedPointIndex(null);
  };

  // Generate SVG path from polygon
  const getSvgPath = (rect: DOMRect): string => {
    if (polygon.length < 2) return '';
    
    const points = polygon.map((p) => toPixel(p, rect));
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  };

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearPolygon}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Арилгах
            </Button>
          )}
        </div>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        className={`relative h-64 rounded-lg border bg-gradient-to-br from-blue-50 to-green-50 overflow-hidden ${
          isDrawing ? 'cursor-crosshair' : 'cursor-default'
        }`}
        onClick={handleMapClick}
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 grid grid-cols-6 grid-rows-6">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className="border border-gray-200/30" />
          ))}
        </div>

        {/* Center marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 bg-white/80 px-1 rounded">
          Улаанбаатар
        </div>

        {/* Polygon SVG */}
        {mapRef.current && polygon.length >= 2 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <path
              d={getSvgPath(mapRef.current.getBoundingClientRect())}
              fill={`${zoneColor}40`}
              stroke={zoneColor}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Polygon points */}
        {mapRef.current && polygon.map((point, index) => {
          const rect = mapRef.current!.getBoundingClientRect();
          const pixel = toPixel(point, rect);
          
          return (
            <div
              key={index}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform ${
                selectedPointIndex === index ? 'scale-125' : ''
              }`}
              style={{ left: pixel.x, top: pixel.y }}
              onClick={(e) => handlePointClick(index, e)}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-md"
                style={{ backgroundColor: zoneColor }}
              />
              {selectedPointIndex === index && (
                <button
                  className="absolute -top-6 left-1/2 -translate-x-1/2 p-1 rounded-full bg-red-500 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePoint(index);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Instructions */}
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <span className="text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
            {isDrawing ? 'Газрын зураг дээр дарж цэг нэмнэ үү' : 'Цэг нэмэх товчийг дарна уу'}
          </span>
        </div>
      </div>
    </div>
  );
}
