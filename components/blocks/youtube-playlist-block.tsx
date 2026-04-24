"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  completeYoutubeEpisode,
  findFirstIncompleteEpisode,
  markYoutubeEpisodeOpened,
  saveYoutubeWatchProgress,
} from "@/lib/youtube-channel-actions";
import {
  YoutubeIframePlayer,
  type YoutubeIframePlayerHandle,
} from "@/components/blocks/youtube-iframe-player";

export function YoutubePlaylistBlock(props: {
  tenantId: string;
  blockId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [playlist, setPlaylist] = useState<any>(null);
  const [channel, setChannel] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const playerRef = useRef<YoutubeIframePlayerHandle | null>(null);
  const manualSavingRef = useRef(false);
  const completeInFlightRef = useRef(false);
  const lastOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubPlaylist = onSnapshot(
      doc(db, "tenants", props.tenantId, "nodes", props.blockId),
      (snap) => {
        const data = snap.exists()
          ? { id: snap.id, ...(snap.data() as any) }
          : null;
        setPlaylist(data);
      },
    );

    const unsubEpisodes = onSnapshot(
      query(
        collection(db, "tenants", props.tenantId, "nodes"),
        where("parentId", "==", props.blockId),
        where("type", "==", "item"),
        where("archived", "==", false),
        orderBy("orderKey"),
      ),
      (snap) => {
        setEpisodes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      },
    );

    return () => {
      unsubPlaylist();
      unsubEpisodes();
    };
  }, [props.blockId, props.tenantId]);

  useEffect(() => {
    if (!playlist?.parentId) return;

    return onSnapshot(
      doc(db, "tenants", props.tenantId, "nodes", playlist.parentId),
      (snap) => {
        setChannel(
          snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null,
        );
      },
    );
  }, [playlist?.parentId, props.tenantId]);

  useEffect(() => {
    if (!episodes.length) return;

    const currentStillExists =
      currentEpisodeId && episodes.some((x) => x.id === currentEpisodeId);

    if (currentStillExists) return;

    const requested = searchParams.get("episode");

    const preferred =
      requested && episodes.some((x) => x.id === requested)
        ? requested
        : playlist?.lastOpenedEpisodeId &&
            episodes.some((x) => x.id === playlist.lastOpenedEpisodeId)
          ? playlist.lastOpenedEpisodeId
          : episodes.find((x) => !x.done)?.id || episodes[0]?.id || null;

    if (preferred) {
      setCurrentEpisodeId(preferred);
    }
  }, [episodes, playlist?.lastOpenedEpisodeId, searchParams, currentEpisodeId]);

  const currentEpisode = useMemo(
    () => episodes.find((x) => x.id === currentEpisodeId) || null,
    [episodes, currentEpisodeId],
  );

  useEffect(() => {
    const channelId = channel?.id;
    const playlistId = playlist?.id;
    const episodeId = currentEpisodeId;

    if (!channelId || !playlistId || !episodeId) return;
    if (lastOpenedRef.current === episodeId) return;

    lastOpenedRef.current = episodeId;

    markYoutubeEpisodeOpened({
      tenantId: props.tenantId,
      channelBlockId: channelId,
      playlistBlockId: playlistId,
      episodeId,
    }).catch((error) => {
      console.error("markYoutubeEpisodeOpened failed", error);
    });
  }, [channel?.id, playlist?.id, currentEpisodeId, props.tenantId]);

  function getStartSeconds(ep: any) {
    const saved = Number(ep?.watchSeconds || 0);
    if (!Number.isFinite(saved) || saved <= 0) return 0;
    return Math.max(0, saved - 2);
  }

  async function goToEpisode(episodeId: string) {
    if (episodeId === currentEpisodeId) return;

    setCurrentEpisodeId(episodeId);
    router.replace(`/block/${props.blockId}?episode=${episodeId}`);
  }

  async function saveCurrentPositionManually() {
    if (!currentEpisode) return;
    if (currentEpisode.done) return;
    if (manualSavingRef.current) return;

    const progress = playerRef.current?.getProgress();
    if (!progress) return;

    const roundedSec = Math.round(progress.current);
    const roundedPercent = Math.round(progress.percent);

    manualSavingRef.current = true;
    setSaving(true);

    try {
      await saveYoutubeWatchProgress({
        tenantId: props.tenantId,
        episodeId: currentEpisode.id,
        watchSeconds: roundedSec,
        watchPercent: roundedPercent,
      });

      if (channel?.id && playlist?.id) {
        await markYoutubeEpisodeOpened({
          tenantId: props.tenantId,
          channelBlockId: channel.id,
          playlistBlockId: playlist.id,
          episodeId: currentEpisode.id,
        });

        lastOpenedRef.current = currentEpisode.id;
      }
    } finally {
      manualSavingRef.current = false;
      setSaving(false);
    }
  }

  async function goNextAfter(currentId: string) {
    const idx = episodes.findIndex((x) => x.id === currentId);
    const nextInSame = idx >= 0 ? episodes[idx + 1] : null;

    if (nextInSame) {
      await goToEpisode(nextInSame.id);
      return;
    }

    if (!channel?.id) return;

    const siblingSnap = await getDocs(
      query(
        collection(db, "tenants", props.tenantId, "nodes"),
        where("parentId", "==", channel.id),
        where("type", "==", "block"),
        where("archived", "==", false),
        orderBy("orderKey"),
      ),
    );

    const siblings = siblingSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const currentPlaylistIndex = siblings.findIndex(
      (x) => x.id === props.blockId,
    );

    for (let i = currentPlaylistIndex + 1; i < siblings.length; i++) {
      const playlistBlock = siblings[i];

      const episodeId = await findFirstIncompleteEpisode({
        tenantId: props.tenantId,
        playlistBlockId: playlistBlock.id,
      });

      if (episodeId) {
        router.push(`/block/${playlistBlock.id}?episode=${episodeId}`);
        return;
      }
    }
  }

  if (!playlist) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">قائمة تشغيل</div>
            <h1 className="font-bold">{playlist.title}</h1>
          </div>

          <div className="text-sm text-muted-foreground">
            {playlist.doneEpisodes || 0} / {playlist.totalEpisodes || 0}
          </div>
        </div>

        {currentEpisode ? (
          currentEpisode.videoId ? (
            <>
              <YoutubeIframePlayer
                ref={playerRef}
                key={currentEpisode.id}
                videoId={currentEpisode.videoId}
                startSeconds={getStartSeconds(currentEpisode)}
                autoplay
                onEnded={async ({ duration }) => {
                  if (!currentEpisode) return;
                  if (completeInFlightRef.current) return;

                  completeInFlightRef.current = true;
                  setSaving(true);

                  try {
                    while (manualSavingRef.current) {
                      await new Promise((resolve) => setTimeout(resolve, 100));
                    }

                    await completeYoutubeEpisode({
                      tenantId: props.tenantId,
                      channelBlockId: channel.id,
                      playlistBlockId: playlist.id,
                      episodeId: currentEpisode.id,
                      durationSeconds: duration,
                    });

                    await goNextAfter(currentEpisode.id);
                  } catch (error) {
                    console.error("completeYoutubeEpisode failed", error);
                  } finally {
                    completeInFlightRef.current = false;
                    setSaving(false);
                  }
                }}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!currentEpisode || currentEpisode.done || saving}
                  onClick={saveCurrentPositionManually}
                >
                  {saving ? "جارٍ الحفظ..." : "حفظ موضع التوقف"}
                </Button>

                <Button
                  variant="outline"
                  disabled={!currentEpisode || saving}
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
            <div className="rounded-xl border p-4 text-muted-foreground">
              لا يوجد videoId لهذه الحلقة.
            </div>
          )
        ) : (
          <div className="rounded-xl border p-4 text-muted-foreground">
            لا توجد حلقات في هذه القائمة.
          </div>
        )}
      </div>

      <div className="space-y-2">
        {episodes.map((ep, index) => {
          const active = ep.id === currentEpisodeId;

          return (
            <button
              key={ep.id}
              onClick={() => goToEpisode(ep.id)}
              className={[
                "w-full rounded-2xl border p-3 text-right transition",
                active
                  ? "border-foreground bg-muted"
                  : "bg-card hover:bg-muted/60",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    حلقة #{index + 1}
                  </div>

                  <div className="truncate font-medium">{ep.title}</div>

                  {!ep.done && Number(ep.watchSeconds || 0) > 0 ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      محفوظ عند {Math.floor(Number(ep.watchSeconds || 0) / 60)}:
                      {String(
                        Math.floor(Number(ep.watchSeconds || 0) % 60),
                      ).padStart(2, "0")}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 text-sm">
                  {ep.done ? "✅" : `${Math.round(ep.watchPercent || 0)}%`}
                </div>
              </div>
            </button>
          );
        })}

        {!episodes.length ? (
          <div className="rounded-2xl border bg-card p-4 text-muted-foreground">
            لا توجد حلقات.
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => channel?.id && router.push(`/block/${channel.id}`)}
        >
          رجوع إلى القناة
        </Button>
      </div>
    </div>
  );
}
