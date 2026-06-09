import { useState, useEffect, useMemo } from "react";
import type { Sentence } from "../types";
import { formatTimeCompact } from "../utils/timeFormat";

export type SentenceFilter = "all" | "heard" | "unheard" | "empty";

export interface SentenceStats {
  total: number;
  heard: number;
  unheard: number;
  empty: number;
  subtitleDuration: number;
  subtitleSharePercent: number;
}

interface Props {
  sentences: Sentence[];
  selectedId: string | null;
  currentTime: number;
  filter: SentenceFilter;
  stats: SentenceStats;
  onFilterChange: (filter: SentenceFilter) => void;
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
  filter,
  stats,
  onFilterChange,
  onSelect,
  onPlay,
  onDelete,
  onEdit,
  onToggleHeard,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sentenceId: string } | null>(null);

  const filteredSentences = useMemo(() => {
    if (filter === "all") return sentences;

    return sentences.filter((sentence) => {
      const englishText = (sentence.englishText || sentence.text || "").trim();
      const chineseText = (sentence.chineseText || "").trim();
      const hasSubtitleText = Boolean(englishText || chineseText);
      const isHeard = sentence.heard ?? hasSubtitleText;

      if (filter === "heard") return isHeard;
      if (filter === "unheard") return !isHeard;
      if (filter === "empty") return !hasSubtitleText;
      return true;
    });
  }, [filter, sentences]);

  const filterItems: { value: SentenceFilter; label: string; count: number }[] = [
    { value: "all", label: "全部", count: stats.total },
    { value: "heard", label: "已听出", count: stats.heard },
    { value: "unheard", label: "未听出", count: stats.unheard },
    { value: "empty", label: "无文本", count: stats.empty },
  ];

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
    <div className="sentence-panel">
      <div className="sentence-summary">
        <div className="sentence-summary-grid">
          <div className="sentence-summary-item">
            <span>总数</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="sentence-summary-item heard">
            <span>听出</span>
            <strong>{stats.heard}</strong>
          </div>
          <div className="sentence-summary-item unheard">
            <span>未听</span>
            <strong>{stats.unheard}</strong>
          </div>
          <div className="sentence-summary-item empty">
            <span>无文本</span>
            <strong>{stats.empty}</strong>
          </div>
        </div>
        <div
          className="sentence-coverage"
          title={`字幕片段总时长 ${stats.subtitleDuration.toFixed(1)} 秒。对白天然会有停顿，不需要达到 100%。`}
        >
          <span>占比</span>
          <div className="sentence-coverage-track">
            <div
              className="sentence-coverage-fill"
              style={{ width: `${Math.max(0, Math.min(100, stats.subtitleSharePercent))}%` }}
            />
          </div>
          <strong>{Math.round(stats.subtitleSharePercent)}%</strong>
        </div>
      </div>

      <div className="sentence-filter-bar">
        {filterItems.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`sentence-filter-btn${filter === item.value ? " active" : ""}`}
            onClick={() => onFilterChange(item.value)}
          >
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </div>

      <div className="sentence-list">
        {sentences.length === 0 ? (
          <div className="sentence-empty">
            <div className="sentence-empty-icon"></div>
            <div>Ctrl + 左键设起点</div>
            <div>Ctrl + 右键设终点</div>
          </div>
        ) : filteredSentences.length === 0 ? (
          <div className="sentence-empty">
            <div>没有符合筛选的句子</div>
            <button type="button" className="sentence-empty-reset" onClick={() => onFilterChange("all")}>
              显示全部
            </button>
          </div>
        ) : (
          <>
            {filteredSentences.map((s) => {
            const originalIndex = sentences.findIndex((item) => item.id === s.id);
            const selected = s.id === selectedId;
            const isCurrent = currentTime >= s.start && currentTime < s.end;
            const isHeard = s.heard ?? Boolean(s.text || s.englishText || s.chineseText);
            const englishText = s.englishText || s.text || "";
            const chineseText = s.chineseText || "";
            const hasSubtitleText = Boolean(englishText || chineseText);
            const duration = Math.max(0, s.end - s.start);
            return (
              <div
                key={s.id}
                className={[
                  "sentence-card",
                  isHeard ? "heard" : "unheard",
                  selected ? "selected" : "",
                  isCurrent ? "current" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelect(s.id)}
                onContextMenu={(e) => handleCardContextMenu(e, s)}
              >
                <span className="sentence-card-status" />
                <div className="sentence-card-main">
                  <div className="sentence-card-header">
                    <div className="sentence-card-meta">
                      <span className="sentence-card-index">
                        {String(originalIndex + 1).padStart(3, "0")}
                      </span>
                      <span className="sentence-card-state">
                        {isHeard ? "听出" : "未听出"}
                      </span>
                    </div>
                    <div className="sentence-card-actions">
                      <button
                        type="button"
                        className="sentence-action-btn"
                        title="播放"
                        onClick={(e) => { e.stopPropagation(); onPlay(s); }}
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="sentence-action-btn"
                        title="编辑字幕"
                        onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="sentence-action-btn sentence-action-delete"
                        title="删除"
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="sentence-card-time-row">
                    <span className="sentence-card-time">
                      {formatTimeCompact(s.start)} → {formatTimeCompact(s.end)}
                    </span>
                    <span className="sentence-card-duration">{duration.toFixed(2)}s</span>
                  </div>

                  <div className={`sentence-card-text ${hasSubtitleText ? "" : "empty"}`}>
                    {hasSubtitleText ? (
                      <>
                        {englishText && <span className="sentence-card-text-line">{englishText}</span>}
                        {chineseText && <span className="sentence-card-text-line secondary">{chineseText}</span>}
                      </>
                    ) : (
                      "未填写字幕"
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && onToggleHeard && (
        <div
          className="sentence-context-menu"
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="sentence-context-item heard"
            onClick={() => {
              onToggleHeard(contextMenu.sentenceId, true);
              closeContextMenu();
            }}
          >
            <span>●</span>
            听出
          </button>
          <button
            type="button"
            className="sentence-context-item unheard"
            onClick={() => {
              onToggleHeard(contextMenu.sentenceId, false);
              closeContextMenu();
            }}
          >
            <span>●</span>
            未听出
          </button>
        </div>
      )}
    </div>
  );
}
