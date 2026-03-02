/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  counterAdd,
  counterReset,
  counterSetTarget,
} from "@/lib/counter-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

type LogRow = { id: string; title: string; delta?: number; createdAt?: number };

export function CounterBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [targetDraft, setTargetDraft] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState(false);

  // block doc (current/target)
  useEffect(() => {
    const ref = doc(db, "tenants", tenantId, "nodes", blockId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      const cur = typeof d.counterCurrent === "number" ? d.counterCurrent : 0;
      const tar = typeof d.counterTarget === "number" ? d.counterTarget : null;

      setCurrent(cur);
      setTarget(tar);
      setTargetDraft(tar === null ? "" : String(tar));
    });
  }, [tenantId, blockId]);

  // history logs (آخر 20)
  useEffect(() => {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("logKind", "==", "counter"),
      where("archived", "==", false),
      orderBy("orderKey", "desc"),
      limit(20),
    );
    return onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [tenantId, blockId]);

  const percent = useMemo(() => {
    if (!target || target <= 0) return null;
    return Math.min(100, Math.round((current / target) * 100));
  }, [current, target]);

  async function applyTarget() {
    const t = targetDraft.trim();
    if (t === "") {
      await counterSetTarget({ tenantId, blockId, target: null });
      return;
    }

    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return;

    await counterSetTarget({ tenantId, blockId, target: n });
  }

  async function add(delta: number) {
    setBusy(true);
    await counterAdd({ tenantId, blockId, delta });
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">العدد</div>
          <div className="text-3xl font-bold">{current}</div>
          {percent !== null && (
            <div className="text-xs text-muted-foreground">{percent}%</div>
          )}
        </div>

        <div className="w-48 space-y-1">
          <div className="text-sm text-muted-foreground">
            الهدف (اتركه فارغًا = مفتوح)
          </div>
          <div className="flex gap-2">
            <Input
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
              placeholder="مثال: 10"
            />
            <Button variant="outline" onClick={applyTarget}>
              حفظ
            </Button>
          </div>
          {target !== null && (
            <div className="text-xs text-muted-foreground">
              المتبقي: {Math.max(0, target - current)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => add(1)} disabled={busy}>
          +1
        </Button>
        <Button variant="outline" onClick={() => add(5)} disabled={busy}>
          +5
        </Button>
        <Button variant="outline" onClick={() => add(-1)} disabled={busy}>
          -1
        </Button>
        <Button
          variant="outline"
          onClick={() => counterReset({ tenantId, blockId })}
          disabled={busy}
        >
          Reset
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-bold">السجل</div>
        {logs.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
          >
            <div>{l.title}</div>
            <div className="text-xs text-muted-foreground">
              {l.createdAt ? new Date(l.createdAt).toLocaleString("ar") : ""}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-muted-foreground">لا يوجد سجل بعد.</div>
        )}
      </div>
    </div>
  );
}
