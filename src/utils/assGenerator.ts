import type { Sentence, SubtitleStyle } from "../types";

/**
 * Convert CSS hex color "#RRGGBB" to ASS color "&H00BBGGRR&"
 * ASS uses AABBGGRR byte order (alpha, blue, green, red)
 */
export function hexToASSColor(hex: string): string {
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

/**
 * Convert seconds (float) to ASS time format "H:MM:SS.CC"
 * ASS uses centiseconds (1/100th of a second)
 */
export function secondsToASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Convert boolean to ASS integer flag (-1 = true, 0 = false) */
function boolToInt(b: boolean): number {
  return b ? -1 : 0;
}

/** Build a single ASS Style line from SubtitleStyle */
function buildStyleLine(name: string, s: SubtitleStyle): string {
  return [
    name,
    s.fontname,
    s.fontsize,
    hexToASSColor(s.color1),   // PrimaryColour
    "&H00000000&",              // SecondaryColour (unused)
    hexToASSColor(s.color3),   // OutlineColour
    hexToASSColor(s.color4),   // BackColour
    boolToInt(s.bold),          // Bold
    boolToInt(s.italic),        // Italic
    boolToInt(s.underline),     // Underline
    0,                           // StrikeOut
    100,                         // ScaleX
    100,                         // ScaleY
    0,                           // Spacing
    0,                           // Angle
    1,                           // BorderStyle (1 = outline + shadow)
    s.outline,                   // Outline
    s.shadow,                    // Shadow
    2,                           // Alignment (2 = bottom center)
    s.margin_l,                  // MarginL
    s.margin_r,                  // MarginR
    s.margin_v,                  // MarginV
    1,                           // Encoding
  ].join(",");
}

/** Build a Dialogue line */
function buildDialogue(
  start: number,
  end: number,
  styleName: string,
  text: string,
  marginL: number,
  marginR: number,
  marginV: number,
): string {
  const startTime = secondsToASSTime(start);
  const endTime = secondsToASSTime(end);
  // Override margins to 0 means "use style default" in ASS
  // But we pass per-sentence margins from the style
  // Convert newline characters to ASS format (\N)
  const escapedText = text.replace(/\n/g, "\\N");
  return `Dialogue: 0,${startTime},${endTime},${styleName},,${marginL},${marginR},${marginV},,${escapedText}`;
}

/**
 * Generate a complete .ass file from an array of Sentences.
 * Each sentence produces two Dialogue lines: one for English, one for Chinese.
 * Each sentence uses its own style settings.
 */
export function generateASS(sentences: Sentence[]): string {
  if (sentences.length === 0) return "";

  const lines: string[] = [];

  // ── Script Info ──
  lines.push("[Script Info]");
  lines.push("Title: EchoCut Subtitles");
  lines.push("ScriptType: v4.00+");
  lines.push("WrapStyle: 0");
  lines.push("PlayResX: 1920");
  lines.push("PlayResY: 1080");
  lines.push("ScaledBorderAndShadow: yes");
  lines.push("");

  // ── V4+ Styles ──
  // Track styles separately for English and Chinese
  interface StyleRecord {
    style: SubtitleStyle;
    name: string;
  }
  
  // 使用 Map 替代数组查找，提高性能
  const enStylesMap = new Map<string, StyleRecord>();
  const cnStylesMap = new Map<string, StyleRecord>();
  
  // 生成样式的唯一哈希键
  const generateStyleKey = (style: SubtitleStyle): string => {
    return `${style.fontname}|${style.fontsize}|${style.color1}|${style.color3}|${style.color4}|${style.bold}|${style.italic}|${style.underline}|${style.outline}|${style.shadow}|${style.margin_l}|${style.margin_r}|${style.margin_v}|${style.offsetY}`;
  };
  
  const getEnStyleName = (style: SubtitleStyle): string => {
    const key = generateStyleKey(style);
    const existing = enStylesMap.get(key);
    if (existing) return existing.name;
    const name = `EchoCut-EN-${enStylesMap.size}`;
    enStylesMap.set(key, { style, name });
    return name;
  };
  
  const getCnStyleName = (style: SubtitleStyle): string => {
    const key = generateStyleKey(style);
    const existing = cnStylesMap.get(key);
    if (existing) return existing.name;
    const name = `EchoCut-CN-${cnStylesMap.size}`;
    cnStylesMap.set(key, { style, name });
    return name;
  };
  
  // 将 Map 转换为数组用于后续遍历
  const enStyles = () => Array.from(enStylesMap.values());
  const cnStyles = () => Array.from(cnStylesMap.values());

  // Pre-populate styles by iterating through all sentences
  for (const s of sentences) {
    getEnStyleName(s.style.english);
    getCnStyleName(s.style.chinese);
  }

  lines.push("[V4+ Styles]");
  lines.push("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding");
  
  enStyles().forEach(record => lines.push(buildStyleLine(record.name, record.style)));
  cnStyles().forEach(record => lines.push(buildStyleLine(record.name, record.style)));
  lines.push("");

  // ── Events ──
  lines.push("[Events]");
  lines.push("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text");

  for (const s of sentences) {
    const enStyleName = getEnStyleName(s.style.english);
    const cnStyleName = getCnStyleName(s.style.chinese);

    if (s.englishText) {
      lines.push(buildDialogue(
        s.start, s.end, enStyleName, s.englishText,
        s.style.english.margin_l, s.style.english.margin_r, s.style.english.margin_v,
      ));
    }
    if (s.chineseText) {
      lines.push(buildDialogue(
        s.start, s.end, cnStyleName, s.chineseText,
        s.style.chinese.margin_l, s.style.chinese.margin_r, s.style.chinese.margin_v,
      ));
    }
  }

  return lines.join("\n");
}
