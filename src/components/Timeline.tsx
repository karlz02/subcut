import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { Sentence, TimelineIssue } from "../types";
import { formatTimeCompact } from "../utils/timeFormat";
import { useThumbnails } from "../hooks/useThumbnails";

interface TimelineProps {
  sentences: Sentence[];
  currentTime: number;
  duration: number;
  videoSrc: string | null;
  playing: boolean;
  cutPhase: "idle" | "waiting-start" | "start-set";
  pendingStart: number | null;
  selectedId: string | null;
  qualityIssues: TimelineIssue[];
  onSeek: (time: number) => void;
  onCut: (time: number, isStart: boolean) => void;
  onSetCutStart: (time: number) => void;
  onSetCutEnd: (time: number) => void;
  onTogglePlay: () => void;
  onUpdateSentence: (id: string, updates: Partial<Sentence>) => void;
  onDeleteSentence: (id: string) => void;
  onSelectSentence: (id: string | null) => void;
  onToggleSentenceHeard?: (id: string, heard: boolean) => void;
}

type DragType = "playhead" | "block-move" | "block-left" | "block-right" | null;

interface DragState {
  type: DragType;
  sentenceId?: string;
  startX: number;
  startTime: number;
  originStart?: number;
  originEnd?: number;
}

const MIN_ZOOM = 10;
const MAX_ZOOM = 500;
const DEFAULT_ZOOM = 50;
const RULER_HEIGHT = 30;
const FILMSTRIP_HEIGHT = 100;
const BLOCK_HEIGHT = 32;
const BLOCK_TOP = RULER_HEIGHT + FILMSTRIP_HEIGHT + 4;
const HANDLE_WIDTH = 8;
const SNAP_THRESHOLD_PX = 8;

