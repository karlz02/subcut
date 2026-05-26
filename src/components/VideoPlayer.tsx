import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from "react";

import type { Sentence } from "../types";

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
        {/* Subtitle Overlay - positioned on actual video render area */}
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
            {currentSentence.englishText && (
              <div
                className="video-subtitle video-subtitle-en"
                style={{
                  fontFamily: currentSentence.style.english.fontname || "Arial",
                  fontSize: `${currentSentence.style.english.fontsize}px`,
                  color: currentSentence.style.english.color1 || "#ffffff",
                  fontWeight: currentSentence.style.english.bold ? "bold" : "normal",
                  fontStyle: currentSentence.style.english.italic ? "italic" : "normal",
                  textDecoration: currentSentence.style.english.underline ? "underline" : "none",
                  marginTop: "4px",
                  transform: `translateY(${currentSentence.style.english.offsetY}px)`,
                }}
              >
                {currentSentence.englishText}
              </div>
            )}
            {currentSentence.chineseText && (
              <div
                className="video-subtitle video-subtitle-cn"
                style={{
                  fontFamily: currentSentence.style.chinese.fontname || "SimHei",
                  fontSize: `${currentSentence.style.chinese.fontsize}px`,
                  color: currentSentence.style.chinese.color1 || "#ffffff",
                  fontWeight: currentSentence.style.chinese.bold ? "bold" : "normal",
                  fontStyle: currentSentence.style.chinese.italic ? "italic" : "normal",
                  textDecoration: currentSentence.style.chinese.underline ? "underline" : "none",
                  marginTop: "4px",
                  transform: `translateY(${currentSentence.style.chinese.offsetY}px)`,
                }}
              >
                {currentSentence.chineseText}
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
