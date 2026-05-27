import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from "react";

import type { Sentence, SubtitleStyle } from "../types";

function buildSubtitleCSS(style: SubtitleStyle): React.CSSProperties {
  const outlineW = style.outline ?? 2;
  const outlineC = style.color3 ?? "#000000";
  const shadowW = style.shadow ?? 1;
  const shadowC = style.color4 ?? "#000000";

  const shadows: string[] = [];
  if (outlineW > 0) {
    const o = outlineW;
    shadows.push(
      `${o}px 0 0 ${outlineC}`,
      `-${o}px 0 0 ${outlineC}`,
      `0 ${o}px 0 ${outlineC}`,
      `0 -${o}px 0 ${outlineC}`,
      `${o}px ${o}px 0 ${outlineC}`,
      `-${o}px -${o}px 0 ${outlineC}`,
      `${o}px -${o}px 0 ${outlineC}`,
      `-${o}px ${o}px 0 ${outlineC}`,
    );
  }
  if (shadowW > 0) {
    shadows.push(`${shadowW}px ${shadowW}px ${shadowW}px ${shadowC}`);
  }

  return {
    fontFamily: `"${style.fontname}", "Microsoft YaHei", "SimHei", sans-serif`,
    fontSize: `${style.fontsize}px`,
    color: style.color1 || "#ffffff",
    fontWeight: style.bold ? "bold" : "normal",
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    textShadow: shadows.length > 0 ? shadows.join(", ") : undefined,
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    textRendering: "geometricPrecision",
    lineHeight: 1.3,
    padding: "2px 6px",
  };
}

interface Props {
  videoSrc: string | null;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onAspectRatio?: (ratio: number) => void;
  playbackRate: number;
  sentences?: Sentence[];
  currentTime?: number;
}

export interface VideoPlayerHandle {
  getVideo: () => HTMLVideoElement | null;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ videoSrc, onTimeUpdate, onDurationChange, onPlay, onPause, onSeek, onAspectRatio, playbackRate, sentences, currentTime }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [internalTime, setInternalTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [videoRenderRect, setVideoRenderRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

    useImperativeHandle(ref, () => ({
      getVideo: () => videoRef.current,
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          setInternalTime(time);
        }
      },
      play: () => videoRef.current?.play().catch(() => {}),
      pause: () => videoRef.current?.pause(),
      togglePlay: () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      },
      setPlaybackRate: (rate: number) => {
        if (videoRef.current) videoRef.current.playbackRate = rate;
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => videoRef.current?.duration ?? 0,
    }));

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
    }, [playbackRate]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleTimeUpdate = () => {
        const t = video.currentTime;
        setInternalTime(t);
        onTimeUpdate?.(t);
      };

      const handleLoadedMetadata = () => {
        const d = video.duration;
        setDuration(d);
        onDurationChange?.(d);
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          onAspectRatio?.(video.videoWidth / video.videoHeight);
        }
      };

      const handlePlay = () => onPlay?.();
      const handlePause = () => onPause?.();
      const handleSeeked = () => onSeek?.(video.currentTime);

      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("seeked", handleSeeked);

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("seeked", handleSeeked);
      };
    }, [videoSrc, onTimeUpdate, onDurationChange, onPlay, onPause, onSeek, onAspectRatio]);

    // Calculate video render rectangle for subtitle positioning
    useEffect(() => {
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container) return;

      const updateRect = () => {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (videoWidth === 0 || videoHeight === 0) return;

        const videoAspect = videoWidth / videoHeight;
        const containerAspect = containerWidth / containerHeight;

        let renderWidth: number;
        let renderHeight: number;
        let offsetX = 0;
        let offsetY = 0;

        // Always use contain mode with left alignment
        if (videoAspect > containerAspect) {
          // Video is wider than container - fit width
          renderWidth = containerWidth;
          renderHeight = containerWidth / videoAspect;
          offsetX = 0; // Left aligned
          offsetY = (containerHeight - renderHeight) / 2; // Vertically centered
        } else {
          // Video is taller than container - fit height
          renderHeight = containerHeight;
          renderWidth = containerHeight * videoAspect;
          offsetX = 0; // Left aligned
          offsetY = (containerHeight - renderHeight) / 2; // Vertically centered
        }

        setVideoRenderRect({
          x: offsetX,
          y: offsetY,
          width: renderWidth,
          height: renderHeight
        });
      };

      updateRect();
      window.addEventListener("resize", updateRect);

      return () => {
        window.removeEventListener("resize", updateRect);
      };
    }, [videoSrc]);

    const handleVideoClick = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    }, []);

    if (!videoSrc) {
      return (
        <div className="video-player">
          <div className="video-player-empty">
            导入视频开始使用
          </div>
        </div>
      );
    }

    // Find current sentence based on time
    const displayTime = currentTime ?? videoRef.current?.currentTime ?? 0;
    const currentSentence = sentences?.find(
      (s) => displayTime >= s.start && displayTime <= s.end
    );

    return (
      <div className="video-player" ref={containerRef}>
        <video
          ref={videoRef}
          src={videoSrc}
          className="video-element"
          style={{
            objectFit: "contain",
            objectPosition: "left center",
            width: "100%",
            height: "100%",
          }}
          onClick={handleVideoClick}
        />
        {currentSentence && (
          <div
            className="video-subtitles"
            style={{
              position: "absolute",
              left: videoRenderRect.x,
              top: videoRenderRect.y,
              width: videoRenderRect.width,
              height: videoRenderRect.height,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              paddingBottom: "20px",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {currentSentence.chineseText && (
              <div
                className="video-subtitle video-subtitle-cn"
                style={{
                  ...buildSubtitleCSS(currentSentence.style.chinese),
                  transform: `translateY(${currentSentence.style.chinese.offsetY}px)`,
                }}
              >
                {currentSentence.chineseText}
              </div>
            )}
            {currentSentence.englishText && (
              <div
                className="video-subtitle video-subtitle-en"
                style={{
                  ...buildSubtitleCSS(currentSentence.style.english),
                  marginTop: "4px",
                  transform: `translateY(${currentSentence.style.english.offsetY}px)`,
                }}
              >
                {currentSentence.englishText}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
