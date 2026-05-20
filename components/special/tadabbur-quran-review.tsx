/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { db } from "@/lib/firebase";
import { SURAH_NAMES, AYAH_COUNTS } from "@/lib/quran-data";
import {
  ensureTadabburQuranReview,
  finalizeEntry,
  setEntryTimestamp,
} from "@/lib/quran-review-actions";
import {
  collection,
  doc,
  getDocs,
  limit,
  limitToLast,
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

type BlockState = {
  runs: number;
  currentRun: number;
  currentOpenEntryId: string | null;
};

type DraftRange = {
  startSurah: number;
  startAyah: number;
  endSurah: number | null;
  endAyah: number | null;
};

const RECENT_LIMIT = 10;
const HISTORY_LIMIT = 100;

const SURAH_OPTIONS = SURAH_NAMES.map((name, idx) => ({
  value: String(idx + 1),
  label: name,
}));

const AYAH_OPTIONS_BY_SURAH = AYAH_COUNTS.map((count) =>
  Array.from({ length: count }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
);

function ayahOptions(surahNum?: number | null) {
  const idx = (surahNum ?? 1) - 1;
  return AYAH_OPTIONS_BY_SURAH[idx] ?? AYAH_OPTIONS_BY_SURAH[0];
}

function surahName(surahNum?: number | null) {
  if (!surahNum) return "-";
  return SURAH_NAMES[surahNum - 1] ?? String(surahNum);
}

function ayahText(ayahNum?: number | null) {
  return ayahNum ? String(ayahNum) : "-";
}

function formatRange(e: Entry) {
  return `${surahName(e.startSurah)}:${ayahText(e.startAyah)} → ${surahName(
    e.endSurah,
  )}:${ayahText(e.endAyah)}`;
}

function entryToDraft(entry: Entry): DraftRange {
  return {
    startSurah: entry.startSurah ?? 1,
    startAyah: entry.startAyah ?? 1,
    endSurah: entry.endSurah ?? null,
    endAyah: entry.endAyah ?? null,
  };
}

export function TadabburQuranReview({ tenantId }: { tenantId: string }) {
  const [blockId, setBlockId] = useState<string | null>(null);
  const [blockState, setBlockState] = useState<BlockState>({
    runs: 0,
    currentRun: 1,
    currentOpenEntryId: null,
  });

  const [openEntry, setOpenEntry] = useState<Entry | null>(null);
  const [recentEntries, setRecentEntries] = useState<Entry[]>([]);
  const [openEntryLoading, setOpenEntryLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);

  const [busyId, setBusyId] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);

  // ensure block + current open entry
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await ensureTadabburQuranReview(tenantId);
      if (!cancelled) setBlockId(res.blockId);
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // subscribe block doc only
  useEffect(() => {
    if (!blockId) return;

    return onSnapshot(
      doc(db, "tenants", tenantId, "nodes", blockId),
      (snap) => {
        const d = snap.exists() ? (snap.data() as any) : {};
        setBlockState({
          runs: typeof d.runsCompleted === "number" ? d.runsCompleted : 0,
          currentRun: typeof d.currentRun === "number" ? d.currentRun : 1,
          currentOpenEntryId:
            typeof d.currentOpenEntryId === "string"
              ? d.currentOpenEntryId
              : null,
        });
      },
    );
  }, [tenantId, blockId]);

  // subscribe current open entry only
  useEffect(() => {
    if (!blockState.currentOpenEntryId) {
      setOpenEntry(null);
      setOpenEntryLoading(false);
      return;
    }

    setOpenEntryLoading(true);

    return onSnapshot(
      doc(db, "tenants", tenantId, "nodes", blockState.currentOpenEntryId),
      (snap) => {
        setOpenEntry(
          snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null,
        );
        setOpenEntryLoading(false);
      },
    );
  }, [tenantId, blockState.currentOpenEntryId]);

  // subscribe last entries only, not the full current run
  useEffect(() => {
    if (!blockId) return;

    setRecentLoading(true);

    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const qRecent = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("archived", "==", false),
      where("runNumber", "==", blockState.currentRun),
      orderBy("orderKey"),
      limitToLast(RECENT_LIMIT + 1),
    );

    return onSnapshot(qRecent, (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Entry[];
      setRecentEntries(
        rows
          .filter((e) => e.locked)
          .reverse()
          .slice(0, RECENT_LIMIT),
      );
      setRecentLoading(false);
    });
  }, [tenantId, blockId, blockState.currentRun]);

  async function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (!next || !blockId) return;

    setHistoryBusy(true);
    try {
      const nodesRef = collection(db, "tenants", tenantId, "nodes");
      const qHist = query(
        nodesRef,
        where("parentId", "==", blockId),
        where("type", "==", "item"),
        where("archived", "==", false),
        where("runNumber", "<", blockState.currentRun),
        orderBy("runNumber", "desc"),
        orderBy("orderKey", "desc"),
        limit(HISTORY_LIMIT),
      );

      const snap = await getDocs(qHist);
      setHistory(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } finally {
      setHistoryBusy(false);
    }
  }

  const isLoading = !blockId || openEntryLoading || recentLoading;

  if (!blockId) {
    return <div className="text-muted-foreground">جارٍ التحضير...</div>;
  }

  return (
    <div className="space-y-4">
      <ReviewHeader
        runs={blockState.runs}
        currentRun={blockState.currentRun}
        showHistory={showHistory}
        historyBusy={historyBusy}
        onToggleHistory={toggleHistory}
      />

      {showHistory && (
        <HistoryList history={history} historyBusy={historyBusy} />
      )}

      {isLoading ? (
        <Loading full label="جار التحميل" />
      ) : (
        <>
          {openEntry ? (
            <CurrentReviewCard
              tenantId={tenantId}
              entry={openEntry}
              busyId={busyId}
              setBusyId={setBusyId}
            />
          ) : (
            <div className="rounded-lg border bg-card p-4 text-muted-foreground">
              لا توجد مراجعة مفتوحة حاليًا.
            </div>
          )}

          <RecentReviewList entries={recentEntries} />
        </>
      )}
    </div>
  );
}

