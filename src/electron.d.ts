interface ElectronAPI {
  getSystemFonts: () => Promise<string[]>;
  getFontData: (fontName: string) => Promise<Uint8Array | null>;
}

interface FontAPI {
  getSystemFonts: () => Promise<string[]>;
  getFontData: (fontName: string) => Promise<Uint8Array | null>;
}

interface ProjectVideoSource {
  path?: string | null;
  data?: Uint8Array | ArrayBuffer | number[] | null;
  mimeType?: string | null;
  name?: string | null;
}

interface OpenProjectDialogResult {
  filePath?: string;
  content?: string;
  projectData?: any;
  video?: {
    data?: Uint8Array | ArrayBuffer | number[];
    mimeType?: string;
    name?: string;
  };
  error?: string;
}

interface SaveProjectWithVideoResult {
  filePath?: string;
  error?: string;
  canceled?: boolean;
}

interface WindowElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  drag: () => void;
  openProjectDialog: () => Promise<OpenProjectDialogResult | null>;
  saveProjectWithVideo: (
    defaultName: string,
    projectData: object,
    videoSource: ProjectVideoSource | string
  ) => Promise<SaveProjectWithVideoResult | string | null>;
  getPathForFile: (file: File) => string;
}

interface Window {
  electronAPI?: ElectronAPI;
  fontAPI?: FontAPI;
  electron?: WindowElectronAPI;
}
