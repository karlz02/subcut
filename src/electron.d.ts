interface ElectronAPI {
  getSystemFonts: () => Promise<string[]>;
  getFontData: (fontName: string) => Promise<Uint8Array | null>;
}

interface FontAPI {
  getSystemFonts: () => Promise<string[]>;
  getFontData: (fontName: string) => Promise<Uint8Array | null>;
}

interface Window {
  electronAPI?: ElectronAPI;
  fontAPI?: FontAPI;
}
