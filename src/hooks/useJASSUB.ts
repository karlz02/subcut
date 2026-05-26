import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import JASSUB from "jassub";

export function useJASSUB(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  assContent: string | null,
  videoSrc: string,
  enabled: boolean = true,
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
      modernWasm: true,
      asyncRender: true,
    });

    jassub.ready.then(() => {
      jassubRef.current = jassub;
    });

    return () => {
      if (jassubRef.current) {
        jassubRef.current.destroy();
        jassubRef.current = null;
      }
    };
  }, [videoRef, canvasRef, assContent, videoSrc, enabled]);
}
