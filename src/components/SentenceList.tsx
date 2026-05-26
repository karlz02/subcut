import { useState, useEffect } from "react";
import type { Sentence } from "../types";
import { formatTimeCompact } from "../utils/timeFormat";

interface Props {
  sentences: Sentence[];
  selectedId: string | null;
  currentTime: number;
  onSelect: (id: string | null) => void;
  onPlay: (sentence: Sentence) => void;
  onDelete: (id: string) => void;
  onEdit: (sentence: Sentence) => void;
  onToggleHeard?: (id: string, heard: boolean) => void;
}

export default function SentenceList({
  sentences,
  selectedId,
  currentTime,
  onSelect,
  onPlay,
  onDelete,
  onEdit,
  onToggleHeard,
}: Props) {
  if (sentences.length === 0) {
    return (
      <div className="sentence-list">
        <div className="sentence-empty">
          <div className="sentence-empty-icon"></div>
          <div>Ctrl + 左键设起点</div>
          <div>Ctrl + 右键设终点</div>
        </div>
      </div>
    );
  }

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sentenceId: string } | null>(null);

  const handleCardContextMenu = (e: React.MouseEvent, sentence: Sentence) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, sentenceId: sentence.id });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => closeContextMenu();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeContextMenu(); };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  return (
    <div className="sentence-list">
      {sentences.map((s, i) => {
        const selected = s.id === selectedId;
        const displayText = s.text || "";
        return (
          <div
            key={s.id}
            className={`sentence-card ${selected ? "selected" : ""}`}
            onClick={() => onSelect(s.id)}
            onContextMenu={(e) => handleCardContextMenu(e, s)}
          >
            <div className="sentence-card-header">
              <span className="sentence-card-index">
                {String(i + 1).padStart(3, "0")}
              </span>
              <div className="sentence-card-actions">
                <button
                  className="sentence-action-btn"
                  title="播放"
                  onClick={(e) => { e.stopPropagation(); onPlay(s); }}
                >
                  ▶
                </button>
                <button
                  className="sentence-action-btn"
                  title="编辑字幕"
                  onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                >
                  ✎
                </button>
                <button
                  className="sentence-action-btn sentence-action-delete"
                  title="删除"
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="sentence-card-time">
              {formatTimeCompact(s.start)} → {formatTimeCompact(s.end)}
            </div>

            {displayText && <div className="sentence-card-text">{displayText}</div>}
          </div>
        );
      })}

      {/* Context Menu */}
      {contextMenu && onToggleHeard && (
        <div
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "var(--bg-tertiary, #2d3748)",
            border: "1px solid var(--border, #4a5568)",
            borderRadius: "6px",
            padding: "4px",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            style={{
              display: "block",
              width: "100%",
              padding: "6px 12px",
              background: "transparent",
              border: "none",
              color: "#4299e1",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "12px",
              borderRadius: "3px",
            }}
            onClick={() => {
              onToggleHeard(contextMenu.sentenceId, true);
              closeContextMenu();
            }}
          >
            ● 听出
          </button>
          <button
            style={{
              display: "block",
              width: "100%",
              padding: "6px 12px",
              background: "transparent",
              border: "none",
              color: "#ff4a4a",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "12px",
              borderRadius: "3px",
            }}
            onClick={() => {
              onToggleHeard(contextMenu.sentenceId, false);
              closeContextMenu();
            }}
          >
            ● 未听出
          </button>
        </div>
      )}
    </div>
  );
}
