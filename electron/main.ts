import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { TextDecoder } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST = path.join(__dirname, "../dist");
const VITE_PUBLIC = app.isPackaged ? DIST : path.join(DIST, "../public");
process.env.DIST = DIST;
process.env.VITE_PUBLIC = VITE_PUBLIC;

let win: BrowserWindow | null;

// ── Windows Font Scanning System ──
// Goal: match Windows Font Settings exactly. No filtering, no cleaning.
let fontCache: string[] | null = null;

const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".ttc", ".woff", ".woff2"]);
const REG_OUTPUT_DECODERS = [
  new TextDecoder("utf-8"),
  new TextDecoder("gb18030"),
];

/** Strip only the "(TrueType)" / "(OpenType)" type suffix from registry value name. */
function stripTypeSuffix(name: string): string {
  return name.replace(/\s*\((?:TrueType|OpenType|Raster|Vector)\)\s*$/i, "").trim();
}

function isReadableFontName(font: string): boolean {
  const name = font.trim();
  return name.length > 0 && !name.includes("\uFFFD") && !/[\u0000-\u001F]/.test(name);
}

function scoreRegistryOutput(output: string): number {
  const replacementChars = output.match(/\uFFFD/g)?.length ?? 0;
  const mojibakeMarkers =
    output.match(/Ã|Â|鏂规|鍗庢|闅朵|骞煎|瀹嬬|绮楅|畝/g)?.length ?? 0;
  return replacementChars * 20 + mojibakeMarkers * 5;
}

function decodeRegistryOutput(output: Buffer): string {
  return REG_OUTPUT_DECODERS
    .map((decoder) => decoder.decode(output))
    .sort((a, b) => scoreRegistryOutput(a) - scoreRegistryOutput(b))[0];
}

function queryRegistryOutput(hive: string): string {
  const output = execSync(
    `reg query "${hive}\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"`,
    { timeout: 5000, windowsHide: true }
  );
  return decodeRegistryOutput(output);
}

/** Query a single registry hive for fonts */
function queryFontRegistry(hive: string): string[] {
  try {
    const output = queryRegistryOutput(hive);
    const fonts: string[] = [];
    for (const line of output.split("\n")) {
      const match = line.match(/^\s+(.+?)\s+REG_SZ\s+/);
      if (!match) continue;
      const name = stripTypeSuffix(match[1]);
      if (isReadableFontName(name)) fonts.push(name);
    }
    return fonts;
  } catch {
    return [];
  }
}

/** Read BOTH HKLM (all users) and HKCU (current user) — merge & deduplicate */
function getFontsFromRegistry(): string[] {
  const hkcu = queryFontRegistry("HKCU");
  const hklm = queryFontRegistry("HKLM");
  const seen = new Set<string>();
  const fonts: string[] = [];
  for (const name of [...hklm, ...hkcu]) {
    if (!seen.has(name)) {
      seen.add(name);
      fonts.push(name);
    }
  }
  console.log(`[WINDOWS FONTS] HKLM: ${hklm.length}, HKCU: ${hkcu.length}, merged: ${fonts.length}`);
  return fonts.sort((a, b) => a.localeCompare(b));
}

/** Priority 2: Scan C:\Windows\Fonts — supplement registry with any missing entries */
function getFontsFromDirectory(registrySet: Set<string>): string[] {
  try {
    const fontDir = process.env.WINDIR
      ? path.join(process.env.WINDIR, "Fonts")
      : "C:\\Windows\\Fonts";
    const files = readdirSync(fontDir);
    const extra: string[] = [];
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!FONT_EXTENSIONS.has(ext)) continue;
      const name = path.basename(file, ext);
      if (isReadableFontName(name) && !registrySet.has(name)) {
        extra.push(name);
      }
    }
    console.log(`[WINDOWS FONTS] Directory supplement: +${extra.length}`);
    return extra.sort();
  } catch {
    console.log(`[WINDOWS FONTS] Directory: FAILED`);
    return [];
  }
}

/** Merge registry + directory, deduplicate by exact name */
function scanWindowsFonts(): string[] {
  if (fontCache) return fontCache;

  const registry = getFontsFromRegistry();
  const registrySet = new Set(registry);
  const directory = getFontsFromDirectory(registrySet);

  // Merge: registry first, then directory extras
  const merged = [...registry, ...directory];
  fontCache = merged;

  console.log(`[WINDOWS FONTS] Registry: ${registry.length}`);
  console.log(`[WINDOWS FONTS] Directory: ${registry.length + directory.length} total`);
  console.log(`[WINDOWS FONTS] Merged: ${merged.length}`);
  return fontCache;
}

