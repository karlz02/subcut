import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { Sentence, CutPhase, TimelineIssue } from "./types";
import { DEFAULT_EN_STYLE, DEFAULT_CN_STYLE } from "./types";
import { formatTimeCompact } from "./utils/timeFormat";
import { useProjectStorage, saveProjectForVideo } from "./hooks/useLocalStorage";
import VideoPlayer from "./components/VideoPlayer";
import type { VideoPlayerHandle } from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import SentenceList, { type SentenceFilter, type SentenceStats } from "./components/SentenceList";
import FileImport from "./components/FileImport";
import SentenceEditorModal from "./components/SentenceEditorModal";
import WindowControls from "./components/WindowControls";
import "./App.css";
import "./components/Timeline.css";
import "./components/WindowControls.css";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const FINE_STEP = 0.01;
const SHORT_SENTENCE_SECONDS = 0.6;
const GAP_HINT_SECONDS = 0.5;
const OVERLAP_EPSILON_SECONDS = 0.02;

function getSentenceTextState(s: Pick<Sentence, "text" | "englishText" | "chineseText">) {
  const englishText = (s.englishText || s.text || "").trim();
  const chineseText = (s.chineseText || "").trim();
  return {
    englishText,
    chineseText,
    hasSubtitleText: Boolean(englishText || chineseText),
  };
}

function getSentenceHeard(s: Sentence): boolean {
  if (typeof s.heard === "boolean") return s.heard;
  return getSentenceTextState(s).hasSubtitleText;
}

function inferSentenceHeard(s: any): boolean {
  if (typeof s?.heard === "boolean") return s.heard;
  return Boolean(s?.text || s?.englishText || s?.chineseText);
}

type EmbeddedVideoState = {
  data: Uint8Array;
  mimeType: string;
  name?: string;
};

type OpenProjectResult = {
  filePath?: string;
  content?: string;
  projectData?: any;
  video?: {
    data?: Uint8Array | ArrayBuffer | number[];
    mimeType?: string;
    name?: string;
  };
  error?: string;
} | null;

type SaveProjectResult = string | {
  filePath?: string;
  error?: string;
  canceled?: boolean;
} | null;

function getMimeTypeFromName(name?: string | null): string {
  const ext = name?.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mkv: "video/x-matroska",
    mp4: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
  };
  return (ext && mimeMap[ext]) || "video/mp4";
}

function toProjectFileName(name: string | null): string {
  const base = (name ?? "project")
    .replace(/\.echocut\.json$/i, "")
    .replace(/\.echocut$/i, "")
    .replace(/\.[^/.]+$/i, "")
    .trim();
  return `${base || "project"}.echocut`;
}

function toUint8Array(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    const view = data as Uint8Array;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(data)) return new Uint8Array(data);
  return null;
}

function decodeBase64Video(data: string): Uint8Array {
  const byteChars = atob(data);
  const bytes = new Uint8Array(byteChars.length);
  const chunkSize = 8192;
  for (let offset = 0; offset < byteChars.length; offset += chunkSize) {
    const chunk = byteChars.slice(offset, offset + chunkSize);
    for (let i = 0; i < chunk.length; i++) {
      bytes[offset + i] = chunk.charCodeAt(i);
    }
  }
  return bytes;
}