const ReviewHeader = memo(function ReviewHeader({
  runs,
  currentRun,
  showHistory,
  historyBusy,
  onToggleHistory,
}: {
  runs: number;
  currentRun: number;
  showHistory: boolean;
  historyBusy: boolean;
  onToggleHistory: () => void;
}) {
  return (
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
        onClick={onToggleHistory}
        disabled={historyBusy}
      >
        {showHistory ? "إخفاء السجل" : historyBusy ? "..." : "عرض السجل"}
      </Button>
    </div>
  );
});

const HistoryList = memo(function HistoryList({
  history,
  historyBusy,
}: {
  history: Entry[];
  historyBusy: boolean;
}) {
  if (historyBusy) {
    return (
      <div className="text-sm text-muted-foreground">جارٍ تحميل السجل...</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-bold">السجل</div>

      {history.length === 0 ? (
        <div className="text-muted-foreground">لا يوجد سجل بعد.</div>
      ) : (
        history.map((h) => <LockedReviewCard key={h.id} entry={h} showRun />)
      )}
    </div>
  );
});

function CurrentReviewCard({
  tenantId,
  entry,
  busyId,
  setBusyId,
}: {
  tenantId: string;
  entry: Entry;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  const [draft, setDraft] = useState<DraftRange>(() => entryToDraft(entry));

  useEffect(() => {
    setDraft(entryToDraft(entry));
  }, [
    entry.id,
    entry.startSurah,
    entry.startAyah,
    entry.endSurah,
    entry.endAyah,
  ]);

  const canFinish = Boolean(draft.endSurah && draft.endAyah);
  const isBusy = busyId === entry.id;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold">المراجعة الحالية</div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setEntryTimestamp(tenantId, entry.id)}
        >
          {entry.timestampLabel ? entry.timestampLabel : "تاريخ اليوم"}
        </Button>
      </div>

      <QuranRangePicker draft={draft} onChange={setDraft} />

      <div className="mt-4">
        <Button
          variant="outline"
          disabled={!canFinish || isBusy}
          onClick={async () => {
            if (!draft.endSurah || !draft.endAyah) return;

            setBusyId(entry.id);
            try {
              await finalizeEntry({
                tenantId,
                entryId: entry.id,
                startSurah: draft.startSurah,
                startAyah: draft.startAyah,
                endSurah: draft.endSurah,
                endAyah: draft.endAyah,
              });
            } finally {
              setBusyId(null);
            }
          }}
        >
          {isBusy ? "..." : "تم"}
        </Button>
      </div>
    </div>
  );
}

const QuranRangePicker = memo(function QuranRangePicker({
  draft,
  onChange,
}: {
  draft: DraftRange;
  onChange: Dispatch<SetStateAction<DraftRange>>;
}) {
  const startAyahOptions = useMemo(
    () => ayahOptions(draft.startSurah),
    [draft.startSurah],
  );
  const endAyahOptions = useMemo(
    () => ayahOptions(draft.endSurah ?? 1),
    [draft.endSurah],
  );

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <div className="text-sm font-bold">البداية</div>
        <div className="flex gap-2">
          <Select
            value={String(draft.startSurah)}
            onValueChange={(v) =>
              onChange((cur) => ({
                ...cur,
                startSurah: Number(v),
                startAyah: 1,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURAH_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(draft.startAyah)}
            onValueChange={(v) =>
              onChange((cur) => ({ ...cur, startAyah: Number(v) }))
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {startAyahOptions.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-bold">النهاية</div>
        <div className="flex gap-2">
          <Select
            value={draft.endSurah ? String(draft.endSurah) : ""}
            onValueChange={(v) =>
              onChange((cur) => ({
                ...cur,
                endSurah: Number(v),
                endAyah: 1,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر السورة" />
            </SelectTrigger>
            <SelectContent>
              {SURAH_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={draft.endAyah ? String(draft.endAyah) : ""}
            onValueChange={(v) =>
              onChange((cur) => ({ ...cur, endAyah: Number(v) }))
            }
            disabled={!draft.endSurah}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="آية" />
            </SelectTrigger>
            <SelectContent>
              {endAyahOptions.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
});

const RecentReviewList = memo(function RecentReviewList({
  entries,
}: {
  entries: Entry[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold">آخر المراجعات</div>
        <div className="text-xs text-muted-foreground">
          آخر {RECENT_LIMIT} فقط
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border bg-card p-4 text-muted-foreground">
          لا توجد مراجعات مكتملة في الختمة الحالية بعد.
        </div>
      ) : (
        entries.map((e) => <LockedReviewCard key={e.id} entry={e} />)
      )}
    </div>
  );
});

const LockedReviewCard = memo(function LockedReviewCard({
  entry,
  showRun = false,
}: {
  entry: Entry;
  showRun?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold">
          {showRun ? `ختمة ${entry.runNumber ?? "-"}` : "مراجعة"}
        </div>
        <div className="text-xs text-muted-foreground">
          {entry.timestampLabel || "بدون تاريخ"}
        </div>
      </div>
      <div className="mt-1 text-muted-foreground">{formatRange(entry)}</div>
    </div>
  );
});
