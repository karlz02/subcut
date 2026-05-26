import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";

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

/** Strip only the "(TrueType)" / "(OpenType)" type suffix from registry value name. */
function stripTypeSuffix(name: string): string {
  return name.replace(/\s*\((?:TrueType|OpenType|Raster|Vector)\)\s*$/i, "").trim();
}

/** Query a single registry hive for fonts */
function queryFontRegistry(hive: string): string[] {
  try {
    const output = execSync(
      `reg query "${hive}\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"`,
      { encoding: "utf-8", timeout: 5000, windowsHide: true }
    );
    const fonts: string[] = [];
    for (const line of output.split("\n")) {
      const match = line.match(/^\s+(.+?)\s+REG_SZ\s+/);
      if (!match) continue;
      const name = stripTypeSuffix(match[1]);
      if (name.length > 0) fonts.push(name);
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
      if (!registrySet.has(name)) {
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
      const output = execSync(
        `reg query "${hive}\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"`,
        { encoding: "utf-8", timeout: 5000, windowsHide: true }
      );
      for (const line of output.split("\n")) {
        const match = line.match(/^\s+(.+?)\s+REG_SZ\s+(.+)$/);
        if (!match) continue;
        const name = stripTypeSuffix(match[1]);
        const file = match[2].trim();
        if (name && file && !map.has(name)) {
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
