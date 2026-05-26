export interface SubtitleStyle {
  fontname: string;
  fontsize: number;
  color1: string;    // primary text color (hex)
  color3: string;    // border color
  color4: string;    // shadow color
  bold: boolean;
  italic: boolean;
  underline: boolean;
  outline: number;   // 0-4 px
  shadow: number;    // 0-4 px
  margin_l: number;
  margin_r: number;
  margin_v: number;
  offsetY: number;   // vertical offset for positioning
}

export const DEFAULT_EN_STYLE: SubtitleStyle = {
  fontname: "Arial",
  fontsize: 48,
  color1: "#FFFFFF",
  color3: "#000000",
  color4: "#000000",
  bold: false,
  italic: false,
  underline: false,
  outline: 2,
  shadow: 1,
  margin_l: 20,
  margin_r: 20,
  margin_v: 40,
  offsetY: 0,
};

export const DEFAULT_CN_STYLE: SubtitleStyle = {
  fontname: "Microsoft YaHei",
  fontsize: 40,
  color1: "#FFFFFF",
  color3: "#000000",
  color4: "#000000",
  bold: false,
  italic: false,
  underline: false,
  outline: 2,
  shadow: 1,
  margin_l: 20,
  margin_r: 20,
  margin_v: 10,
  offsetY: 0,
};

// Legacy alias for backward compat
export const DEFAULT_STYLE = DEFAULT_EN_STYLE;

export interface Sentence {
  id: string;
  start: number;
  end: number;
  text: string;         // legacy, kept for compat
  englishText: string;
  chineseText: string;
  style: {
    english: SubtitleStyle;
    chinese: SubtitleStyle;
  };
}

export interface StylePreset {
  id: string;
  name: string;
  english: SubtitleStyle;
  chinese: SubtitleStyle;
}

export type CutPhase = "idle" | "waiting-start" | "start-set";

export interface ProjectState {
  sentences: Sentence[];
  videoName: string | null;
  stylePresets: StylePreset[];
}
