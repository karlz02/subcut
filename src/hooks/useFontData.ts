import { useEffect, useState } from "react";

/**
 * Loads font file data for fonts referenced in ASS content.
 * Returns an array of Uint8Array font buffers for JASSUB.
 */
export function useFontData(assContent: string | null): Uint8Array[] {
  const [fonts, setFonts] = useState<Uint8Array[]>([]);

  useEffect(() => {
    if (!assContent) {
      setFonts([]);
      return;
    }

    let cancelled = false;

    const loadFonts = async () => {
      const api = window.fontAPI || window.electronAPI;
      if (!api?.getFontData) return;

      // Extract font names from ASS content (lines starting with "Style:")
      const fontNames = new Set<string>();
      for (const line of assContent.split("\n")) {
        if (line.startsWith("Style:")) {
          const parts = line.split(",");
          if (parts.length > 1) {
            fontNames.add(parts[1].trim());
          }
        }
      }

      if (fontNames.size === 0) return;

      const loaded: Uint8Array[] = [];
      for (const name of fontNames) {
        try {
          const data = await api.getFontData(name);
          if (data && !cancelled) {
            loaded.push(data);
          }
        } catch { /* font not found, skip */ }
      }

      if (!cancelled && loaded.length > 0) {
        setFonts(loaded);
      }
    };

    loadFonts();

    return () => { cancelled = true; };
  }, [assContent]);

  return fonts;
}
