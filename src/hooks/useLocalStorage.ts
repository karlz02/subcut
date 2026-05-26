import { useState, useEffect, useCallback, useRef } from 'react';
import type { Sentence, ProjectState, SubtitleStyle, StylePreset } from "../types";
import { DEFAULT_EN_STYLE, DEFAULT_CN_STYLE } from "../types";

// ==================== 通用 useLocalStorage hook ====================
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const isInitialized = useRef(false);

  // 只在组件首次挂载时从 localStorage 读取
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`useLocalStorage read error "${key}":`, error);
    }
  }, [key]);

  // 设置值
  const setStoredValue = useCallback((newValue: T | ((val: T) => T)) => {
    try {
      setValue((current) => {
        const valueToStore = newValue instanceof Function
          ? newValue(current)
          : newValue;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.error(`useLocalStorage set error "${key}":`, error);
    }
  }, [key]);

  return [value, setStoredValue];
}

// ==================== 项目存储相关 ====================
const STORAGE_KEY = "echocut-project";

function migrateStyle(raw: any): { english: SubtitleStyle; chinese: SubtitleStyle } {
  if (raw?.english && raw?.chinese) {
    return {
      english: { ...DEFAULT_EN_STYLE, ...raw.english },
      chinese: { ...DEFAULT_CN_STYLE, ...raw.chinese },
    };
  }
  if (raw?.fontname) {
    const { align: _align, ...rest } = raw;
    return {
      english: { ...DEFAULT_EN_STYLE, ...rest },
      chinese: { ...DEFAULT_CN_STYLE },
    };
  }
  return { english: { ...DEFAULT_EN_STYLE }, chinese: { ...DEFAULT_CN_STYLE } };
}

function loadProject(): ProjectState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as any;
      const sentences = Array.isArray(data.sentences)
        ? data.sentences.map((s: any) => ({
            id: s.id,
            start: s.start,
            end: s.end,
            text: s.text ?? s.label ?? "",
            englishText: s.englishText ?? s.text ?? "",
            chineseText: s.chineseText ?? "",
            style: migrateStyle(s.style),
          }))
        : [];
      const stylePresets: StylePreset[] = Array.isArray(data.stylePresets)
        ? data.stylePresets
        : [];
      return { sentences, videoName: data.videoName ?? null, stylePresets };
    }
  } catch {
    // corrupted data, ignore
  }
  return { sentences: [], videoName: null, stylePresets: [] };
}

function saveProject(state: ProjectState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full, ignore
  }
}

export function useProjectStorage() {
  const [state, setState] = useState<ProjectState>(loadProject);
  const savedRef = useRef<string>();

  useEffect(() => {
    const stateStr = JSON.stringify(state);
    if (stateStr !== savedRef.current) {
      savedRef.current = stateStr;
      saveProject(state);
    }
  }, [state]);

  const setSentences = useCallback((sentences: Sentence[] | ((prev: Sentence[]) => Sentence[])) => {
    setState((prev) => {
      const next = typeof sentences === "function" ? sentences(prev.sentences) : sentences;
      return { ...prev, sentences: next };
    });
  }, []);

  const setVideoName = useCallback((name: string | null) => {
    setState((prev) => ({ ...prev, videoName: name }));
  }, []);

  const setStylePresets = useCallback((presets: StylePreset[] | ((prev: StylePreset[]) => StylePreset[])) => {
    setState((prev) => {
      const next = typeof presets === "function" ? presets(prev.stylePresets) : presets;
      return { ...prev, stylePresets: next };
    });
  }, []);

  const clearProject = useCallback(() => {
    setState({ sentences: [], videoName: null, stylePresets: [] });
  }, []);

  return { ...state, setSentences, setVideoName, setStylePresets, clearProject };
}