ipcMain.handle("get-system-fonts", async () => scanWindowsFonts());

// ── Font File Loading for JASSUB ──
// Build a map: font name → file path (from registry + font directories)
let fontPathCache: Map<string, string> | null = null;

function buildFontPathMap(): Map<string, string> {
  if (fontPathCache) return fontPathCache;
  const map = new Map<string, string>();
  const fontDir = process.env.WINDIR
    ? path.join(process.env.WINDIR, "Fonts")
    : "C:\\Windows\\Fonts";

  // Scan registry for font file associations
  for (const hive of ["HKLM", "HKCU"]) {
    try {
      const output = queryRegistryOutput(hive);
      for (const line of output.split("\n")) {
        const match = line.match(/^\s+(.+?)\s+REG_SZ\s+(.+)$/);
        if (!match) continue;
        const name = stripTypeSuffix(match[1]);
        const file = match[2].trim();
        if (isReadableFontName(name) && file && !map.has(name)) {
          // Resolve relative paths against font directory
          const fullPath = path.isAbsolute(file) ? file : path.join(fontDir, file);
          map.set(name, fullPath);
        }
      }
    } catch { /* ignore */ }
  }

  // Also scan font directory for files not in registry
  try {
    for (const file of readdirSync(fontDir)) {
      const ext = path.extname(file).toLowerCase();
      if (!FONT_EXTENSIONS.has(ext)) continue;
      const name = path.basename(file, ext);
      if (!map.has(name)) {
        map.set(name, path.join(fontDir, file));
      }
    }
  } catch { /* ignore */ }

  fontPathCache = map;
  console.log(`[FONT PATHS] Built map: ${map.size} entries`);
  return map;
}

ipcMain.handle("get-font-data", async (_event, fontName: string) => {
  const map = buildFontPathMap();
  const filePath = map.get(fontName);
  if (!filePath || !existsSync(filePath)) return null;
  try {
    const data = readFileSync(filePath);
    return new Uint8Array(data);
  } catch {
    return null;
  }
});

// ── Window Controls ──
ipcMain.on("window-minimize", () => {
  win?.minimize();
});

