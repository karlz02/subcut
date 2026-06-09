import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import JASSUB from "jassub";

const EMPTY_FONTS: Array<string | Uint8Array> = [];

export function useJASSUB(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  assContent: string | null,
  videoSrc: string,
  enabled: boolean = true,
  fonts: Array<string | Uint8Array> = EMPTY_FONTS,
) {
  const jassubRef = useRef<JASSUB | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!enabled || !video || !canvas || !assContent) {
      return;
    }

    // Cleanup existing instance
    if (jassubRef.current) {
      jassubRef.current.destroy();
      jassubRef.current = null;
    }

    const jassub = new JASSUB({
      video,
      canvas,
      subContent: assContent,
      workerUrl: "/jassub/jassub-worker.js",
      wasmUrl: "/jassub/jassub-worker.wasm",
      modernWasmUrl: "/jassub/jassub-worker.wasm",
      fonts,
    });

    jassub.ready.then(() => {
      jassubRef.current = jassub;
    }).catch((error) => {
      console.error("useJASSUB: Failed to initialize JASSUB:", error);
      // 清理可能创建的资源
      try {
        jassub.destroy();
      } catch (e) {
        console.warn("useJASSUB: Error during cleanup after initialization failure:", e);
      }
    });

    return () => {
      if (jassubRef.current) {
        try {
          jassubRef.current.destroy();
        } catch (error) {
          console.warn("useJASSUB: Error during cleanup:", error);
        }
        jassubRef.current = null;
      }
    };
  }, [videoRef, canvasRef, assContent, videoSrc, enabled, fonts]);
}
