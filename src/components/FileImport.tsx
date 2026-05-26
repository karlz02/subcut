import { useCallback, useRef } from "react";

interface Props {
  onFileSelect: (file: File) => void;
}

export default function FileImport({ onFileSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div
      className="file-import"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mkv,.mp4,.webm,.avi,.mov"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <div className="file-import-content">
        <span className="file-import-icon">+</span>
        <span>拖拽视频文件到此处，或点击选择</span>
        <span className="file-import-hint">支持 MKV / MP4 / WebM</span>
      </div>
    </div>
  );
}
