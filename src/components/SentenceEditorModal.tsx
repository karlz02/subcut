import { useRef, useEffect, useState, useCallback, type MouseEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Sentence, SubtitleStyle, StylePreset } from "../types";
import { formatTimeCompact } from "../utils/timeFormat";
import CSSSubtitleRenderer from "./CSSSubtitleRenderer";
import SubtitleStylePanel from "./SubtitleStylePanel";
import "./SentenceEditorModal.css";

interface Props {
  sentence: Sentence;
  sentences: Sentence[];
  videoSrc: string;
  stylePresets: StylePreset[];
  onUpdate: (id: string, updates: Partial<Sentence>) => void;
  onClose: () => void;
  onSubmitAndPrev: () => void;
  onSubmitAndNext: () => void;
  onSavePreset: (preset: StylePreset) => void;
  onDeletePreset: (id: string) => void;
}

const STYLE_PANEL_WIDTH = 500;
const STYLE_PANEL_RIGHT_MARGIN = 24;
const STYLE_PANEL_TOP = 60;

export default function SentenceEditorModal({
  sentence, sentences, videoSrc, stylePresets,
  onUpdate, onClose, onSubmitAndPrev, onSubmitAndNext, onSavePreset, onDeletePreset,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);

  // 样式面板拖动状态
  const [panelPos, setPanelPos] = useState({ x: 20, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const getRightPanelPosition = useCallback(() => {
    const modalWidth = modalRef.current?.clientWidth ?? Math.min(window.innerWidth * 0.95, 1400);
    return {
      x: Math.max(STYLE_PANEL_RIGHT_MARGIN, modalWidth - STYLE_PANEL_WIDTH - STYLE_PANEL_RIGHT_MARGIN),
      y: STYLE_PANEL_TOP,
    };
  }, []);

  const handleToggleStylePanel = useCallback(() => {
    if (showStylePanel) {
      setShowStylePanel(false);
      return;
    }
    setPanelPos(getRightPanelPosition());
    setShowStylePanel(true);
  }, [getRightPanelPosition, showStylePanel]);

  // 拖动开始
  const handleDragStart = (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y,
    });
    e.preventDefault();
  };

  // 拖动中
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPanelPos({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
    e.preventDefault();
  }, [isDragging, dragStart]);

  // 拖动结束
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Local state
  const [englishText, setEnglishText] = useState(sentence.englishText || sentence.text || "");
  const [chineseText, setChineseText] = useState(sentence.chineseText);
  const [enStyle, setEnStyle] = useState<SubtitleStyle>({ ...sentence.style.english });
  const [cnStyle, setCnStyle] = useState<SubtitleStyle>({ ...sentence.style.chinese });

  // Video progress bar state
  const [videoTime, setVideoTime] = useState(0);
  const [videoDur, setVideoDur] = useState(0);
  const [progressHover, setProgressHover] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentIndex = sentences.findIndex((item) => item.id === sentence.id);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < sentences.length - 1;
  const sentenceDuration = Math.max(sentence.end - sentence.start, 0.01);
  const sentenceProgress = Math.max(0, Math.min(1, (videoTime - sentence.start) / sentenceDuration));
  const sentenceProgressTime = sentence.start + sentenceProgress * sentenceDuration;

  // Sync local editor state when navigating between sentences.
  useEffect(() => {
    setEnglishText(sentence.englishText || sentence.text || "");
    setChineseText(sentence.chineseText);
    setEnStyle({ ...sentence.style.english });
    setCnStyle({ ...sentence.style.chinese });
  }, [sentence.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 监听全局鼠标移动和抬起事件
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent) => handleDragMove(e as any);
      const handleUp = () => handleDragEnd();
      window.addEventListener("mousemove", handleMove as any);
      window.addEventListener("mouseup", handleUp);
      return () => {
        window.removeEventListener("mousemove", handleMove as any);
        window.removeEventListener("mouseup", handleUp);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Save text on blur
  const saveText = useCallback(() => {
    const updates: Partial<Sentence> = {};
    if (englishText !== sentence.englishText) updates.englishText = englishText;
    if (chineseText !== sentence.chineseText) updates.chineseText = chineseText;
    if (Object.keys(updates).length > 0) onUpdate(sentence.id, updates);
  }, [englishText, chineseText, sentence.id, sentence.englishText, sentence.chineseText, onUpdate]);

  // 合并保存：同时保存文本和样式，避免数据不一致
  const saveAll = useCallback(() => {
    const updates: Partial<Sentence> = {
      style: { english: enStyle, chinese: cnStyle },
    };
    if (englishText !== sentence.englishText) updates.englishText = englishText;
    if (chineseText !== sentence.chineseText) updates.chineseText = chineseText;
    if (Object.keys(updates).length > 0) onUpdate(sentence.id, updates);
  }, [englishText, chineseText, enStyle, cnStyle, sentence.id, sentence.englishText, sentence.chineseText, onUpdate]);

  const navigateSentence = useCallback(
    (direction: -1 | 1) => {
      saveAll();
      if (direction < 0) onSubmitAndPrev();
      else onSubmitAndNext();
    },
    [onSubmitAndNext, onSubmitAndPrev, saveAll]
  );

  // Video AB Loop + time tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      video.currentTime = sentence.start;
      setVideoTime(sentence.start);
      setVideoDur(video.duration || 0);
    };
    const handleTimeUpdate = () => {
      setVideoTime(video.currentTime);
      if (video.currentTime >= sentence.end - 0.03) {
        video.pause();
        video.currentTime = sentence.start;
        setPlaying(false);
      }
    };
    const handleDuration = () => setVideoDur(video.duration || 0);
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDuration);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.currentTime = sentence.start;
    setVideoTime(sentence.start);
    if (video.duration) setVideoDur(video.duration);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDuration);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [sentence.id, sentence.start, sentence.end]);

  const handleSingleLineKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
    }
  };

  // Keyboard: Escape closes style panel first, then modal. Ctrl+Enter = submit.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showStylePanel) { setShowStylePanel(false); return; }
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        saveText();
        onSubmitAndNext();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, showStylePanel, saveText, onSubmitAndNext]);

  const handleVideoClick = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.currentTime = sentence.start; v.play(); }
    else v.pause();
  };

  const handleProgressClick = (e: MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = sentence.start + ratio * sentenceDuration;
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container" ref={modalRef}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-header-title">
              {formatTimeCompact(sentence.start)} → {formatTimeCompact(sentence.end)}
            </span>
            <span className="modal-header-progress">
              正在播放：{currentIndex + 1}/{sentences.length}
            </span>
          </div>
          <div className="modal-header-right">
            <button className={`modal-style-btn${showStylePanel ? " active" : ""}`} onClick={handleToggleStylePanel}>样式</button>
            <button className="modal-close-btn" onClick={() => { saveAll(); onClose(); }}>✕</button>
          </div>
        </div>

        {/* Content: Video only */}
        <div className="modal-content">
          {/* Video Area */}
          <div className="modal-video-area" key={`${videoSrc}-${sentence.id}`}>
            <video 
              ref={videoRef} 
              src={videoSrc} 
              className="modal-video" 
              onClick={handleVideoClick} 
            />
            <button
              type="button"
              className="modal-side-nav modal-side-nav-left"
              title="上一句"
              disabled={!canGoPrev || showStylePanel}
              onClick={(e) => { e.stopPropagation(); navigateSentence(-1); }}
            >
              <span className="modal-side-nav-icon">‹</span>
            </button>
            <button
              type="button"
              className="modal-side-nav modal-side-nav-right"
              title="下一句"
              disabled={!canGoNext || showStylePanel}
              onClick={(e) => { e.stopPropagation(); navigateSentence(1); }}
            >
              <span className="modal-side-nav-icon">›</span>
            </button>
            {/* CSS Subtitle Renderer */}
            <CSSSubtitleRenderer
              englishText={englishText || ""}
              chineseText={chineseText || ""}
              englishStyle={enStyle}
              chineseStyle={cnStyle}
            />
            {/* Bilibili-style hidden progress bar */}
            <div
              ref={progressRef}
              className={`modal-progress-bar${progressHover ? " hover" : ""}`}
              onMouseEnter={() => setProgressHover(true)}
              onMouseLeave={() => setProgressHover(false)}
              onClick={handleProgressClick}
            >
              <div className="modal-progress-track">
                <div className="modal-progress-filled" style={{
                  width: `${sentenceProgress * 100}%`,
                }} />
              </div>
              {progressHover && videoDur > 0 && (
                <div className="modal-progress-time" style={{
                  left: `${sentenceProgress * 100}%`,
                }}>
                  {formatTimeCompact(sentenceProgressTime)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Style Panel (floating, draggable) */}
        {showStylePanel && (
          <div
            className="style-panel-floating"
            style={{
              position: "absolute",
              left: `${panelPos.x}px`,
              top: `${panelPos.y}px`,
              zIndex: 40,
            }}
          >
            <div className="style-panel-header-draggable" onMouseDown={handleDragStart}>
              <button
                className="style-panel-close"
                onClick={() => setShowStylePanel(false)}
              >
                ✕
              </button>
            </div>
            <SubtitleStylePanel
              englishStyle={enStyle}
              chineseStyle={cnStyle}
              updateStyle={(lang, updates) => {
                if (lang === 'english') {
                  setEnStyle((prev) => ({ ...prev, ...updates }));
                } else {
                  setCnStyle((prev) => ({ ...prev, ...updates }));
                }
              }}
              stylePresets={stylePresets}
              onSavePreset={onSavePreset}
              onDeletePreset={onDeletePreset}
              onApplyPreset={(preset) => {
                setEnStyle({ ...preset.english });
                setCnStyle({ ...preset.chinese });
                onUpdate(sentence.id, { style: { english: preset.english, chinese: preset.chinese } });
              }}
            />
          </div>
        )}

        {/* Input Area */}
        <div className="modal-input-area">
          <div className="modal-input-row">
            <span className="modal-input-label">EN</span>
            <textarea
              className="modal-input-field"
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value.replace(/[\r\n]+/g, " "))}
              onBlur={saveText}
              onKeyDown={handleSingleLineKeyDown}
              placeholder="Enter English subtitle..."
              rows={1}
              wrap="off"
            />
          </div>
          <div className="modal-input-row">
            <span className="modal-input-label">CN</span>
            <textarea
              className="modal-input-field"
              value={chineseText}
              onChange={(e) => setChineseText(e.target.value.replace(/[\r\n]+/g, " "))}
              onBlur={saveText}
              onKeyDown={handleSingleLineKeyDown}
              placeholder="输入中文字幕..."
              rows={1}
              wrap="off"
            />
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="modal-bottom">
          <button className="modal-submit-btn" onClick={() => { saveAll(); onSubmitAndNext(); }}>
            提交并下一句
          </button>
        </div>
      </div>
    </div>
  );
}