export default function App() {
  const { sentences, setSentences, videoName, setVideoName, stylePresets, setStylePresets, saveCurrentProject } = useProjectStorage();

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFilePath, setVideoFilePath] = useState<string | null>(null);
  const [cutPhase, setCutPhase] = useState<CutPhase>("waiting-start");
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [abLoopEnd, setAbLoopEnd] = useState<number | null>(null);
  const [videoAspect, setVideoAspect] = useState<number>(16 / 9);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [sentenceFilter, setSentenceFilter] = useState<SentenceFilter>("all");
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const abLoopEndRef = useRef(abLoopEnd);
  abLoopEndRef.current = abLoopEnd;
  const cutPhaseRef = useRef(cutPhase);
  cutPhaseRef.current = cutPhase;
  const pendingStartRef = useRef(pendingStart);
  pendingStartRef.current = pendingStart;
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;
  const editingSentenceRef = useRef(editingSentence);
  editingSentenceRef.current = editingSentence;
  const embeddedVideoRef = useRef<EmbeddedVideoState | null>(null);

  const sentenceStats = useMemo<SentenceStats>(() => {
    let heard = 0;
    let empty = 0;
    let subtitleDuration = 0;

    for (const sentence of sentences) {
      const { hasSubtitleText } = getSentenceTextState(sentence);
      if (getSentenceHeard(sentence)) heard += 1;
      if (!hasSubtitleText) empty += 1;
      subtitleDuration += Math.max(0, sentence.end - sentence.start);
    }

    return {
      total: sentences.length,
      heard,
      unheard: Math.max(0, sentences.length - heard),
      empty,
      subtitleDuration,
      subtitleSharePercent: duration > 0 ? Math.min(100, (subtitleDuration / duration) * 100) : 0,
    };
  }, [duration, sentences]);

  const timelineIssues = useMemo<TimelineIssue[]>(() => {
    const sorted = [...sentences].sort((a, b) => a.start - b.start || a.end - b.end);
    const issues: TimelineIssue[] = [];

    sorted.forEach((sentence, index) => {
      const sentenceDuration = Math.max(0, sentence.end - sentence.start);
      if (sentenceDuration > 0 && sentenceDuration < SHORT_SENTENCE_SECONDS) {
        issues.push({
          id: `short-${sentence.id}`,
          type: "short",
          start: sentence.start,
          end: sentence.end,
          label: `短句 ${sentenceDuration.toFixed(2)}s`,
          sentenceId: sentence.id,
        });
      }

      const previous = sorted[index - 1];
      if (!previous) return;

      const overlapStart = Math.max(sentence.start, previous.start);
      const overlapEnd = Math.min(sentence.end, previous.end);
      if (overlapEnd - overlapStart > OVERLAP_EPSILON_SECONDS) {
        issues.push({
          id: `overlap-${previous.id}-${sentence.id}`,
          type: "overlap",
          start: overlapStart,
          end: overlapEnd,
          label: `重叠 ${formatTimeCompact(overlapStart)} - ${formatTimeCompact(overlapEnd)}`,
          sentenceId: sentence.id,
        });
      }

      const gap = sentence.start - previous.end;
      if (gap > GAP_HINT_SECONDS) {
        issues.push({
          id: `gap-${previous.id}-${sentence.id}`,
          type: "gap",
          start: previous.end,
          end: sentence.start,
          label: `间隔 ${gap.toFixed(2)}s`,
        });
      }
    });

    return issues;
  }, [sentences]);

  // Navigation handlers for modal
  const handlePrevSentence = useCallback(() => {
    if (!editingSentence) return;
    const idx = sentencesRef.current.findIndex((s) => s.id === editingSentence.id);
    if (idx > 0) {
      const target = sentencesRef.current[idx - 1];
      setEditingSentence(target);
      setSelectedId(target.id);
      playerRef.current?.seek(target.start);
      setAbLoopEnd(target.end);
    }
  }, [editingSentence]);

  const handleNextSentence = useCallback(() => {
    if (!editingSentence) return;
    const idx = sentencesRef.current.findIndex((s) => s.id === editingSentence.id);
    if (idx < sentencesRef.current.length - 1) {
      const target = sentencesRef.current[idx + 1];
      setEditingSentence(target);
      setSelectedId(target.id);
      playerRef.current?.seek(target.start);
      setAbLoopEnd(target.end);
    }
  }, [editingSentence]);

  // Long-press arrow seek
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekDirectionRef = useRef<-1 | 1 | 0>(0);

  const startContinuousSeek = useCallback((dir: -1 | 1) => {
    seekDirectionRef.current = dir;
    if (seekIntervalRef.current) clearInterval(seekIntervalRef.current);
    // First tick immediately
    const v = playerRef.current;
    if (v) v.seek(Math.max(0, Math.min(v.getDuration(), v.getCurrentTime() + dir * FINE_STEP)));
    seekIntervalRef.current = setInterval(() => {
      const v = playerRef.current;
      if (v) v.seek(Math.max(0, Math.min(v.getDuration(), v.getCurrentTime() + dir * FINE_STEP)));
    }, 16); // ~60fps
  }, []);

  const stopContinuousSeek = useCallback(() => {
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    seekDirectionRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopContinuousSeek(), [stopContinuousSeek]);

  // ── File import ──
  const handleFileSelect = useCallback(
    (file: File) => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      // Get filesystem path via Electron's webUtils API
      const electron = (window as any).electron;
      const filePath = electron?.getPathForFile?.(file) || null;
      setVideoFilePath(filePath);
      embeddedVideoRef.current = null;
      setCutPhase("waiting-start");
      setPendingStart(null);
      setSelectedId(null);
      setAbLoopEnd(null);
      setPlaying(false);
      setCurrentTime(0);
      setVideoAspect(16 / 9);
      setSentenceFilter("all");

      // If an opened project is waiting for this video, just attach the media.
      if (videoName === file.name && sentences.length > 0) {
        setStatusMsg(`已加载: ${file.name}`);
        return;
      }

      setVideoName(file.name);
      setSentences([]);
      setStylePresets([]);
      setIsDirty(false);
      setStatusMsg(`已加载: ${file.name}`);
    },
    [videoSrc, videoName, sentences.length, setVideoName, setSentences, setStylePresets]
  );

  const handleNewFile = useCallback(() => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);
    setVideoFilePath(null);
    embeddedVideoRef.current = null;
    setCutPhase("waiting-start");
    setPendingStart(null);
    setSelectedId(null);
    setAbLoopEnd(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVideoAspect(16 / 9);
    setSentenceFilter("all");
    setShowSafeArea(false);
    setIsDirty(false);
    setStatusMsg("");
  }, [videoSrc]);

  // ── Project save/load ──
  const handleSaveProject = useCallback(() => {
    if (!videoSrc) {
      setStatusMsg("没有可保存的工程");
      return;
    }
    saveCurrentProject();
    setIsDirty(false);
    setStatusMsg(`工程已保存`);
  }, [videoSrc, saveCurrentProject]);

  const handleOpenProject = useCallback(async () => {
    const electron = (window as any).electron;
    if (!electron?.openProjectDialog) {
      setStatusMsg("此功能仅在桌面端可用");
      return;
    }
    const result = await electron.openProjectDialog() as OpenProjectResult;
    if (!result) return;
    if (result.error) {
      setStatusMsg(result.error);
      return;
    }

    try {
      const data = result.projectData ?? (result.content ? JSON.parse(result.content) : null);
      if (!data) {
        setStatusMsg("工程文件格式错误");
        return;
      }
      const loadedName: string | null = data.videoName ?? null;
      const loadedPath: string | null = data.videoPath ?? null;
      const loadedSentences = Array.isArray(data.sentences)
        ? data.sentences.map((s: any) => ({
            id: s.id,
            start: s.start,
            end: s.end,
            heard: inferSentenceHeard(s),
            text: s.text ?? s.englishText ?? "",
            englishText: s.englishText ?? s.text ?? "",
            chineseText: s.chineseText ?? "",
            style: s.style,
          }))
        : [];
      const loadedPresets = Array.isArray(data.stylePresets) ? data.stylePresets : [];

      setVideoName(loadedName);
      setSentences(loadedSentences);
      setStylePresets(loadedPresets);
      setCutPhase("waiting-start");
      setPendingStart(null);
      setSelectedId(null);
      setAbLoopEnd(null);
      setPlaying(false);
      setCurrentTime(0);
      setVideoAspect(16 / 9);
      setSentenceFilter("all");
      setShowSafeArea(false);
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      setVideoSrc(null);
      setVideoFilePath(null);
      embeddedVideoRef.current = null;

      // Save to localStorage
      if (loadedName) {
        saveProjectForVideo(loadedName, {
          sentences: loadedSentences,
          videoName: loadedName,
          stylePresets: loadedPresets,
        });
      }

      let videoLoaded = false;

      // 1. Try bundled video from .echocut project files.
      if (result.video?.data) {
        try {
          const bytes = toUint8Array(result.video.data);
          if (bytes) {
            const mimeType = result.video.mimeType ?? data._embeddedVideo?.mimeType ?? getMimeTypeFromName(result.video.name ?? loadedName);
            const blob = new Blob([bytes as BlobPart], { type: mimeType });
            setVideoSrc(URL.createObjectURL(blob));
            embeddedVideoRef.current = {
              data: bytes,
              mimeType,
              name: result.video.name ?? loadedName ?? undefined,
            };
            videoLoaded = true;
          }
        } catch { /* ignore */ }
      }

      // 2. Try legacy JSON projects that embedded video as base64.
      if (!videoLoaded && data._embeddedVideo?.data) {
        try {
          const { data: base64Data, mimeType } = data._embeddedVideo;
          const bytes = decodeBase64Video(base64Data);
          const resolvedMimeType = mimeType ?? getMimeTypeFromName(data._embeddedVideo.name ?? loadedName);
          const blob = new Blob([bytes as BlobPart], { type: resolvedMimeType });
          setVideoSrc(URL.createObjectURL(blob));
          embeddedVideoRef.current = {
            data: bytes,
            mimeType: resolvedMimeType,
            name: data._embeddedVideo.name ?? loadedName ?? undefined,
          };
          videoLoaded = true;
        } catch { /* ignore */ }
      }

      // 3. Fallback: try to load from stored file path in older project files.
      if (!videoLoaded && loadedPath) {
        try {
          const { existsSync, readFileSync } = require("fs") as typeof import("fs");
          if (existsSync(loadedPath)) {
            const buffer = readFileSync(loadedPath);
            const blob = new Blob([buffer], { type: getMimeTypeFromName(loadedPath) });
            setVideoSrc(URL.createObjectURL(blob));
            setVideoFilePath(loadedPath);
            videoLoaded = true;
          }
        } catch { /* ignore */ }
      }

      setStatusMsg(
        videoLoaded
          ? `已打开工程${loadedName ? `: ${loadedName}` : ""}`
          : `已加载工程数据，请手动导入视频${loadedName ? `: ${loadedName}` : ""}`
      );
      setIsDirty(false);
    } catch {
      setStatusMsg("工程文件格式错误");
    }
  }, [videoSrc, setVideoName, setSentences, setStylePresets]);

  const handleSaveProjectAs = useCallback(async () => {
    if (!videoSrc || sentences.length === 0) {
      setStatusMsg("没有可保存的工程");
      return;
    }
    const electron = (window as any).electron;
    if (!electron?.saveProjectWithVideo) {
      setStatusMsg("此功能仅在桌面端可用");
      return;
    }
    const videoSource = embeddedVideoRef.current ?? (videoFilePath ? { path: videoFilePath } : null);
    if (!videoSource) {
      setStatusMsg("无法获取视频数据，不能另存为含视频工程");
      return;
    }
    const projectData = {
      videoName,
      videoPath: videoFilePath,
      sentences: sentences.map((s) => ({
        id: s.id,
        start: Math.round(s.start * 100) / 100,
        end: Math.round(s.end * 100) / 100,
        heard: s.heard ?? Boolean(s.text || s.englishText || s.chineseText),
        text: s.text ?? s.englishText ?? "",
        englishText: s.englishText,
        chineseText: s.chineseText,
        style: s.style,
      })),
      stylePresets,
    };
    setStatusMsg("正在另存为含视频工程...");
    const defaultName = toProjectFileName(videoName);
    const result = await electron.saveProjectWithVideo(defaultName, projectData, videoSource) as SaveProjectResult;
    const savedPath = typeof result === "string" ? result : result?.filePath;
    if (result && typeof result !== "string" && result.error) {
      setStatusMsg(result.error);
      return;
    }
    if (savedPath) {
      setIsDirty(false);
      setStatusMsg(`工程已保存（含视频）: ${savedPath}`);
    }
  }, [videoSrc, videoName, videoFilePath, sentences, stylePresets]);

  // ── Cut logic ──
  const handleCutStart = useCallback((time?: number) => {
    const t = time ?? (playerRef.current?.getCurrentTime() ?? 0);
    setPendingStart(t);
    setCutPhase("start-set");
    setStatusMsg(`起点: ${formatTimeCompact(t)}`);
  }, []);

  const handleCutEnd = useCallback((time?: number) => {
    const t = time ?? (playerRef.current?.getCurrentTime() ?? 0);
    const ps = pendingStartRef.current;
    const phase = cutPhaseRef.current;
    if (phase !== "start-set" || ps === null) {
      setStatusMsg("请先设置起点");
      return;
    }
    if (t <= ps) {
      setStatusMsg("终点必须在起点之后");
      return;
    }
    const newSentence: Sentence = {
      id: generateId(),
      start: Math.round(ps * 100) / 100,
      end: Math.round(t * 100) / 100,
      text: "",
      heard: false,
      englishText: "",
      chineseText: "",
      style: { english: { ...DEFAULT_EN_STYLE }, chinese: { ...DEFAULT_CN_STYLE } },
    };
    setIsDirty(true);
    setSentences((prev) => [...prev, newSentence]);
    // Continuous workflow: auto-set next cut start to this sentence's end
    const nextStart = newSentence.end;
    setPendingStart(nextStart);
    setCutPhase("start-set");
    setSelectedId(newSentence.id);
    setStatusMsg(`已切割: ${formatTimeCompact(ps)} → ${formatTimeCompact(t)}  |  下一起点: ${formatTimeCompact(nextStart)}`);

    // Auto-playback: seek to start and play
    playerRef.current?.seek(newSentence.start);
    setAbLoopEnd(newSentence.end);
    setTimeout(() => playerRef.current?.play(), 50);
  }, [setSentences]);

  // Timeline Ctrl+click cut handler
  const handleTimelineCut = useCallback((time: number, isStart: boolean) => {
    if (isStart) {
      handleCutStart(time);
    } else {
      handleCutEnd(time);
    }
  }, [handleCutStart, handleCutEnd]);

  // Context menu cut handlers
  const handleSetCutStart = useCallback((time: number) => {
    handleCutStart(time);
  }, [handleCutStart]);

  const handleSetCutEnd = useCallback((time: number) => {
    handleCutEnd(time);
  }, [handleCutEnd]);

  // ── Sentence actions ──
  const handleUpdateSentence = useCallback(
    (id: string, updates: Partial<Sentence>) => {
      setIsDirty(true);
      setSentences((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    [setSentences]
  );

  const handleDeleteSentence = useCallback(
    (id: string) => {
      setIsDirty(true);
      setSentences((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId, setSentences]
  );

  const handleSelectSentence = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id) {
        const s = sentencesRef.current.find((s) => s.id === id);
        if (s) {
          playerRef.current?.seek(s.start);
          setAbLoopEnd(s.end);
        }
      } else {
        setAbLoopEnd(null);
      }
    },
    []
  );

  const handleToggleSentenceHeard = useCallback(
    (id: string, heard: boolean) => {
      setIsDirty(true);
      setSentences((prev) =>
        prev.map((s) => {
          if (s.id === id) {
            return {
              ...s,
              heard,
            };
          }
          return s;
        })
      );
    },
    [setSentences]
  );

  const handlePlaySentence = useCallback(
    (s: Sentence) => {
      setSelectedId(s.id);
      playerRef.current?.seek(s.start);
      setAbLoopEnd(s.end);
      setTimeout(() => playerRef.current?.play(), 50);
    },
    []
  );

  // ── AB Loop check ──
  useEffect(() => {
    if (!playing || abLoopEnd === null) return;
    const interval = setInterval(() => {
      const time = playerRef.current?.getCurrentTime() ?? 0;
      if (abLoopEndRef.current !== null && time >= abLoopEndRef.current - 0.03) {
        playerRef.current?.pause();
        setPlaying(false);
        setAbLoopEnd(null);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [playing, abLoopEnd]);

  // ── Seek ──
  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seek(time);
  }, []);

  // ── Playback ──
  const handleTogglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    playerRef.current?.setPlaybackRate(rate);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {

      // Ctrl+Shift+S = save project as (with embedded video)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyS") {
        e.preventDefault();
        handleSaveProjectAs();
        return;
      }

      // Ctrl+S = save project
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        handleSaveProject();
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const video = playerRef.current;
      if (!video) return;

      // ESC = cancel pending cut start
      if (e.code === "Escape" && cutPhaseRef.current === "start-set") {
        e.preventDefault();
        setCutPhase("waiting-start");
        setPendingStart(null);
        setStatusMsg("已取消起始点");
        return;
      }

      // Alt+Arrow = fine tune selected block boundary
      if (e.altKey && selectedId && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.code === "ArrowLeft" ? -FINE_STEP : FINE_STEP;
        const s = sentencesRef.current.find((s) => s.id === selectedId);
        if (s) {
          // Alt+Shift = adjust end, Alt = adjust start
          if (e.shiftKey) {
            const newEnd = Math.max(s.start + 0.05, s.end + delta);
            handleUpdateSentence(selectedId, { end: Math.round(newEnd * 100) / 100 });
          } else {
            const newStart = Math.max(0, Math.min(s.end - 0.05, s.start + delta));
            handleUpdateSentence(selectedId, { start: Math.round(newStart * 100) / 100 });
          }
        }
        return;
      }

      const handled =
        e.code === "Space" || e.code === "KeyK" ||
        e.code === "ArrowLeft" || e.code === "ArrowRight" ||
        e.code === "KeyJ" || e.code === "KeyL";

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }

      switch (e.code) {
        case "Space":
        case "KeyK":
          handleTogglePlay();
          break;
        case "ArrowLeft":
          if (e.ctrlKey || e.metaKey) {
            if (!e.repeat) startContinuousSeek(-1);
          } else {
            video.seek(Math.max(0, video.getCurrentTime() - FINE_STEP));
          }
          break;
        case "ArrowRight":
          if (e.ctrlKey || e.metaKey) {
            if (!e.repeat) startContinuousSeek(1);
          } else {
            video.seek(Math.min(video.getDuration(), video.getCurrentTime() + FINE_STEP));
          }
          break;
        case "KeyJ":
          video.seek(Math.max(0, video.getCurrentTime() - 1));
          break;
        case "KeyL":
          video.seek(Math.min(video.getDuration(), video.getCurrentTime() + 1));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        stopContinuousSeek();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [handleTogglePlay, startContinuousSeek, stopContinuousSeek, selectedId, handleUpdateSentence, handleSaveProject, handleSaveProjectAs]);

  // ── Export ──
  const handleExport = useCallback(() => {
    if (sentences.length === 0) {
      setStatusMsg("没有可导出的句子");
      return;
    }
    const data = sentences.map((s) => ({
      id: s.id,
      start: Math.round(s.start * 100) / 100,
      end: Math.round(s.end * 100) / 100,
      heard: s.heard ?? Boolean(s.text || s.englishText || s.chineseText),
      englishText: s.englishText,
      chineseText: s.chineseText,
      style: s.style,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sentences.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(`已导出 ${sentences.length} 句`);
  }, [sentences]);

  // ── Video callbacks ──
  const handleTimeUpdate = useCallback((t: number) => setCurrentTime(t), []);
  const handleDurationChange = useCallback((d: number) => setDuration(d), []);
  const handlePlay = useCallback(() => setPlaying(true), []);
  const handlePause = useCallback(() => setPlaying(false), []);
  const handleAspectRatio = useCallback((ratio: number) => setVideoAspect(ratio), []);

  const isIdle = !videoSrc;

  return (
    <div className="app">
      <div className="main-content">
        <WindowControls
          hasVideo={!!videoSrc}
          videoName={videoName}
          sentenceCount={sentences.length}
          isDirty={isDirty}
          playbackRate={playbackRate}
          showSafeArea={showSafeArea}
          onFileSelect={handleFileSelect}
          onNewFile={handleNewFile}
          onExport={handleExport}
          onPlaybackRateChange={handlePlaybackRateChange}
          onToggleSafeArea={() => setShowSafeArea((value) => !value)}
          onSaveProject={handleSaveProject}
          onOpenProject={handleOpenProject}
          onSaveProjectAs={handleSaveProjectAs}
        />

      <div className="editor">
        {isIdle ? (
          <div className="welcome">
            <FileImport onFileSelect={handleFileSelect} />
            <div className="welcome-hint">
              {sentences.length > 0 && videoName
                ? `请导入视频文件: ${videoName}`
                : "导入 MKV / MP4 / WebM 视频，开始剪辑英语句子"}
            </div>
          </div>
        ) : (
          <>
            <div className="editor-top">
              <div className="sidebar">
                <div className="sidebar-header">
                  <span className="sidebar-title">句子列表</span>
                  <span className="sidebar-count">{sentences.length}</span>
                </div>
                <SentenceList
                  sentences={sentences}
                  selectedId={selectedId}
                  currentTime={currentTime}
                  filter={sentenceFilter}
                  stats={sentenceStats}
                  onFilterChange={setSentenceFilter}
                  onSelect={handleSelectSentence}
                  onPlay={handlePlaySentence}
                  onDelete={handleDeleteSentence}
                  onEdit={setEditingSentence}
                  onToggleHeard={handleToggleSentenceHeard}
                />
              </div>

              <div className="video-area">
                <VideoPlayer
                  ref={playerRef}
                  videoSrc={videoSrc}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onAspectRatio={handleAspectRatio}
                  playbackRate={playbackRate}
                  sentences={sentences}
                  currentTime={currentTime}
                  showSafeArea={showSafeArea}
                />
              </div>
            </div>

            <div className="timeline-area">
              <Timeline
                sentences={sentences}
                currentTime={currentTime}
                duration={duration}
                videoSrc={videoSrc}
                playing={playing}
                cutPhase={cutPhase}
                pendingStart={pendingStart}
                selectedId={selectedId}
                qualityIssues={timelineIssues}
                onSeek={handleSeek}
                onCut={handleTimelineCut}
                onSetCutStart={handleSetCutStart}
                onSetCutEnd={handleSetCutEnd}
                onTogglePlay={handleTogglePlay}
                onUpdateSentence={handleUpdateSentence}
                onDeleteSentence={handleDeleteSentence}
                onSelectSentence={handleSelectSentence}
                onToggleSentenceHeard={handleToggleSentenceHeard}
              />
            </div>
          </>
        )}
      </div>

      {statusMsg && <div className="status-bar">{statusMsg}</div>}

      {editingSentence && videoSrc && (
        <SentenceEditorModal
          sentence={editingSentence}
          sentences={sentences}
          videoSrc={videoSrc}
          onUpdate={handleUpdateSentence}
          onClose={() => setEditingSentence(null)}
          onSubmitAndPrev={handlePrevSentence}
          onSubmitAndNext={handleNextSentence}
          stylePresets={stylePresets}
          onSavePreset={(preset) => {
            setIsDirty(true);
            setStylePresets(prev => {
              const existing = prev.find((item) => item.id === preset.id);
              if (!existing) return [...prev, preset];
              return prev.map((item) => item.id === preset.id ? preset : item);
            });
          }}
          onDeletePreset={(presetId) => {
            setIsDirty(true);
            setStylePresets(prev => prev.filter(p => p.id !== presetId));
          }}
        />
      )}
      </div>
    </div>
  );
}