ipcMain.on("window-maximize", () => {
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on("window-close", () => {
  win?.close();
});

ipcMain.on("window-drag", () => {
  // Drag is handled by -webkit-app-region CSS property, no action needed here
});

// ── Project File Dialogs ──
const PROJECT_FILE_MAGIC = Buffer.from("ECHOCUT1\n", "utf-8");
const PROJECT_HEADER_LENGTH_BYTES = 4;

type VideoSource =
  | null
  | undefined
  | string
  | {
      path?: string | null;
      data?: Uint8Array | ArrayBuffer | number[] | null;
      mimeType?: string | null;
      name?: string | null;
    };

function getVideoMimeType(fileNameOrPath: string): string {
  const ext = path.extname(fileNameOrPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".mkv": "video/x-matroska",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
  };
  return mimeMap[ext] ?? "video/mp4";
}

function normalizeProjectDefaultName(defaultName: string): string {
  const base = (defaultName || "project")
    .replace(/\.echocut\.json$/i, "")
    .replace(/\.echocut$/i, "")
    .replace(/\.[^.]+$/i, "")
    .trim();
  return `${base || "project"}.echocut`;
}

function bufferFromVideoData(videoSource: Exclude<NonNullable<VideoSource>, string>): Buffer | null {
  if (!videoSource.data) return null;
  if (videoSource.data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(videoSource.data));
  }
  if (ArrayBuffer.isView(videoSource.data)) {
    const view = videoSource.data as Uint8Array;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(videoSource.data)) {
    return Buffer.from(videoSource.data);
  }
  return null;
}

function readVideoSource(videoSource: VideoSource): { buffer: Buffer; mimeType: string; name: string; path: string | null } | null {
  if (!videoSource) return null;
  if (typeof videoSource === "string" || videoSource.path) {
    const videoPath = typeof videoSource === "string" ? videoSource : videoSource.path;
    if (!videoPath || !existsSync(videoPath)) return null;
    return {
      buffer: readFileSync(videoPath),
      mimeType: getVideoMimeType(videoPath),
      name: path.basename(videoPath),
      path: videoPath,
    };
  }

  const buffer = bufferFromVideoData(videoSource);
  if (!buffer) return null;
  const name = videoSource.name || "video.mp4";
  return {
    buffer,
    mimeType: videoSource.mimeType || getVideoMimeType(name),
    name,
    path: null,
  };
}

function buildBundledProject(projectData: Record<string, unknown>, video: { buffer: Buffer; mimeType: string; name: string }) {
  const header = {
    ...projectData,
    _projectFormat: "echocut-bundle-v1",
    _embeddedVideo: {
      name: video.name,
      mimeType: video.mimeType,
      size: video.buffer.byteLength,
    },
  };
  const headerBuffer = Buffer.from(JSON.stringify(header), "utf-8");
  const headerLength = Buffer.alloc(PROJECT_HEADER_LENGTH_BYTES);
  headerLength.writeUInt32LE(headerBuffer.byteLength, 0);
  return Buffer.concat([PROJECT_FILE_MAGIC, headerLength, headerBuffer, video.buffer]);
}

function parseBundledProject(buffer: Buffer) {
  const headerLengthOffset = PROJECT_FILE_MAGIC.byteLength;
  const headerStart = headerLengthOffset + PROJECT_HEADER_LENGTH_BYTES;
  if (buffer.byteLength < headerStart) {
    throw new Error("Invalid EchoCut project file.");
  }
  const headerLength = buffer.readUInt32LE(headerLengthOffset);
  const headerEnd = headerStart + headerLength;
  if (headerEnd > buffer.byteLength) {
    throw new Error("Invalid EchoCut project header.");
  }

  const projectData = JSON.parse(buffer.subarray(headerStart, headerEnd).toString("utf-8"));
  const videoBuffer = buffer.subarray(headerEnd);
  const embeddedVideo = projectData?._embeddedVideo ?? {};
  return {
    projectData,
    video: {
      data: new Uint8Array(videoBuffer),
      mimeType: embeddedVideo.mimeType ?? "video/mp4",
      name: embeddedVideo.name ?? projectData.videoName ?? "video.mp4",
    },
  };
}

ipcMain.handle("open-project-dialog", async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: "打开工程",
    filters: [
      { name: "EchoCut 工程", extensions: ["echocut", "json"] },
      { name: "所有文件", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  try {
    const filePath = result.filePaths[0];
    const buffer = readFileSync(filePath);
    if (buffer.subarray(0, PROJECT_FILE_MAGIC.byteLength).equals(PROJECT_FILE_MAGIC)) {
      return { filePath, ...parseBundledProject(buffer) };
    }

    const content = buffer.toString("utf-8");
    return { filePath, content, projectData: JSON.parse(content) };
  } catch {
    return { error: "工程文件格式错误" };
  }
});

// Save project with embedded video (self-contained .echocut project file)
ipcMain.handle("save-project-with-video", async (_event, defaultName: string, projectData: Record<string, unknown>, videoSource: VideoSource) => {
  if (!win) return null;

  const result = await dialog.showSaveDialog(win, {
    title: "另存为工程（含视频）",
    defaultPath: normalizeProjectDefaultName(defaultName),
    filters: [{ name: "EchoCut 工程", extensions: ["echocut"] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  try {
    const video = readVideoSource(videoSource);
    if (!video) {
      return { error: "无法读取视频文件，工程未保存" };
    }

    const fullData = buildBundledProject({
      ...projectData,
      videoName: projectData.videoName ?? video.name,
      videoPath: video.path,
    }, video);
    writeFileSync(result.filePath, fullData);
    return { filePath: result.filePath };
  } catch {
    return { error: "工程保存失败" };
  }
});

// ── Window ──
const VITE_DEV_SERVER_URL: string | undefined = process.env["VITE_DEV_SERVER_URL"];

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "EchoCut",
    backgroundColor: "#1a1a2e",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  // SharedArrayBuffer support for JASSUB (libass-wasm multi-threading)
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Cross-Origin-Opener-Policy": ["same-origin"],
        "Cross-Origin-Embedder-Policy": ["require-corp"],
      },
    });
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(DIST, "index.html"));
  }

  win.webContents.openDevTools({ mode: "detach" });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
