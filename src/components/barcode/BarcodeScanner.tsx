import { useState, useEffect, useCallback } from 'react';
import { Camera, X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';

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
  const [stopStream, setStopStream] = useState(false);

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

  const startScanning = () => {
    setError(null);
    setStopStream(false);
    setIsScanning(true);
  };

  const stopScanning = useCallback(() => {
    setStopStream(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 0);
  }, []);

  const handleScanResult = useCallback((err: unknown, result: { getText: () => string } | undefined) => {
    if (result) {
      const scannedText = result.getText();
      if (scannedText) {
        setInputValue(scannedText);
        onChange?.(scannedText);
        onScan(scannedText);
        stopScanning();
      }
    }
  }, [onScan, onChange, stopScanning]);

  const handleCameraError = useCallback((err: string | DOMException) => {
    console.error('Camera error:', err);
    const errorName = typeof err === 'string' ? err : err.name;
    if (errorName === 'NotAllowedError') {
      setError('Камерын зөвшөөрөл олгоно уу.');
    } else {
      setError('Камер ашиглах боломжгүй. Гараар оруулна уу.');
    }
    setIsScanning(false);
  }, []);

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
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Баркод скан хийх
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 p-4">
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              {isScanning && !stopStream && (
                <BarcodeScannerComponent
                  width="100%"
                  height="100%"
                  onUpdate={handleScanResult}
                  onError={handleCameraError}
                  stopStream={stopStream}
                  facingMode="environment"
                  delay={300}
                />
              )}
              {/* Scanning overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3/4 h-1/4 border-2 border-primary rounded-lg animate-pulse" />
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="text-xs bg-background/80 px-2 py-1 rounded text-muted-foreground">
                    Баркодыг хүрээнд байрлуулна уу
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
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
