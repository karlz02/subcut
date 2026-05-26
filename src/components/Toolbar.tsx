import { useRef } from "react";

interface Props {
  hasVideo: boolean;
  sentenceCount: number;
  playbackRate: number;
  onFileSelect: (file: File) => void;
  onNewFile: () => void;
  onExport: () => void;
  onPlaybackRateChange: (rate: number) => void;
}

export default function Toolbar({
  hasVideo,
  sentenceCount,
  playbackRate,
  onFileSelect,
  onNewFile,
  onExport,
  onPlaybackRateChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">EchoCut</span>
        <input
          ref={inputRef}
          type="file"
          accept=".mkv,.mp4,.webm,.avi,.mov"
          onChange={handleChange}
          style={{ display: "none" }}
        />
        <button className="btn btn-ghost" onClick={handleImport}>
          导入
        </button>
        {hasVideo && (
          <button className="btn btn-ghost" onClick={onNewFile}>
            新视频
          </button>
        )}
      </div>

      <div className="toolbar-right">
        {hasVideo && (
          <label className="toolbar-speed">
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
          <button className="btn btn-primary" onClick={onExport}>
            导出 ({sentenceCount})
          </button>
        )}
      </div>
    </div>
  );
}
