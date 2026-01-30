import { useState, useRef, useEffect } from 'react';
import { Camera, X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export default function BarcodeScanner({ 
  onScan, 
  placeholder = 'Трак дугаар оруулах',
  value,
  onChange
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  const startScanning = async () => {
    setError(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Камер ашиглах боломжгүй. Гараар оруулна уу.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Simple barcode detection using canvas (basic implementation)
  // For production, consider using a dedicated library like @AcidOppDe/react-zxing
  const captureFrame = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      // For now, just show manual input option since barcode detection needs a library
      setError('Баркод уншигч одоогоор боловсруулагдаж байна. Гараар оруулна уу.');
    }
  };

  const handleManualSubmit = () => {
    if (inputValue.trim()) {
      onScan(inputValue.trim());
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={startScanning}
          title="Камераар скан хийх"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Dialog open={isScanning} onOpenChange={(open) => !open && stopScanning()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Баркод скан хийх
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-1/3 border-2 border-primary rounded-lg" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={captureFrame}
              >
                <Camera className="mr-2 h-4 w-4" />
                Зураг авах
              </Button>
              <Button
                variant="outline"
                onClick={stopScanning}
              >
                <Keyboard className="mr-2 h-4 w-4" />
                Гараар оруулах
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Гараар оруулах"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue.trim()) {
                    onScan(inputValue.trim());
                    stopScanning();
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (inputValue.trim()) {
                    onScan(inputValue.trim());
                    stopScanning();
                  }
                }}
              >
                Оруулах
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
