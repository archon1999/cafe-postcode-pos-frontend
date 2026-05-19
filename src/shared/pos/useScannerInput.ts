import { useEffect, useRef } from 'react';

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || element.isContentEditable;
}

export function useScannerInput(options: { enabled?: boolean; onScan: (rawCode: string) => void }) {
  const onScanRef = useRef(options.onScan);
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);

  useEffect(() => {
    onScanRef.current = options.onScan;
  }, [options.onScan]);

  useEffect(() => {
    if (!options.enabled) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const now = Date.now();
      if (now - lastKeyAtRef.current > 120) {
        bufferRef.current = '';
      }
      lastKeyAtRef.current = now;

      if (event.key === 'Enter') {
        const rawCode = bufferRef.current.trim();
        bufferRef.current = '';
        if (rawCode.length >= 8) {
          event.preventDefault();
          onScanRef.current(rawCode);
        }
        return;
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options.enabled]);
}
