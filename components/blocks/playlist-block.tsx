"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { importPlaylistEpisodes } from "@/lib/playlist-import";
import { startNewPlaylistRun } from "@/lib/playlist-runs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  YoutubeIframePlayer,
  type YoutubeIframePlayerHandle,
} from "@/components/blocks/youtube-iframe-player";
import {
  addPlaylistEpisode,
  markEpisodeOpened,
  savePlaylistEpisodeProgress,
  toggleEpisodeDone,
} from "@/lib/playlist-actions";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

type Ep = {
  id: string;
  title: string;
  url?: string;
  videoId?: string;
  done?: boolean;
  orderKey?: string;
  watchSeconds?: number;
  watchPercent?: number;
};

type BlockRow = {
  id: string;
  title?: string;
  runsCompleted?: number;
  lastOpenedEpisodeId?: string | null;
};

function extractYouTubeVideoId(url?: string) {
  const value = String(url || "").trim();
  if (!value) return null;

  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return u.pathname.replace(/^\/+/, "") || null;
    }

    if (host.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        return u.searchParams.get("v");
      }

      const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shorts?.[1]) return shorts[1];

      const embed = u.pathname.match(/^\/embed\/([^/?#]+)/);
      if (embed?.[1]) return embed[1];
    }

    return null;
  } catch {
    return null;
  }
}

