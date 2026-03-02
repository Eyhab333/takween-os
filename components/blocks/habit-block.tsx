/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  habitAdd,
  habitResetDay,
  habitSetConfig,
  habitDayId,
} from "@/lib/habit-actions";
import { collection, limit, orderBy, query, where } from "firebase/firestore";

function todayKeyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HabitBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  //const [dateKey, setDateKey] = useState<string>("");
  const [count, setCount] = useState(0);

  const [target, setTarget] = useState(1);
  const [unit, setUnit] = useState("مرة");

  const [targetDraft, setTargetDraft] = useState("1");
  const [unitDraft, setUnitDraft] = useState("مرة");

  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState<Array<{ dateKey: string; count: number }>>(
    [],
  );

  // dateKey خارج render
  //useEffect(() => setDateKey(todayKeyLocal()), []);
  const dateKey = todayKeyLocal();
  // block config
  useEffect(() => {
    const ref = doc(db, "tenants", tenantId, "nodes", blockId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;

      const t = typeof d.habitDailyTarget === "number" ? d.habitDailyTarget : 1;
      const u = typeof d.habitUnitLabel === "string" ? d.habitUnitLabel : "مرة";

      setTarget(t);
      setUnit(u);
      setTargetDraft(String(t));
      setUnitDraft(u);
    });
  }, [tenantId, blockId]);

  // today doc
  useEffect(() => {
    const dayDocId = habitDayId(blockId, dateKey);
    const ref = doc(db, "tenants", tenantId, "nodes", dayDocId);
    return onSnapshot(ref, (snap) => {
      const d = snap.exists() ? (snap.data() as any) : {};
      setCount(typeof d.count === "number" ? d.count : 0);
    });
  }, [tenantId, blockId, dateKey]);

  useEffect(() => {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("kind", "==", "habit_day"),
      where("archived", "==", false),
      orderBy("dateKey", "desc"),
      limit(60),
    );

    return onSnapshot(q, (snap) => {
      setDays(
        snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            dateKey: x.dateKey as string,
            count: typeof x.count === "number" ? x.count : 0,
          };
        }),
      );
    });
  }, [tenantId, blockId]);

  async function saveConfig() {
    const n = Number(targetDraft.trim());
    if (!Number.isFinite(n) || n <= 0) return;
    await habitSetConfig({
      tenantId,
      blockId,
      dailyTarget: n,
      unitLabel: unitDraft,
    });
  }

  async function add(delta: number) {
    if (!dateKey) return;
    setBusy(true);
    await habitAdd({ tenantId, blockId, dateKey, delta });
    setBusy(false);
  }

  async function resetToday() {
    if (!dateKey) return;
    setBusy(true);
    await habitResetDay({ tenantId, blockId, dateKey });
    setBusy(false);
  }

  const done = count >= target;

  function prevDateKey(key: string) {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  }

  const countByDate = useMemo(() => {
    const mp = new Map<string, number>();
    days.forEach((x) => mp.set(x.dateKey, x.count));
    return mp;
  }, [days]);

  const week = useMemo(() => {
    const keys: string[] = [];
    let k = dateKey;
    for (let i = 0; i < 7; i++) {
      keys.push(k);
      k = prevDateKey(k);
    }
    keys.reverse(); // من الأقدم لليوم
    return keys.map((dk) => {
      const c = countByDate.get(dk) ?? 0;
      return { dateKey: dk, count: c, done: c >= target, day: dk.slice(8, 10) };
    });
  }, [dateKey, countByDate, target]);

  const weekDone = useMemo(() => week.filter((d) => d.done).length, [week]);

  const streak = useMemo(() => {
    let s = 0;
    let k = dateKey;
    for (let i = 0; i < 60; i++) {
      const c = countByDate.get(k) ?? 0;
      if (c >= target) {
        s++;
        k = prevDateKey(k);
      } else break;
    }
    return s;
  }, [dateKey, countByDate, target]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="text-sm text-muted-foreground">اليوم</div>
        <div className="text-3xl font-bold">
          {count}/{target}{" "}
          <span className="text-base font-normal text-muted-foreground">
            {unit}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {done ? "مكتمل ✅" : "غير مكتمل"}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={() => add(1)} disabled={busy}>
            +1
          </Button>
          <Button
            variant="outline"
            onClick={() => add(-1)}
            disabled={busy || count <= 0}
          >
            -1
          </Button>
          <Button variant="outline" onClick={resetToday} disabled={busy}>
            Reset اليوم
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">الأسبوع</div>
          <div className="text-sm text-muted-foreground">ستريك: {streak}</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {week.map((d) => (
            <div
              key={d.dateKey}
              className={[
                "rounded-md border p-2 text-center text-xs",
                d.done ? "bg-muted" : "bg-background",
              ].join(" ")}
            >
              <div className="font-bold">{d.day}</div>
              <div className="text-muted-foreground">{d.count}</div>
            </div>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">مكتمل: {weekDone}/7</div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="text-sm font-bold">الإعدادات</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            placeholder="الهدف اليومي"
          />
          <Input
            value={unitDraft}
            onChange={(e) => setUnitDraft(e.target.value)}
            placeholder="الوحدة (مرة/كوب...)"
          />
          <Button variant="outline" onClick={saveConfig}>
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}
