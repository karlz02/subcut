import { useState, useCallback, useRef, useEffect } from "react";
import type { Sentence, CutPhase } from "./types";
import { DEFAULT_EN_STYLE, DEFAULT_CN_STYLE } from "./types";
import { formatTimeCompact } from "./utils/timeFormat";
import { useProjectStorage } from "./hooks/useLocalStorage";
import VideoPlayer from "./components/VideoPlayer";
import type { VideoPlayerHandle } from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import SentenceList from "./components/SentenceList";
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

export default function App() {
  const { sentences, setSentences, setVideoName, stylePresets, setStylePresets } = useProjectStorage();

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
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

  // Navigation handlers for modal
  const handlePrevSentence = useCallback(() => {
    if (!editingSentence) return;
    const idx = sentencesRef.current.findIndex((s) => s.id === editingSentence.id);
    if (idx > 0) {
      setEditingSentence(sentencesRef.current[idx - 1]);
    }
  }, [editingSentence]);

  const handleNextSentence = useCallback(() => {
    if (!editingSentence) return;
    const idx = sentencesRef.current.findIndex((s) => s.id === editingSentence.id);
    if (idx < sentencesRef.current.length - 1) {
      setEditingSentence(sentencesRef.current[idx + 1]);
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
      setVideoName(file.name);
      setCutPhase("waiting-start");
      setPendingStart(null);
      setSelectedId(null);
      setAbLoopEnd(null);
      setPlaying(false);
      setCurrentTime(0);
      setVideoAspect(16 / 9);
      setStatusMsg(`已加载: ${file.name}`);
    },
    [videoSrc, setVideoName]
  );

  const handleNewFile = useCallback(() => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);
    setCutPhase("waiting-start");
    setPendingStart(null);
    setSelectedId(null);
    setAbLoopEnd(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVideoAspect(16 / 9);
    setStatusMsg("");
  }, [videoSrc]);

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
      englishText: "",
      chineseText: "",
      style: { english: { ...DEFAULT_EN_STYLE }, chinese: { ...DEFAULT_CN_STYLE } },
    };
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
      setSentences((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    [setSentences]
  );

  const handleDeleteSentence = useCallback(
    (id: string) => {
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
      setSentences((prev) =>
        prev.map((s) => {
          if (s.id === id) {
            return {
              ...s,
              text: heard ? s.text : "",
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
  }, [handleTogglePlay, startContinuousSeek, stopContinuousSeek, selectedId, handleUpdateSentence]);

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
      <WindowControls
        hasVideo={!!videoSrc}
        sentenceCount={sentences.length}
        playbackRate={playbackRate}
        onFileSelect={handleFileSelect}
        onNewFile={handleNewFile}
        onExport={handleExport}
        onPlaybackRateChange={handlePlaybackRateChange}
      />

      <div className="editor">
        {isIdle ? (
          <div className="welcome">
            <FileImport onFileSelect={handleFileSelect} />
            <div className="welcome-hint">
              导入 MKV / MP4 / WebM 视频，开始剪辑英语句子
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
          onSubmitAndNext={handleNextSentence}
          stylePresets={stylePresets}
          onSavePreset={(preset) => setStylePresets(prev => [...prev, preset])}
          onDeletePreset={(presetId) => setStylePresets(prev => prev.filter(p => p.id !== presetId))}
        />
      )}
    </div>
  );
}
