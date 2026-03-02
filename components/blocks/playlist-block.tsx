/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { importPlaylistEpisodes } from "@/lib/playlist-import";
import { doc, getDoc } from "firebase/firestore";
import { startNewPlaylistRun } from "@/lib/playlist-runs";
import {
  addPlaylistEpisode,
  markEpisodeOpened,
  toggleEpisodeDone,
} from "@/lib/playlist-actions";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

type Ep = {
  id: string;
  title: string;
  url?: string;
  done?: boolean;
  orderKey?: string;
};

export function PlaylistBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [eps, setEps] = useState<Ep[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const [playlistUrl, setPlaylistUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string>("");

  const [runs, setRuns] = useState(0);
  const [runBusy, setRunBusy] = useState(false);

  useEffect(() => {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("archived", "==", false),
      orderBy("orderKey"),
    );
    return onSnapshot(q, (snap) =>
      setEps(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
    );
  }, [tenantId, blockId]);

  useEffect(() => {
    (async () => {
      const ref = doc(db, "tenants", tenantId, "nodes", blockId);
      const snap = await getDoc(ref);
      const data = snap.exists() ? (snap.data() as any) : {};
      setRuns(typeof data.runsCompleted === "number" ? data.runsCompleted : 0);
    })();
  }, [tenantId, blockId]);

  const nextEp = useMemo(
    () => eps.find((e) => !e.done) ?? eps[0] ?? null,
    [eps],
  );

  const doneCount = eps.filter((e) => e.done).length;
  const allDone = eps.length > 0 && doneCount === eps.length;

  async function add() {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) return;
    setBusy(true);
    await addPlaylistEpisode(tenantId, blockId, t, u);
    setTitle("");
    setUrl("");
    setBusy(false);
  }

  async function openEp(ep: Ep) {
    if (!ep.url) return;
    await markEpisodeOpened(tenantId, blockId, ep.id);
    window.open(ep.url, "_blank", "noopener,noreferrer");
  }

  async function importFromPlaylist() {
    const u = playlistUrl.trim();
    if (!u) return;

    setImporting(true);
    setImportError("");

    const r = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(u)}`);
    const data = await r.json();

    if (!r.ok) {
      setImportError(data?.error || "Import failed");
      setImporting(false);
      return;
    }

    await importPlaylistEpisodes({
      tenantId,
      blockId,
      episodes: data.episodes,
    });
    setImporting(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="h-9 rounded-md border px-3 text-sm"
          disabled={!nextEp?.url}
          onClick={() => nextEp && openEp(nextEp)}
        >
          متابعة
        </button>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>الختمات: {runs}</span>
          {/* <span>
            {doneCount}/{eps.length}
          </span> */}

          {allDone && (
            <button
              className="h-9 rounded-md border px-3 text-sm"
              disabled={runBusy}
              onClick={async () => {
                setRunBusy(true);
                await startNewPlaylistRun(tenantId, blockId);
                setRuns((r) => r + 1);
                setRunBusy(false);
              }}
            >
              {runBusy ? "..." : "ابدأ رحلة جديدة"}
            </button>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {eps.filter((e) => e.done).length}/{eps.length}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="عنوان الحلقة"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="رابط يوتيوب"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="h-9 rounded-md border px-3 text-sm"
          onClick={add}
          disabled={busy}
        >
          {busy ? "..." : "إضافة"}
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="رابط Playlist من يوتيوب"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
        />
        <button
          className="h-9 rounded-md border px-3 text-sm"
          onClick={importFromPlaylist}
          disabled={importing}
        >
          {importing ? "جارٍ الاستيراد..." : "استيراد"}
        </button>
      </div>

      {importError && <div className="text-sm text-red-500">{importError}</div>}

      <div className="space-y-2">
        {eps.map((ep) => (
          <div
            key={ep.id}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
          >
            <button
              className="text-right text-sm hover:underline"
              onClick={() => openEp(ep)}
              disabled={!ep.url}
            >
              <span
                className={ep.done ? "line-through text-muted-foreground" : ""}
              >
                {ep.title}
              </span>
            </button>

            <button
              className="rounded-md border px-2 py-1 text-xs"
              onClick={() => toggleEpisodeDone(tenantId, ep.id, !!ep.done)}
            >
              {ep.done ? "إرجاع" : "تم"}
            </button>
          </div>
        ))}

        {eps.length === 0 && (
          <div className="text-muted-foreground">لا توجد حلقات بعد.</div>
        )}
      </div>
    </div>
  );
}
