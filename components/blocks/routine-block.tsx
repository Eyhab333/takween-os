/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
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
import {
  routineAddStep,
  routineRemoveStep,
  routineStartSession,
  routineToggleStep,
  routineFinishSession,
} from "@/lib/routine-actions";

type Step = { id: string; label: string };

type Session = {
  id: string;
  locked?: boolean;
  startedAt?: number;
  endedAt?: number | null;
  results?: Record<string, boolean>;
  scoreDone?: number;
  scoreTotal?: number;
  scorePercent?: number;
};

export function RoutineBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepText, setStepText] = useState("");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);

  // steps from block doc
  useEffect(() => {
    const ref = doc(db, "tenants", tenantId, "nodes", blockId);
    return onSnapshot(ref, (snap) => {
      const d = snap.exists() ? (snap.data() as any) : {};
      setSteps(Array.isArray(d.routineSteps) ? d.routineSteps : []);
    });
  }, [tenantId, blockId]);

  // sessions list
  useEffect(() => {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("kind", "==", "routine_session"),
      where("archived", "==", false),
      orderBy("startedAt", "desc"),
      limit(20),
    );
    return onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [tenantId, blockId]);

  const active = useMemo(
    () => sessions.find((s) => !s.locked) ?? null,
    [sessions],
  );

  const results = (active?.results ?? {}) as Record<string, boolean>;

  const doneCount = steps.filter((s) => !!results[s.id]).length;
  const totalCount = steps.length;
  const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  async function addStep() {
    await routineAddStep(tenantId, blockId, stepText);
    setStepText("");
  }

  async function start() {
    setBusy(true);
    await routineStartSession(tenantId, blockId);
    setBusy(false);
  }

  async function finish() {
    if (!active) return;
    setBusy(true);
    await routineFinishSession(tenantId, active.id, {
      done: doneCount,
      total: totalCount,
      percent,
    });
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {/* Steps config */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          التقدم: {doneCount}/{totalCount} ({percent}%)
        </div>

        <div className="text-sm font-bold">الخطوات</div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="أضف خطوة..."
            value={stepText}
            onChange={(e) => setStepText(e.target.value)}
          />
          <Button variant="outline" onClick={addStep}>
            إضافة
          </Button>
        </div>

        <div className="space-y-2">
          {steps.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
            >
              <div>{s.label}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => routineRemoveStep(tenantId, blockId, s.id)}
              >
                حذف
              </Button>
            </div>
          ))}
          {steps.length === 0 && (
            <div className="text-muted-foreground">أضف خطوات للروتين.</div>
          )}
        </div>
      </div>

      {/* Session */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">الجلسة</div>
          {!active ? (
            <Button
              variant="outline"
              onClick={start}
              disabled={busy || steps.length === 0}
            >
              {busy ? "..." : "ابدأ جلسة"}
            </Button>
          ) : (
            <Button variant="outline" onClick={finish} disabled={busy}>
              {busy ? "..." : "إنهاء"}
            </Button>
          )}
        </div>

        {!active ? (
          <div className="text-muted-foreground">لا توجد جلسة نشطة.</div>
        ) : (
          <div className="space-y-2">
            {steps.map((s) => {
              const v = !!results[s.id];
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div
                    className={v ? "line-through text-muted-foreground" : ""}
                  >
                    {s.label}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      routineToggleStep(tenantId, active.id, s.id, !v)
                    }
                  >
                    {v ? "إرجاع" : "تم"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="text-sm font-bold">السجل (آخر 10)</div>
        {sessions
          .filter((s) => s.locked)
          .slice(0, 10)
          .map((s) => (
            <div
              key={s.id}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <div className="text-muted-foreground">
                {s.startedAt ? new Date(s.startedAt).toLocaleString("ar") : ""}{" "}
                {s.endedAt
                  ? `→ ${new Date(s.endedAt).toLocaleString("ar")}`
                  : ""}
              </div>
            </div>
          ))}
        {sessions.filter((s) => s.locked).length === 0 && (
          <div className="text-muted-foreground">لا يوجد سجل بعد.</div>
        )}
      </div>
    </div>
  );
}
