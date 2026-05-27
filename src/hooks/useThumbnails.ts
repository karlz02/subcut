import { useRef, useState, useCallback, useEffect } from "react";

// Thumbnail dimensions (logical; canvas scaled by devicePixelRatio for HiDPI)
const THUMB_W = 320;
const THUMB_H = 180;

// Desired pixel width per thumbnail cell
const TARGET_CELL_PX_MIN = 80;
const TARGET_CELL_PX_MAX = 160;

// Choose interval so each cell is ~TARGET_CELL_PX wide
function getIntervalForZoom(pps: number): number {
  // We want each thumbnail to span TARGET_CELL_PX pixels
  const targetSec = (TARGET_CELL_PX_MIN + TARGET_CELL_PX_MAX) / 2 / pps;
  // Snap to nice values
  if (targetSec <= 0.25) return 0.25;
  if (targetSec <= 0.5) return 0.5;
  if (targetSec <= 1) return 1;
  if (targetSec <= 2) return 2;
  if (targetSec <= 5) return 5;
  if (targetSec <= 10) return 10;
  return 15;
}

function snapToGrid(time: number, interval: number): number {
  return Math.round(time / interval) * interval;
}

export interface CellThumb {
  time: number;
  interval: number;
  src: string | null; // null = placeholder
}

