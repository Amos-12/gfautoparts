import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxTimeBetweenKeys?: number;
}

export const useBarcodeScanner = ({
  onScan,
  enabled = true,
  minLength = 5,
  maxTimeBetweenKeys = 50
}: UseBarcodeScanner) => {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isSearchInput = target.getAttribute('data-barcode-input') === 'true';
      const isOtherInput = ['INPUT', 'TEXTAREA'].includes(target.tagName) && !isSearchInput;
      
      if (isOtherInput) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle Enter key - check input value for manual typing in barcode field
      if (e.key === 'Enter') {
        e.preventDefault();
        
        // For barcode input field, read value directly (supports manual typing)
        if (isSearchInput) {
          const inputValue = (target as HTMLInputElement).value?.trim();
          if (inputValue && inputValue.length >= minLength) {
            onScan(inputValue);
          }
          bufferRef.current = '';
          return;
        }
        
        // For scanner input (not in search field), use buffer
        if (bufferRef.current.length >= minLength) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      // Reset buffer if too much time has passed (manual typing outside search field)
      if (timeDiff > maxTimeBetweenKeys && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only add printable characters to buffer (for scanner detection)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !isSearchInput) {
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;

        // Auto-trigger after a brief pause if we have enough characters
        timeoutRef.current = setTimeout(() => {
          if (bufferRef.current.length >= minLength) {
            onScan(bufferRef.current);
            bufferRef.current = '';
          }
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, minLength, maxTimeBetweenKeys, onScan]);

  return { resetBuffer };
};
