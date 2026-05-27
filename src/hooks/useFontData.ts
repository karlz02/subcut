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
      // 安全检查：确保 window 和 API 存在
      if (typeof window === "undefined") {
        console.warn("useFontData: window is undefined");
        return;
      }

      const api = window.fontAPI || window.electronAPI;
      
      // 更清晰的错误提示
      if (!api) {
        console.warn("useFontData: fontAPI or electronAPI not available");
        return;
      }

      if (!api.getFontData) {
        console.warn("useFontData: getFontData method not available");
        return;
      }

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
        } catch (error) { 
          console.warn(`useFontData: Failed to load font "${name}":`, error);
        }
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