export function useThumbnails(
  videoSrc: string | null,
  duration: number,
  pps: number,
  visibleStartTime: number,
  visibleEndTime: number,
  reloadKey: number = 0,
  generateAll: boolean = false
) {
  const [thumbCache, setThumbCache] = useState<Map<string, string>>(new Map());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());

  // Create hidden elements once
  useEffect(() => {
    if (!videoRef.current) {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      v.crossOrigin = "anonymous";
      v.style.display = "none";
      document.body.appendChild(v);
      videoRef.current = v;
    }
    if (!canvasRef.current) {
      const c = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      c.width = THUMB_W * dpr;
      c.height = THUMB_H * dpr;
      c.style.display = "none";
      document.body.appendChild(c);
      canvasRef.current = c;
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
        // 完全移除 DOM 元素，防止内存泄漏
        videoRef.current.remove();
        videoRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
    };
  }, []);

  // Reset cache when video changes or reload is triggered
  useEffect(() => {
    setThumbCache(new Map());
    setProgress(0);
    setGenerating(false);
    pendingRef.current.clear();
    if (abortRef.current) abortRef.current.abort();
  }, [videoSrc, reloadKey]);

  // Current interval based on zoom
  const interval = getIntervalForZoom(pps);

  // Generate a single thumbnail
  const generateOne = useCallback(
    async (video: HTMLVideoElement, canvas: HTMLCanvasElement, time: number): Promise<[string, string] | null> => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const key = `${Math.round(time * 1000)}`;

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("loadeddata", onLoadedData);
          video.removeEventListener("timeupdate", onTimeUpdate);
          resolve(null);
        }, 3000);

        const captureFrame = () => {
          clearTimeout(timeout);
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("loadeddata", onLoadedData);
          video.removeEventListener("timeupdate", onTimeUpdate);
          const dpr = window.devicePixelRatio || 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve([key, dataUrl]);
        };

        const onSeeked = () => {
          // For time 0, we need to wait for the first frame to be ready
          if (time === 0 && video.readyState < 2) {
            // Not enough data yet, wait for loadeddata
            return;
          }
          captureFrame();
        };

        const onLoadedData = () => {
          // Frame at time 0 is now ready
          captureFrame();
        };

        const onTimeUpdate = () => {
          // For time 0, timeupdate can also indicate frame is ready
          if (time === 0 && video.currentTime >= 0) {
            captureFrame();
          }
        };

        video.addEventListener("seeked", onSeeked);
        video.addEventListener("loadeddata", onLoadedData);
        video.addEventListener("timeupdate", onTimeUpdate);
        video.currentTime = time;
      });
    },
    []
  );

  // Generate thumbnails
  useEffect(() => {
    if (!videoSrc || duration <= 0 || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Always load video first before generating thumbnails
    const loadVideoAndGenerate = async () => {
      // Calculate needed cells
      // If generateAll is true, generate all thumbnails from 0 to duration
      // Otherwise, generate only for visible range (with buffer)
      let startTime: number;
      let endTime: number;
      
      if (generateAll) {
        startTime = 0;
        endTime = duration;
      } else {
        const bufferPx = 400;
        const bufferSec = bufferPx / pps;
        startTime = Math.max(0, snapToGrid(visibleStartTime - bufferSec, interval));
        endTime = Math.min(duration, snapToGrid(visibleEndTime + bufferSec, interval) + interval);
      }

      // Find which cells are missing
      const missingTimes: number[] = [];
      for (let t = startTime; t < endTime; t += interval) {
        const snapped = snapToGrid(t, interval);
        const key = `${Math.round(snapped * 1000)}`;
        if (!thumbCache.has(key) && !pendingRef.current.has(key)) {
          missingTimes.push(snapped);
        }
      }

      if (missingTimes.length === 0) return;

      // Mark as pending
      for (const t of missingTimes) {
        pendingRef.current.add(`${Math.round(t * 1000)}`);
      }

      // Abort previous generation
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setGenerating(true);

      // Load video if needed
      if (video.readyState < 2 || video.src !== videoSrc) {
        video.src = videoSrc;
        try {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => { 
              video.removeEventListener("loadedmetadata", onLoaded); 
              video.removeEventListener("error", onError);
              resolve(); 
            };
            const onError = () => { 
              video.removeEventListener("loadedmetadata", onLoaded); 
              video.removeEventListener("error", onError);
              reject(new Error("load failed")); 
            };
            video.addEventListener("loadedmetadata", onLoaded);
            video.addEventListener("error", onError);
            if (video.readyState >= 2) { 
              video.removeEventListener("loadedmetadata", onLoaded); 
              video.removeEventListener("error", onError);
              resolve(); 
            }
          });
        } catch {
          setGenerating(false);
          return;
        }
      }

      if (controller.signal.aborted) return;

      const newEntries = new Map<string, string>();
      const total = missingTimes.length;
      let done = 0;

      for (const t of missingTimes) {
        if (controller.signal.aborted) break;
        const result = await generateOne(video, canvas, t);
        if (result) {
          newEntries.set(result[0], result[1]);
        }
        done++;
        setProgress(done / total);
      }

      if (!controller.signal.aborted && newEntries.size > 0) {
        setThumbCache((prev) => {
          const next = new Map(prev);
          for (const [k, v] of newEntries) {
            next.set(k, v);
            pendingRef.current.delete(k);
          }
          return next;
        });
      }

      // Clear pending for failed ones
      for (const t of missingTimes) {
        pendingRef.current.delete(`${Math.round(t * 1000)}`);
      }

      if (!controller.signal.aborted) {
        setGenerating(false);
        setProgress(1);
      }
    };

    loadVideoAndGenerate();

    return () => { abortRef.current?.abort(); };
  }, [videoSrc, duration, pps, interval, visibleStartTime, visibleEndTime, generateOne, reloadKey, generateAll]);

  // Build cell array covering the full track
  const getCellThumbs = useCallback((): CellThumb[] => {
    if (duration <= 0) return [];

    const cells: CellThumb[] = [];
    for (let t = 0; t < duration; t += interval) {
      const snapped = snapToGrid(t, interval);
      const key = `${Math.round(snapped * 1000)}`;
      const src = thumbCache.get(key) ?? null;
      cells.push({ time: snapped, interval, src });
    }
    // Ensure last cell covers the end
    const lastCell = cells[cells.length - 1];
    if (!lastCell || lastCell.time + interval < duration) {
      const endSnap = snapToGrid(duration, interval);
      const key = `${Math.round(endSnap * 1000)}`;
      cells.push({ time: endSnap, interval, src: thumbCache.get(key) ?? null });
    }

    return cells;
  }, [duration, interval, thumbCache]);

  return { getCellThumbs, generating, progress, interval };
}
