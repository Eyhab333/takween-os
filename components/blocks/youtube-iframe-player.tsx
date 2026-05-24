/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YoutubeProgressPayload = {
  current: number;
  duration: number;
  percent: number;
};

export type YoutubeIframePlayerHandle = {
  getProgress: () => YoutubeProgressPayload | null;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
};

function loadYoutubeApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window unavailable"));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    ) as HTMLScriptElement | null;

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("تعذر تحميل YouTube IFrame API"));
      document.head.appendChild(script);
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };

    const timer = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(timer);
        resolve(window.YT);
      }
    }, 100);

    window.setTimeout(() => {
      window.clearInterval(timer);
    }, 10000);
  });
}

export const YoutubeIframePlayer = forwardRef<
  YoutubeIframePlayerHandle,
  {
    videoId: string;
    startSeconds?: number;
    autoplay?: boolean;

    // متروك للتوافق مع أي ملفات قديمة، لكن لن نستدعيه تلقائيًا بعد الآن.
    onProgress?: (payload: YoutubeProgressPayload) => void;

    onEnded?: (payload: YoutubeProgressPayload) => void;
  }
>(function YoutubeIframePlayer(props, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const endedRef = useRef(props.onEnded);

  const [error, setError] = useState<{
    videoId: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    endedRef.current = props.onEnded;
  }, [props.onEnded]);

  function readProgress(): YoutubeProgressPayload | null {
    try {
      if (!playerRef.current?.getCurrentTime) return null;

      const duration = Number(playerRef.current.getDuration?.() || 0);
      const current = Number(playerRef.current.getCurrentTime?.() || 0);
      const percent = duration > 0 ? (current / duration) * 100 : 0;

      return { current, duration, percent };
    } catch {
      return null;
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      getProgress: () => readProgress(),

      seekTo: (seconds: number) => {
        try {
          playerRef.current?.seekTo?.(Math.max(0, seconds), true);
        } catch {}
      },

      play: () => {
        try {
          playerRef.current?.playVideo?.();
        } catch {}
      },

      pause: () => {
        try {
          playerRef.current?.pauseVideo?.();
        } catch {}
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    readyRef.current = false;
    playerRef.current = null;

    if (!container) return;

    container.replaceChildren();

    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    container.appendChild(host);

    loadYoutubeApi()
      .then((YT) => {
        if (cancelled || !container.isConnected) return;

        const safeStart = Math.max(0, Math.floor(props.startSeconds || 0));

        playerRef.current = new YT.Player(host, {
          width: "100%",
          height: "100%",
          videoId: props.videoId,
          playerVars: {
            autoplay: props.autoplay ? 1 : 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
            start: safeStart,
          },
          events: {
            onReady: () => {
              if (cancelled) return;

              readyRef.current = true;

              if (safeStart > 0) {
                try {
                  playerRef.current?.seekTo(safeStart, true);
                } catch {}
              }
            },

            onStateChange: (event: any) => {
              if (cancelled) return;
              if (event.data !== YT.PlayerState.ENDED) return;

              const duration = Number(playerRef.current?.getDuration?.() || 0);

              endedRef.current?.({
                current: duration,
                duration,
                percent: 100,
              });
            },

            onError: () => {
              if (!cancelled) {
                setError({
                  videoId: props.videoId,
                  message: "الفيديو لا يعمل داخل المشغّل المضمّن.",
                });
              }
            },
          },
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setError({
            videoId: props.videoId,
            message:
              e instanceof Error ? e.message : "تعذر تحميل مشغّل يوتيوب.",
          });
        }
      });

    return () => {
      cancelled = true;
      readyRef.current = false;

      try {
        playerRef.current?.destroy?.();
      } catch {}

      playerRef.current = null;

      try {
        container.replaceChildren();
      } catch {}
    };
  }, [props.videoId, props.startSeconds, props.autoplay]);

  const activeError = error?.videoId === props.videoId ? error.message : null;

  if (activeError) {
    return (
      <div className="rounded-xl border p-4 text-sm text-red-500">
        {activeError}
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border bg-black">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});