export default function Timeline({
  sentences,
  currentTime,
  duration,
  videoSrc,
  playing,
  cutPhase,
  pendingStart,
  selectedId,
  qualityIssues,
  onSeek,
  onCut,
  onSetCutStart,
  onSetCutEnd,
  onTogglePlay,
  onUpdateSentence,
  onDeleteSentence,
  onSelectSentence,
  onToggleSentenceHeard,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleEnd, setVisibleEnd] = useState(60);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; time: number } | null>(null);
  const [blockContextMenu, setBlockContextMenu] = useState<{ x: number; y: number; sentenceId: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [generateAllThumbs, setGenerateAllThumbs] = useState(false);
  // Snap-to sentence endpoint hover state
  const [snapTarget, setSnapTarget] = useState<{ time: number; type: 'start' | 'end' } | null>(null);

  // Pixels per second
  const pps = zoom;
  const trackWidth = Math.max((duration || 60) * pps, 800);

  // Time ↔ pixel
  const timeToX = useCallback((t: number) => t * pps, [pps]);
  const xToTime = useCallback(
    (x: number) => Math.max(0, Math.min(duration, x / pps)),
    [pps, duration]
  );

  // Update visible range on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const startTime = xToTime(container.scrollLeft);
      const endTime = xToTime(container.scrollLeft + container.clientWidth);
      setVisibleStart(startTime);
      setVisibleEnd(endTime);
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    return () => container.removeEventListener("scroll", update);
  }, [xToTime]);

  // Reload thumbnails (generate all at once)
  const handleReloadThumbnails = useCallback(() => {
    setGenerateAllThumbs(true);
    setReloadKey((k) => k + 1);
  }, []);

  // Thumbnails with LOD
  const { getCellThumbs, generating: thumbGenerating, progress: thumbProgress } =
    useThumbnails(videoSrc, duration, pps, visibleStart, visibleEnd, reloadKey, generateAllThumbs);

  const cellThumbs = useMemo(() => getCellThumbs(), [getCellThumbs]);

  const sentenceIssueTypes = useMemo(() => {
    const issueMap = new Map<string, Set<TimelineIssue["type"]>>();
    for (const issue of qualityIssues) {
      if (!issue.sentenceId) continue;
      const types = issueMap.get(issue.sentenceId) ?? new Set<TimelineIssue["type"]>();
      types.add(issue.type);
      issueMap.set(issue.sentenceId, types);
    }
    return issueMap;
  }, [qualityIssues]);

  // Snap targets
  const snapTargets = useMemo(() => {
    const targets: number[] = [];
    let interval: number;
    if (pps >= 200) interval = 1;
    else if (pps >= 80) interval = 2;
    else if (pps >= 30) interval = 5;
    else if (pps >= 15) interval = 10;
    else interval = 30;
    const sub = Math.max(interval / 5, 0.1);
    for (let t = 0; t <= (duration || 60); t += sub) {
      targets.push(Math.round(t * 100) / 100);
    }
    for (const s of sentences) {
      targets.push(s.start);
      targets.push(s.end);
    }
    return targets;
  }, [duration, pps, sentences]);

  const snapTime = useCallback(
    (time: number): number => {
      const threshold = SNAP_THRESHOLD_PX / pps;
      let closest = time;
      let minDist = threshold;
      for (const t of snapTargets) {
        const d = Math.abs(time - t);
        if (d < minDist) { minDist = d; closest = t; }
      }
      return closest;
    },
    [snapTargets, pps]
  );

  // Auto-scroll playhead
  useEffect(() => {
    const c = containerRef.current;
    if (!c || dragState) return;
    const px = timeToX(currentTime);
    const { scrollLeft, clientWidth } = c;
    const m = clientWidth * 0.1;
    if (px < scrollLeft + m) c.scrollLeft = px - m;
    else if (px > scrollLeft + clientWidth - m) c.scrollLeft = px - clientWidth + m;
  }, [currentTime, timeToX, dragState]);

  // ── Ruler ticks (professional CapCut style) ──
  const { majorTicks, minorTicks } = useMemo(() => {
    const majors: { x: number; label: string }[] = [];
    const minors: { x: number }[] = [];

    // Choose major interval based on zoom
    let majorInterval: number;
    if (pps >= 300) majorInterval = 1;
    else if (pps >= 150) majorInterval = 2;
    else if (pps >= 80) majorInterval = 5;
    else if (pps >= 40) majorInterval = 10;
    else if (pps >= 20) majorInterval = 15;
    else if (pps >= 10) majorInterval = 30;
    else majorInterval = 60;

    // Minor interval = major / N subdivisions
    let subdivisions: number;
    if (majorInterval <= 1) subdivisions = 5;      // 0.2s each
    else if (majorInterval <= 2) subdivisions = 4;  // 0.5s each
    else if (majorInterval <= 5) subdivisions = 5;  // 1s each
    else if (majorInterval <= 10) subdivisions = 5; // 2s each
    else subdivisions = 5;

    const minorInterval = majorInterval / subdivisions;
    const totalDuration = duration || 60;

    for (let t = 0; t <= totalDuration; t += minorInterval) {
      const snapped = Math.round(t * 1000) / 1000;
      const x = timeToX(snapped);
      const isMajor = Math.abs(snapped % majorInterval) < 0.001 || majorInterval >= 5;
      if (isMajor) {
        majors.push({ x, label: formatRulerTime(snapped) });
      } else {
        minors.push({ x });
      }
    }

    return { majorTicks: majors, minorTicks: minors };
  }, [duration, pps, timeToX]);

  // Get mouse X
  const getTrackX = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const c = containerRef.current;
      if (!c) return 0;
      const r = c.getBoundingClientRect();
      return e.clientX - r.left + c.scrollLeft;
    },
    []
  );

  // ── Mouse handlers ──
  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".tl-block")) return;
      if ((e.target as HTMLElement).closest(".tl-playhead-handle")) return;
      const x = getTrackX(e);
      let time = xToTime(x);

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // Alt + Ctrl/Cmd: snap to nearest sentence endpoint
        if (e.altKey) {
          const threshold = SNAP_THRESHOLD_PX / pps * 2;
          let snappedTime = time;
          let minDist = threshold;
          
          // Find nearest sentence endpoint
          for (const s of sentences) {
            // For start point (left click), prefer sentence end points
            if (e.button === 0) {
              const dist = Math.abs(time - s.end);
              if (dist < minDist) {
                minDist = dist;
                snappedTime = s.end;
              }
            } else {
              // For end point (right click), prefer sentence start points
              const dist = Math.abs(time - s.start);
              if (dist < minDist) {
                minDist = dist;
                snappedTime = s.start;
              }
            }
          }
          time = snappedTime;
        } else {
          time = snapTime(time);
        }
        
        onCut(time, e.button === 0);
        return;
      }
      if (e.button !== 0) return;

      const phx = timeToX(currentTime);
      if (Math.abs(x - phx) < 10) {
        setDragState({ type: "playhead", startX: x, startTime: currentTime });
        return;
      }
      onSeek(time);
    },
    [getTrackX, xToTime, timeToX, currentTime, onSeek, onCut, snapTime, sentences, pps]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }, []);

  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, sentence: Sentence, handle: "body" | "left" | "right") => {
      e.stopPropagation();
      onSelectSentence(sentence.id);
      const x = getTrackX(e);
      const dragType: DragType =
        handle === "left" ? "block-left" : handle === "right" ? "block-right" : "block-move";
      setDragState({
        type: dragType, sentenceId: sentence.id,
        startX: x, startTime: xToTime(x),
        originStart: sentence.start, originEnd: sentence.end,
      });
    },
    [getTrackX, xToTime, onSelectSentence]
  );

  // Right-click on block → context menu for heard/unheard
  const handleBlockContextMenu = useCallback(
    (e: React.MouseEvent, sentence: Sentence) => {
      e.preventDefault();
      e.stopPropagation();
      setBlockContextMenu({ x: e.clientX, y: e.clientY, sentenceId: sentence.id });
    },
    []
  );

  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const x = getTrackX(e);
      setDragState({ type: "playhead", startX: x, startTime: currentTime });
    },
    [getTrackX, currentTime]
  );

  // Right-click on playhead → context menu
  const handlePlayheadContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, time: currentTime });
    },
    [currentTime]
  );

  // Close context menu on click outside / Escape
  useEffect(() => {
    if (!contextMenu && !blockContextMenu) return;
    const close = () => {
      setContextMenu(null);
      setBlockContextMenu(null);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", handleKey); };
  }, [contextMenu, blockContextMenu]);

  // Global drag
  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: MouseEvent) => {
      const c = containerRef.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left + c.scrollLeft;
      const time = xToTime(x);

      if (dragState.type === "playhead") {
        onSeek(snapTime(time));
      } else if (dragState.type === "block-move" && dragState.sentenceId && dragState.originStart !== undefined) {
        const dx = x - dragState.startX;
        const dt = dx / pps;
        const dur = dragState.originEnd! - dragState.originStart;
        let ns = dragState.originStart + dt;
        let ne = ns + dur;
        if (ns < 0) { ns = 0; ne = dur; }
        if (ne > duration) { ne = duration; ns = duration - dur; }
        onUpdateSentence(dragState.sentenceId, {
          start: Math.round(ns * 100) / 100, end: Math.round(ne * 100) / 100,
        });
        onSeek(time);
      } else if (dragState.type === "block-left" && dragState.sentenceId && dragState.originStart !== undefined) {
        let ns = Math.min(time, dragState.originEnd! - 0.05);
        ns = Math.max(0, ns);
        const sn = snapTime(ns);
        if (sn < dragState.originEnd! - 0.05) ns = sn;
        onUpdateSentence(dragState.sentenceId, { start: Math.round(ns * 100) / 100 });
        onSeek(ns);
      } else if (dragState.type === "block-right" && dragState.sentenceId && dragState.originEnd !== undefined) {
        let ne = Math.max(time, dragState.originStart! + 0.05);
        ne = Math.min(duration, ne);
        const sn = snapTime(ne);
        if (sn > dragState.originStart! + 0.05) ne = sn;
        onUpdateSentence(dragState.sentenceId, { end: Math.round(ne * 100) / 100 });
        onSeek(ne);
      }
    };
    const handleUp = () => setDragState(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [dragState, xToTime, pps, duration, onSeek, onUpdateSentence, snapTime]);

  // Hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragState) return;
      const x = getTrackX(e);
      const time = xToTime(x);
      setHoverTime(time);

      // Check for snap-to endpoint when Alt is pressed
      if (e.altKey && (e.ctrlKey || e.metaKey)) {
        const threshold = SNAP_THRESHOLD_PX / pps * 2;
        let foundTarget: { time: number; type: 'start' | 'end' } | null = null;
        let minDist = threshold;

        for (const s of sentences) {
          // Check sentence endpoints
          const endDist = Math.abs(time - s.end);
          const startDist = Math.abs(time - s.start);

          if (endDist < minDist) {
            minDist = endDist;
            foundTarget = { time: s.end, type: 'end' };
          }
          if (startDist < minDist) {
            minDist = startDist;
            foundTarget = { time: s.start, type: 'start' };
          }
        }

        setSnapTarget(foundTarget);
      } else {
        setSnapTarget(null);
      }
    },
    [dragState, getTrackX, xToTime, sentences, pps]
  );
  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
    setSnapTarget(null);
  }, []);

  // Wheel: Ctrl=zoom, plain/Shift=horizontal scroll
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * (e.deltaY > 0 ? 0.85 : 1.15))));
        return;
      }
      // Horizontal scroll: use deltaY (vertical wheel) to scroll horizontally
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      const multiplier = e.shiftKey ? 3 : 1;
      c.scrollLeft += delta * multiplier;
    };
    c.addEventListener("wheel", handleWheel, { passive: false });
    return () => c.removeEventListener("wheel", handleWheel);
  }, []);

  // Delete key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        onDeleteSentence(selectedId);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, onDeleteSentence]);

  // Cut range preview
  const cutRangePreview = useMemo(() => {
    if (cutPhase !== "start-set" || pendingStart === null) return null;
    const end = hoverTime ?? currentTime;
    return {
      left: timeToX(Math.min(pendingStart, end)),
      width: timeToX(Math.abs(end - pendingStart)),
    };
  }, [cutPhase, pendingStart, hoverTime, currentTime, timeToX]);

  // Zoom slider
  const zoomSliderValue = Math.round(
    ((Math.log(zoom) - Math.log(MIN_ZOOM)) / (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM))) * 100
  );
  const handleZoomSlider = useCallback((value: number) => {
    const logV = Math.log(MIN_ZOOM) + (value / 100) * (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM));
    setZoom(Math.round(Math.exp(logV)));
  }, []);

  return (
    <div className="timeline">
      {/* Status bar: 3-column grid — empty | centered controls | hints + zoom */}
      <div className="tl-zoom-bar">
        {thumbGenerating && (
          <div className="tl-thumb-progress">
            <div className="tl-thumb-progress-bar" style={{ width: `${thumbProgress * 100}%` }} />
          </div>
        )}
        <div />
        <div className="tl-zoom-center">
          <button className="tl-play-btn" onClick={onTogglePlay} title={playing ? "暂停 (K)" : "播放 (K)"}>
            {playing ? "⏸" : "▶"}
          </button>
          <span className="tl-time">{formatTimeCompact(currentTime)} / {formatTimeCompact(duration)}</span>
          {cutPhase === "start-set" ? (
            <span className="cut-phase active">起点: {formatTimeCompact(pendingStart ?? 0)}</span>
          ) : (
            <span className="cut-phase">等待切割</span>
          )}
        </div>
        <div className="tl-zoom-right">
          <button className="tl-reload-thumbs-btn" onClick={handleReloadThumbnails} title="重新加载缩略图">
            ↻ 加载缩略图
          </button>
          <button className="tl-zoom-btn" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.75))} title="缩小">−</button>
          <input type="range" className="tl-zoom-slider" min={0} max={100} value={zoomSliderValue}
            onChange={(e) => handleZoomSlider(Number(e.target.value))} title={`缩放: ${zoom}px/s`} />
          <button className="tl-zoom-btn" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.35))} title="放大">+</button>
          <span className="tl-zoom-label">{Math.round(zoom)}px/s</span>
        </div>
      </div>

      {/* Track container */}
      <div className="tl-container" ref={containerRef}
        onMouseDown={handleTrackMouseDown} onContextMenu={handleContextMenu}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div className="tl-track" style={{ width: trackWidth }}>

          {/* ── Time Ruler ── */}
          <div className="tl-ruler" style={{ height: RULER_HEIGHT }}>
            {/* Minor ticks (thin lines, no label) */}
            {minorTicks.map((tick, i) => (
              <div key={`m${i}`} className="tl-ruler-tick minor" style={{ left: tick.x }}>
                <div className="tl-ruler-line" />
              </div>
            ))}
            {/* Major ticks (thick lines + label) */}
            {majorTicks.map((tick, i) => (
              <div key={`M${i}`} className="tl-ruler-tick major" style={{ left: tick.x }}>
                <div className="tl-ruler-line" />
                <span className="tl-ruler-label">{tick.label}</span>
              </div>
            ))}
          </div>

          {/* ── Filmstrip ── */}
          <div className="tl-filmstrip" style={{ top: RULER_HEIGHT, height: FILMSTRIP_HEIGHT }}>
            {cellThumbs.map((cell) => {
              const x = timeToX(cell.time);
              const w = timeToX(cell.time + cell.interval) - x;
              if (cell.src) {
                return (
                  <img key={cell.time} className="tl-filmstrip-thumb" src={cell.src} alt=""
                    draggable={false} style={{ left: x, width: w, height: FILMSTRIP_HEIGHT }} />
                );
              }
              // Placeholder skeleton
              return (
                <div key={cell.time} className="tl-filmstrip-placeholder"
                  style={{ left: x, width: w, height: FILMSTRIP_HEIGHT }} />
              );
            })}
            {cellThumbs.length === 0 && (
              <div className="tl-filmstrip-empty">
                {thumbGenerating ? "生成缩略图中..." : "导入视频以显示画面"}
              </div>
            )}
          </div>

          {/* Completed sentence zones — gray overlay on filmstrip */}
          {sentences.map((s) => {
            const x = timeToX(s.start);
            const w = timeToX(s.end) - x;
            return (
              <div key={`cz-${s.id}`} className="tl-completed-zone"
                style={{ left: x, width: Math.max(w, 2), top: RULER_HEIGHT, height: FILMSTRIP_HEIGHT }} />
            );
          })}

          {/* Quality markers — derived from sentence timings, non-blocking */}
          {qualityIssues.map((issue) => {
            const x = timeToX(issue.start);
            const w = Math.max(timeToX(issue.end) - x, issue.type === "short" ? 5 : 2);
            const markerTop = issue.type === "short" ? BLOCK_TOP : RULER_HEIGHT;
            const markerHeight = issue.type === "short" ? BLOCK_HEIGHT : FILMSTRIP_HEIGHT;
            return (
              <div
                key={issue.id}
                className={`tl-quality-marker ${issue.type}`}
                title={issue.label}
                style={{
                  left: x,
                  width: w,
                  top: markerTop,
                  height: markerHeight,
                }}
              />
            );
          })}

          {/* Pending start marker */}
          {cutPhase === "start-set" && pendingStart !== null && (
            <div className="tl-pending-start"
              style={{ left: timeToX(pendingStart), top: RULER_HEIGHT, height: `calc(100% - ${RULER_HEIGHT}px)` }}>
              <div className="tl-pending-start-label">S</div>
            </div>
          )}

          {/* Cut range preview */}
          {cutRangePreview && (
            <div className="tl-cut-preview"
              style={{ left: cutRangePreview.left, width: cutRangePreview.width, top: RULER_HEIGHT, height: `calc(100% - ${RULER_HEIGHT}px)` }} />
          )}

          {/* Hover indicator */}
          {hoverTime !== null && !dragState && (
            <div className="tl-hover-line"
              style={{ left: timeToX(hoverTime), top: 0, height: "100%" }} />
          )}

          {/* Snap-to target indicator */}
          {snapTarget && !dragState && (
            <div className="tl-snap-target"
              style={{ left: timeToX(snapTarget.time), top: 0, height: "100%" }}>
              <div className="tl-snap-target-line" />
            </div>
          )}

          {/* Sentence blocks */}
          {sentences.map((s, idx) => {
            const x = timeToX(s.start);
            const w = timeToX(s.end) - x;
            const isSel = s.id === selectedId;
            const isHeard = s.heard ?? Boolean(s.text || s.englishText || s.chineseText);
            const blockLabel = s.englishText || s.chineseText || s.text || `S${idx + 1}`;
            const issueTypes = sentenceIssueTypes.get(s.id);
            const issueClass = issueTypes ? [...issueTypes].map((type) => `has-${type}`).join(" ") : "";
            return (
              <div 
                key={s.id} 
                className={`tl-block ${isHeard ? "heard" : "unheard"} ${isSel ? "selected" : ""} ${issueClass}`}
                style={{ 
                  left: x, 
                  width: Math.max(w, 4), 
                  top: BLOCK_TOP, 
                  height: BLOCK_HEIGHT,
                }}
                onMouseDown={(e) => handleBlockMouseDown(e, s, "body")}
                onContextMenu={(e) => handleBlockContextMenu(e, s)}
                onDoubleClick={(e) => { e.stopPropagation(); onSelectSentence(s.id); }}>
                <div className="tl-block-handle left" onMouseDown={(e) => handleBlockMouseDown(e, s, "left")} />
                <div className="tl-block-handle right" onMouseDown={(e) => handleBlockMouseDown(e, s, "right")} />
                <div className="tl-block-content">
                  <span className="tl-block-label">{blockLabel}</span>
                </div>
              </div>
            );
          })}

          {/* Playhead */}
          <div className="tl-playhead" style={{ left: timeToX(currentTime) }}
            onMouseDown={handlePlayheadMouseDown}
            onContextMenu={handlePlayheadContextMenu}>
            <div className="tl-playhead-handle" />
            <div className="tl-playhead-line" />
          </div>
        </div>
      </div>

      {/* Context Menu — rendered via portal-style fixed positioning */}
      {contextMenu && (
        <div className="tl-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className="tl-context-item" onClick={() => { onSetCutStart(contextMenu.time); setContextMenu(null); }}>
            <span className="tl-context-icon">⌈</span> 设为起始点
          </button>
          <button className="tl-context-item" onClick={() => { onSetCutEnd(contextMenu.time); setContextMenu(null); }}>
            <span className="tl-context-icon">⌋</span> 设为终止点
          </button>
        </div>
      )}

      {/* Block Context Menu — heard/unheard */}
      {blockContextMenu && (
        <div 
          className="tl-context-menu" 
          style={{ 
            left: Math.min(blockContextMenu.x, window.innerWidth - 120), 
            top: Math.min(blockContextMenu.y, window.innerHeight - 80),
          }}
          onMouseDown={(e) => e.stopPropagation()}>
          <button className="tl-context-item" onClick={() => {
            if (onToggleSentenceHeard) {
              onToggleSentenceHeard(blockContextMenu.sentenceId, true);
            }
            setBlockContextMenu(null);
          }}>
            <span className="tl-context-icon" style={{ color: "#4299e1" }}>●</span> 听出
          </button>
          <button className="tl-context-item" onClick={() => {
            if (onToggleSentenceHeard) {
              onToggleSentenceHeard(blockContextMenu.sentenceId, false);
            }
            setBlockContextMenu(null);
          }}>
            <span className="tl-context-icon" style={{ color: "#ff4a4a" }}>●</span> 未听出
          </button>
        </div>
      )}
    </div>
  );
}

function formatRulerTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
