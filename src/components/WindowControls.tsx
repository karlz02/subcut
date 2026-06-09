import { useRef, useState, useEffect } from "react";
import "./WindowControls.css";

interface Props {
  hasVideo: boolean;
  videoName: string | null;
  sentenceCount: number;
  isDirty: boolean;
  playbackRate: number;
  showSafeArea: boolean;
  onFileSelect: (file: File) => void;
  onNewFile: () => void;
  onExport: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleSafeArea: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onSaveProjectAs: () => void;
}

export default function WindowControls({
  hasVideo,
  videoName,
  sentenceCount,
  isDirty,
  playbackRate,
  showSafeArea,
  onFileSelect,
  onNewFile,
  onExport,
  onPlaybackRateChange,
  onToggleSafeArea,
  onSaveProject,
  onOpenProject,
  onSaveProjectAs,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showProjectMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProjectMenu]);

  const handleProjectAction = (action: () => void) => {
    action();
    setShowProjectMenu(false);
  };

  return (
    <div className="window-controls" onMouseDown={(e) => {
      if ((e.target as HTMLElement).closest(".window-actions, .window-buttons, select, button, .project-menu-container")) {
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
          <div className="project-menu-container" ref={menuRef}>
            <button
              className="window-action-btn"
              onClick={() => setShowProjectMenu(!showProjectMenu)}
            >
              工程
            </button>
            {showProjectMenu && (
              <div className="project-dropdown">
                <button
                  className="project-dropdown-item"
                  onClick={() => handleProjectAction(onOpenProject)}
                >
                  打开工程
                </button>
                <button
                  className="project-dropdown-item"
                  onClick={() => handleProjectAction(onSaveProject)}
                >
                  保存工程
                </button>
                <button
                  className="project-dropdown-item"
                  onClick={() => handleProjectAction(onSaveProjectAs)}
                >
                  另存为（含视频）
                </button>
              </div>
            )}
          </div>
        </div>
        {(hasVideo || videoName) && (
          <div className="window-project-meta" title={videoName ?? "未命名视频"}>
            <span className="window-project-name">{videoName ?? "未命名视频"}</span>
            <span className="window-project-count">{sentenceCount} 句</span>
            {isDirty && <span className="window-dirty-badge">未保存</span>}
          </div>
        )}
      </div>

      {/* Right side: Playback rate, export button and window controls */}
      <div className="window-right">
        {hasVideo && (
          <button
            type="button"
            className={`window-action-btn window-safe-area-btn${showSafeArea ? " active" : ""}`}
            onClick={onToggleSafeArea}
            title="显示/隐藏字幕安全区"
          >
            安全区
          </button>
        )}
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
