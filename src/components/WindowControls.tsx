import { useRef } from "react";
import "./WindowControls.css";

interface Props {
  hasVideo: boolean;
  sentenceCount: number;
  playbackRate: number;
  onFileSelect: (file: File) => void;
  onNewFile: () => void;
  onExport: () => void;
  onPlaybackRateChange: (rate: number) => void;
}

export default function WindowControls({
  hasVideo,
  sentenceCount,
  playbackRate,
  onFileSelect,
  onNewFile,
  onExport,
  onPlaybackRateChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleMinimize = () => {
    (window as any).electron?.minimize();
  };

  const handleMaximize = () => {
    (window as any).electron?.maximize();
  };

  const handleClose = () => {
    (window as any).electron?.close();
  };

  const handleImport = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div className="window-controls" onMouseDown={(e) => {
      if ((e.target as HTMLElement).closest(".window-actions, .window-buttons, select, button")) {
        return;
      }
      (window as any).electron?.drag();
    }}>
      {/* Left side: Title and Toolbar actions */}
      <div className="window-left">
        <div className="window-title">EchoCut</div>
        <div className="window-actions" onMouseDown={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="file"
            accept=".mkv,.mp4,.webm,.avi,.mov"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button className="window-action-btn" onClick={handleImport}>
            导入
          </button>
          {hasVideo && (
            <button className="window-action-btn" onClick={onNewFile}>
              新视频
            </button>
          )}
        </div>
      </div>

      {/* Right side: Playback rate, export button and window controls */}
      <div className="window-right">
        {hasVideo && (
          <label className="window-speed">
            <select
              value={playbackRate}
              onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </label>
        )}
        {hasVideo && sentenceCount > 0 && (
          <button className="window-export-btn" onClick={onExport}>
            导出 ({sentenceCount})
          </button>
        )}
        <div className="window-buttons">
          <button className="window-btn window-btn-min" onClick={handleMinimize} title="最小化">
            <span className="btn-icon">—</span>
          </button>
          <button className="window-btn window-btn-max" onClick={handleMaximize} title="最大化">
            <span className="btn-icon">□</span>
          </button>
          <button className="window-btn window-btn-close" onClick={handleClose} title="关闭">
            <span className="btn-icon">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}