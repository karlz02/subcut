import { useRef, useEffect, useState, useCallback, type MouseEvent } from "react";
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
  onSubmitAndNext: () => void;
  onSavePreset: (name: string, english: SubtitleStyle, chinese: SubtitleStyle) => void;
  onDeletePreset: (id: string) => void;
}

export default function SentenceEditorModal({
  sentence, sentences, videoSrc, stylePresets,
  onUpdate, onClose, onSubmitAndNext, onSavePreset, onDeletePreset,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Local state
  const [englishText, setEnglishText] = useState(sentence.englishText);
  const [chineseText, setChineseText] = useState(sentence.chineseText);
  const [enStyle, setEnStyle] = useState<SubtitleStyle>({ ...sentence.style.english });
  const [cnStyle, setCnStyle] = useState<SubtitleStyle>({ ...sentence.style.chinese });

  // Video progress bar state
  const [videoTime, setVideoTime] = useState(0);
  const [videoDur, setVideoDur] = useState(0);
  const [progressHover, setProgressHover] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // 用于阻断重复初始化的 ref
  const initDoneRef = useRef(false);

  // Sync on sentence change - 使用 ref 阻断重复初始化
  useEffect(() => {
    // 只在第一次打开或切换句子时初始化
    if (!initDoneRef.current) {
      initDoneRef.current = true;
      setEnglishText(sentence.englishText);
      setChineseText(sentence.chineseText);
      setEnStyle({ ...sentence.style.english });
      setCnStyle({ ...sentence.style.chinese });
    }
  }, [sentence.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 重置初始化标记（弹窗关闭时）
  useEffect(() => {
    if (!playing && !showStylePanel) {
      initDoneRef.current = false;
    }
  }, [playing, showStylePanel]);

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

  // Video AB Loop + time tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      video.currentTime = sentence.start;
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
    if (video.duration) setVideoDur(video.duration);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDuration);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [sentence.id, sentence.start, sentence.end]);

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
    if (!v || !videoDur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * videoDur;
  };

  const handleApplyPreset = (preset: StylePreset) => {
    setEnStyle({ ...preset.english });
    setCnStyle({ ...preset.chinese });
    onUpdate(sentence.id, { style: { english: preset.english, chinese: preset.chinese } });
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    onSavePreset(name, enStyle, cnStyle);
    setPresetName("");
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-header-title">
              {formatTimeCompact(sentence.start)} → {formatTimeCompact(sentence.end)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              #{sentences.indexOf(sentence) + 1} / {sentences.length}
            </span>
          </div>
          <div className="modal-header-right">
            <button className={`modal-style-btn${showStylePanel ? " active" : ""}`} onClick={() => setShowStylePanel(!showStylePanel)}>样式</button>
            <button className="modal-close-btn" onClick={() => { saveAll(); onClose(); }}>✕</button>
          </div>
        </div>

        {/* Content: Video + optional Style Panel side by side */}
        <div className={`modal-content${showStylePanel ? " with-style" : ""}`}>
          {/* Video Area */}
          <div className="modal-video-area" key={`${videoSrc}-${sentence.id}`}>
            <video 
              ref={videoRef} 
              src={videoSrc} 
              className="modal-video" 
              onClick={handleVideoClick} 
            />
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
                {sentence.start > 0 && videoDur > 0 && (
                  <div className="modal-progress-sentence-range" style={{
                    left: `${(sentence.start / videoDur) * 100}%`,
                    width: `${((sentence.end - sentence.start) / videoDur) * 100}%`,
                  }} />
                )}
                <div className="modal-progress-filled" style={{
                  width: videoDur > 0 ? `${(videoTime / videoDur) * 100}%` : "0%",
                }} />
              </div>
              {progressHover && videoDur > 0 && (
                <div className="modal-progress-time" style={{
                  left: `${(videoTime / videoDur) * 100}%`,
                }}>
                  {formatTimeCompact(videoTime)}
                </div>
              )}
            </div>
          </div>

          {/* Style Panel (side-by-side, not overlay) */}
          {showStylePanel && (
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
            />
          )}
        </div>

        {/* Input Area */}
        <div className="modal-input-area">
          <div className="modal-input-row">
            <span className="modal-input-label">EN</span>
            <textarea
              className="modal-input-field"
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value)}
              onBlur={saveText}
              placeholder="Enter English subtitle..."
              rows={1}
            />
          </div>
          <div className="modal-input-row">
            <span className="modal-input-label">CN</span>
            <textarea
              className="modal-input-field"
              value={chineseText}
              onChange={(e) => setChineseText(e.target.value)}
              onBlur={saveText}
              placeholder="输入中文字幕..."
              rows={1}
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
