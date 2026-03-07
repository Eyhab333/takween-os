/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { SURAH_NAMES, AYAH_COUNTS } from "@/lib/quran-data";
import {
  ensureTadabburQuranReview,
  finalizeEntry,
  patchEntry,
  setEntryTimestamp,
} from "@/lib/quran-review-actions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Loading } from "@/components/loading";

type Entry = {
  id: string;
  locked?: boolean;
  timestampLabel?: string;
  startSurah?: number;
  startAyah?: number;
  endSurah?: number | null;
  endAyah?: number | null;
  runNumber?: number | null;
};

export function TadabburQuranReview({ tenantId }: { tenantId: string }) {
  const [blockId, setBlockId] = useState<string | null>(null);

  const [runs, setRuns] = useState(0);
  const [currentRun, setCurrentRun] = useState(1);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(true);

  // ensure block + open entry
  useEffect(() => {
    (async () => {
      const res = await ensureTadabburQuranReview(tenantId);
      setBlockId(res.blockId);
    })();
  }, [tenantId]);

  // subscribe block doc only (runs + currentRun)
  useEffect(() => {
    if (!blockId) return;

    return onSnapshot(
      doc(db, "tenants", tenantId, "nodes", blockId),
      (snap) => {
        const d = snap.exists() ? (snap.data() as any) : {};
        setRuns(typeof d.runsCompleted === "number" ? d.runsCompleted : 0);
        setCurrentRun(typeof d.currentRun === "number" ? d.currentRun : 1);
      },
    );
  }, [tenantId, blockId]);

  // subscribe entries for currentRun only
  useEffect(() => {
    if (!blockId) return;

    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const qEntries = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("archived", "==", false),
      where("runNumber", "==", currentRun),
      orderBy("orderKey"),
    );

    return onSnapshot(qEntries, (snap) => {
      setEntriesLoading(true);
      setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setEntriesLoading(false);
    });
  }, [tenantId, blockId, currentRun]);

  const openEntryId = useMemo(() => {
    const open = [...entries].reverse().find((e) => !e.locked);
    return open?.id ?? null;
  }, [entries]);

  const ayahOptions = (surahNum?: number) => {
    const idx = (surahNum ?? 1) - 1;
    const max = AYAH_COUNTS[idx] ?? 7;
    return Array.from({ length: max }, (_, i) => i + 1);
  };

  async function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (!next) return;

    if (!blockId) return;

    setHistoryBusy(true);
    try {
      const nodesRef = collection(db, "tenants", tenantId, "nodes");
      const qHist = query(
        nodesRef,
        where("parentId", "==", blockId),
        where("type", "==", "item"),
        where("archived", "==", false),
        where("runNumber", "<", currentRun),
        orderBy("runNumber", "desc"),
        orderBy("orderKey", "desc"),
      );

      const snap = await getDocs(qHist);
      setHistory(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } finally {
      setHistoryBusy(false);
    }
  }

  if (!blockId)
    return <div className="text-muted-foreground">جارٍ التحضير...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          عدد الختمات: <span className="font-bold text-foreground">{runs}</span>
          <span className="mx-2">•</span>
          الختمة الحالية:{" "}
          <span className="font-bold text-foreground">{currentRun}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleHistory}
          disabled={historyBusy}
        >
          {showHistory ? "إخفاء السجل" : historyBusy ? "..." : "عرض السجل"}
        </Button>
      </div>

      {showHistory && (
        <div className="space-y-2">
          <div className="text-sm font-bold">السجل</div>

          {history.length === 0 ? (
            <div className="text-muted-foreground">لا يوجد سجل بعد.</div>
          ) : (
            history.map((h) => (
              <div key={h.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="font-bold">ختمة {h.runNumber ?? "-"}</div>
                <div className="text-muted-foreground">
                  {h.timestampLabel || ""} — {h.startSurah}:{h.startAyah} →{" "}
                  {h.endSurah ?? "-"}:{h.endAyah ?? "-"}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="space-y-3">
        {entriesLoading ? (
          <Loading full label="جار التحميل" />
        ) : (
          entries.map((e) => {
            const locked = !!e.locked;
            const editable = !locked && e.id === openEntryId;

            const startSurah = e.startSurah ?? 1;
            const startAyah = e.startAyah ?? 1;

            const endSurah = (e.endSurah ?? null) as number | null;
            const endAyah = (e.endAyah ?? null) as number | null;

            return (
              <div
                key={e.id}
                className={`rounded-lg border bg-card p-4 ${locked ? "opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold">مراجعة</div>

                  {editable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEntryTimestamp(tenantId, e.id)}
                    >
                      {e.timestampLabel ? e.timestampLabel : "تاريخ اليوم"}
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {e.timestampLabel || (locked ? "بدون تاريخ" : "")}
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {/* البداية */}
                  <div className="space-y-2">
                    <div className="text-sm font-bold">البداية</div>
                    <div className="flex gap-2">
                      <Select
                        value={String(startSurah)}
                        onValueChange={(v) =>
                          patchEntry(tenantId, e.id, {
                            startSurah: Number(v),
                            startAyah: 1,
                          })
                        }
                        disabled={!editable}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SURAH_NAMES.map((name, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={String(startAyah)}
                        onValueChange={(v) =>
                          patchEntry(tenantId, e.id, { startAyah: Number(v) })
                        }
                        disabled={!editable}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ayahOptions(startSurah).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* النهاية */}
                  <div className="space-y-2">
                    <div className="text-sm font-bold">النهاية</div>
                    <div className="flex gap-2">
                      <Select
                        value={endSurah ? String(endSurah) : ""}
                        onValueChange={(v) =>
                          patchEntry(tenantId, e.id, {
                            endSurah: Number(v),
                            endAyah: 1,
                          })
                        }
                        disabled={!editable}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="اختر السورة" />
                        </SelectTrigger>
                        <SelectContent>
                          {SURAH_NAMES.map((name, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={endAyah ? String(endAyah) : ""}
                        onValueChange={(v) =>
                          patchEntry(tenantId, e.id, { endAyah: Number(v) })
                        }
                        disabled={!editable || !endSurah}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="آية" />
                        </SelectTrigger>
                        <SelectContent>
                          {ayahOptions(endSurah ?? 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {editable && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      disabled={!endSurah || !endAyah || busyId === e.id}
                      onClick={async () => {
                        if (!endSurah || !endAyah) return;
                        setBusyId(e.id);
                        await finalizeEntry({
                          tenantId,
                          entryId: e.id,
                          endSurah,
                          endAyah,
                        });
                        setBusyId(null);
                      }}
                    >
                      {busyId === e.id ? "..." : "تم"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
