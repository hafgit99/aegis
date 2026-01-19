/**
 * Aegis Vault - QR Scanner Hook
 * Hook for accessing camera and scanning QR codes
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';

interface UseQRScannerOptions {
  onScanComplete?: (result: string) => void;
  onError?: (error: string) => void;
}

interface UseQRScannerResult {
  isScanning: boolean;
  startScanning: () => Promise<void>;
  stopScanning: () => void;
  scanImage: (file: File) => Promise<string | null>;
  error: string | null;
}

export function useQRScanner(options: UseQRScannerOptions = {}): UseQRScannerResult {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const chunksRef = useRef<Map<string, any[]>>(new Map());

  const { onScanComplete, onError } = options;

  // Cleanup function
  const stopScanning = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    setIsScanning(false);
  }, []);

  // Tick function for continuous scanning
  const tick = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        // QR code found
        stopScanning();
        onScanComplete?.(code.data);
        return;
      }
    }

    animationRef.current = requestAnimationFrame(tick);
  }, [onScanComplete, stopScanning]);

  // Start scanning with camera
  const startScanning = useCallback(async () => {
    setError(null);

    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Create video element if it doesn't exist
      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
      }

      // Create canvas element if it doesn't exist
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      // Wait for video to be ready
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        setIsScanning(true);
        tick();
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [tick, onError]);

  // Scan from uploaded image
  const scanImage = useCallback(async (file: File): Promise<string | null> => {
    setError(null);

    try {
      // Create an image element
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);

      return new Promise((resolve) => {
        img.onload = () => {
          // Create canvas and draw image
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            URL.revokeObjectURL(imageUrl);
            onError?.('Failed to get canvas context');
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0);

          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Scan for QR code
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          URL.revokeObjectURL(imageUrl);

          if (code) {
            resolve(code.data);
          } else {
            onError?.('No QR code found in image');
            resolve(null);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          onError?.('Failed to load image');
          resolve(null);
        };

        img.src = imageUrl;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(errorMessage);
      return Promise.resolve(null);
    }
  }, [onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    isScanning,
    startScanning,
    stopScanning,
    scanImage,
    error
  };
}

export default useQRScanner;