function formatTime(totalSeconds: number) {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlaylistBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [block, setBlock] = useState<BlockRow | null>(null);
  const [eps, setEps] = useState<Ep[]>([]);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const [playlistUrl, setPlaylistUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const [runBusy, setRunBusy] = useState(false);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(null);
  const [playerStartSeconds, setPlayerStartSeconds] = useState(0);
  const [savingPosition, setSavingPosition] = useState(false);

  const playerRef = useRef<YoutubeIframePlayerHandle | null>(null);
  const manualSavingRef = useRef(false);
  const completeInFlightRef = useRef(false);

  useEffect(() => {
    const unsubBlock = onSnapshot(
      doc(db, "tenants", tenantId, "nodes", blockId),
      (snap) => {
        setBlock(
          snap.exists()
            ? ({ id: snap.id, ...(snap.data() as any) } as BlockRow)
            : null,
        );
      },
    );

    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("archived", "==", false),
      orderBy("orderKey"),
    );

    const unsubItems = onSnapshot(q, (snap) => {
      setEps(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            videoId: data.videoId || extractYouTubeVideoId(data.url),
          } as Ep;
        }),
      );
    });

    return () => {
      unsubBlock();
      unsubItems();
    };
  }, [tenantId, blockId]);

  useEffect(() => {
    if (!eps.length) return;

    const currentStillExists =
      currentEpisodeId && eps.some((x) => x.id === currentEpisodeId);

    if (currentStillExists) return;

    const requested = searchParams.get("episode");

    const preferredId =
      requested && eps.some((x) => x.id === requested)
        ? requested
        : block?.lastOpenedEpisodeId &&
            eps.some((x) => x.id === block.lastOpenedEpisodeId)
          ? block.lastOpenedEpisodeId
          : eps.find((e) => !e.done)?.id || eps[0]?.id || null;

    if (!preferredId) return;

    const preferredEp = eps.find((x) => x.id === preferredId) || null;

    setCurrentEpisodeId(preferredId);
    setPlayerStartSeconds(getStartSeconds(preferredEp));
  }, [eps, block?.lastOpenedEpisodeId, searchParams, currentEpisodeId]);

  useEffect(() => {
    completeInFlightRef.current = false;
    manualSavingRef.current = false;
  }, [currentEpisodeId]);

  const currentEpisode = useMemo(
    () => eps.find((e) => e.id === currentEpisodeId) || null,
    [eps, currentEpisodeId],
  );

  const nextEp = useMemo(
    () => eps.find((e) => !e.done) ?? eps[0] ?? null,
    [eps],
  );

  const doneCount = useMemo(() => eps.filter((e) => e.done).length, [eps]);

  const allDone = eps.length > 0 && doneCount === eps.length;
  const runs =
    typeof block?.runsCompleted === "number" ? block.runsCompleted : 0;

  function getStartSeconds(ep: Ep | null) {
    const saved = Number(ep?.watchSeconds || 0);
    if (!Number.isFinite(saved) || saved <= 0) return 0;
    return Math.max(0, saved - 2);
  }

  async function add() {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) return;

    setBusy(true);
    try {
      await addPlaylistEpisode(tenantId, blockId, t, u);
      setTitle("");
      setUrl("");
    } finally {
      setBusy(false);
    }
  }

  async function goToEpisode(ep: Ep) {
    if (!ep.url) return;

    if (!ep.videoId) {
      await markEpisodeOpened(tenantId, blockId, ep.id);
      window.open(ep.url, "_blank", "noopener,noreferrer");
      return;
    }

    setCurrentEpisodeId(ep.id);
    setPlayerStartSeconds(getStartSeconds(ep));
    router.replace(`/block/${blockId}?episode=${ep.id}`);

    await markEpisodeOpened(tenantId, blockId, ep.id);
  }

  async function saveCurrentPositionManually() {
    if (!currentEpisode) return;
    if (currentEpisode.done) return;
    if (manualSavingRef.current) return;

    const progress = playerRef.current?.getProgress();
    if (!progress) return;

    const roundedSec = Math.max(0, Math.round(progress.current));
    const roundedPercent = Math.max(
      0,
      Math.min(100, Math.round(progress.percent)),
    );

    manualSavingRef.current = true;
    setSavingPosition(true);

    try {
      await savePlaylistEpisodeProgress({
        tenantId,
        episodeId: currentEpisode.id,
        watchSeconds: roundedSec,
        watchPercent: roundedPercent,
      });

      await markEpisodeOpened(tenantId, blockId, currentEpisode.id);
    } finally {
      manualSavingRef.current = false;
      setSavingPosition(false);
    }
  }

  async function completeEpisode(ep: Ep, durationSeconds: number) {
    if (completeInFlightRef.current) return;
    completeInFlightRef.current = true;

    try {
      while (manualSavingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const now = Date.now();
      const batch = writeBatch(db);

      batch.update(doc(db, "tenants", tenantId, "nodes", ep.id), {
        done: true,
        watchSeconds: Math.max(
          Number(ep.watchSeconds || 0),
          Math.round(durationSeconds || 0),
        ),
        watchPercent: 100,
        completedAt: now,
        lastOpenedAt: now,
        updatedAt: now,
        version: increment(1),
      });

      batch.update(doc(db, "tenants", tenantId, "nodes", blockId), {
        lastOpenedAt: now,
        lastOpenedEpisodeId: ep.id,
        updatedAt: now,
        version: increment(1),
      });

      await batch.commit();
    } finally {
      completeInFlightRef.current = false;
    }
  }

  async function goNextAfter(currentId: string) {
    const idx = eps.findIndex((x) => x.id === currentId);
    const nextInSame = idx >= 0 ? eps[idx + 1] : null;

    if (!nextInSame) return;
    await goToEpisode(nextInSame);
  }

  async function importFromPlaylist() {
    const u = playlistUrl.trim();
    if (!u) return;

    setImporting(true);
    setImportError("");

    try {
      const r = await fetch(
        `/api/youtube/playlist?url=${encodeURIComponent(u)}`,
      );
      const data = await r.json();

      if (!r.ok) {
        throw new Error(data?.error || "فشل استيراد قائمة التشغيل");
      }

      await importPlaylistEpisodes({
        tenantId,
        blockId,
        episodes: data.episodes,
      });

      setPlaylistUrl("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "فشل استيراد قائمة التشغيل",
      );
    } finally {
      setImporting(false);
    }
  }

  if (!block) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">قائمة تشغيل</div>
            <h1 className="font-bold">{block.title || "قائمة تشغيل"}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {doneCount} / {eps.length}
            </span>
            <span>الختمات: {runs}</span>

            {allDone ? (
              <Button
                variant="outline"
                disabled={runBusy}
                onClick={async () => {
                  setRunBusy(true);
                  try {
                    await startNewPlaylistRun(tenantId, blockId);
                  } finally {
                    setRunBusy(false);
                  }
                }}
              >
                {runBusy ? "..." : "ابدأ رحلة جديدة"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!nextEp?.url}
            onClick={() => nextEp && goToEpisode(nextEp)}
          >
            تابع
          </Button>
        </div>

        {currentEpisode ? (
          currentEpisode.videoId ? (
            <>
              <YoutubeIframePlayer
                ref={playerRef}
                key={currentEpisode.id}
                videoId={currentEpisode.videoId}
                startSeconds={playerStartSeconds}
                autoplay
                onEnded={async ({ duration }) => {
                  if (!currentEpisode) return;

                  try {
                    await completeEpisode(currentEpisode, duration);
                    await goNextAfter(currentEpisode.id);
                  } catch (error) {
                    console.error("completeEpisode failed", error);
                  }
                }}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={
                    !currentEpisode || currentEpisode.done || savingPosition
                  }
                  onClick={saveCurrentPositionManually}
                >
                  {savingPosition ? "جارٍ الحفظ..." : "حفظ موضع التوقف"}
                </Button>

                <Button
                  variant="outline"
                  disabled={!currentEpisode}
                  onClick={async () => {
                    if (!currentEpisode) return;
                    await goNextAfter(currentEpisode.id);
                  }}
                >
                  التالي
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="font-medium">{currentEpisode.title}</div>
              <div className="text-sm text-muted-foreground">
                هذه الحلقة ليست فيديو يوتيوب مضمّن.
              </div>
              <div className="flex gap-2">
                <Button onClick={() => goToEpisode(currentEpisode)}>
                  فتح الرابط
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-xl border p-4 text-muted-foreground">
            لا توجد حلقات في هذه القائمة.
          </div>
        )}
      </div>

      <div className="space-y-2">
        {eps.map((ep, index) => {
          const active = ep.id === currentEpisodeId;
          const watchedSec = Number(ep.watchSeconds || 0);

          return (
            <div
              key={ep.id}
              className={[
                "rounded-2xl border p-3 transition",
                active
                  ? "border-foreground bg-muted"
                  : "bg-card hover:bg-muted/60",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => goToEpisode(ep)}
                  className="min-w-0 flex-1 text-right"
                >
                  <div className="text-xs text-muted-foreground">
                    حلقة #{index + 1}
                  </div>
                  <div className="truncate font-medium">{ep.title}</div>

                  {!ep.done && watchedSec > 0 ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      متابعة من {formatTime(watchedSec)}
                    </div>
                  ) : null}

                  {!ep.videoId && ep.url ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      رابط خارجي
                    </div>
                  ) : null}
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-sm">
                    {ep.done ? "✅" : `${Math.round(ep.watchPercent || 0)}%`}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await toggleEpisodeDone(
                        tenantId,
                        ep.id,
                        Boolean(ep.done),
                      );
                    }}
                  >
                    {ep.done ? "إلغاء" : "تم"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {!eps.length ? (
          <div className="rounded-2xl border bg-card p-4 text-muted-foreground">
            لا توجد حلقات.
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="font-bold">إضافة حلقة يدويًا</div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="عنوان الحلقة"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="رابط الحلقة"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button disabled={busy} onClick={add}>
            {busy ? "..." : "إضافة"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="font-bold">استيراد من قائمة تشغيل يوتيوب</div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            placeholder="رابط قائمة التشغيل"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
          />
          <Button
            disabled={importing || !playlistUrl.trim()}
            onClick={importFromPlaylist}
          >
            {importing ? "جارٍ الاستيراد..." : "استيراد"}
          </Button>
        </div>

        {importError ? (
          <div className="text-sm text-red-500">{importError}</div>
        ) : null}
      </div>
    </div>
  );
}
