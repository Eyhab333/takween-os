/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { toggleYearDoneDate } from "@/lib/year-actions";

const WEEK_START = 0; // 0 = Sunday (رسمي غالبًا)
const WD = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function dateKey(y: number, m1: number, d: number) {
  return `${y}-${pad2(m1)}-${pad2(d)}`;
}
function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
function isLeap(y: number) {
  return new Date(y, 1, 29).getMonth() === 1;
}

export function YearCalendar({
  tenantId,
  yearCardId,
  year,
}: {
  tenantId: string;
  yearCardId: string;
  year: number;
}) {
  const [doneDates, setDoneDates] = useState<string[]>([]);

  useEffect(() => {
    const ref = doc(db, "tenants", tenantId, "nodes", yearCardId);
    return onSnapshot(ref, (snap) => {
      const d = snap.exists() ? (snap.data() as any) : {};
      setDoneDates(Array.isArray(d.doneDates) ? d.doneDates : []);
    });
  }, [tenantId, yearCardId]);

  const doneSet = useMemo(() => new Set(doneDates), [doneDates]);
  const totalDays = isLeap(year) ? 366 : 365;
  const doneCount = doneSet.size;

  const weekDays = useMemo(() => {
    const arr = [...WD];
    return WEEK_START === 0
      ? arr
      : arr.slice(WEEK_START).concat(arr.slice(0, WEEK_START));
  }, []);

  function monthGrid(m0: number) {
    const firstDow = new Date(year, m0, 1).getDay(); // 0=Sun
    const offset = (firstDow - WEEK_START + 7) % 7;
    const dim = daysInMonth(year, m0);
    const cells: Array<{ d?: number }> = Array.from(
      { length: offset },
      () => ({}),
    );
    for (let d = 1; d <= dim; d++) cells.push({ d });
    return cells;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xl font-bold">{year}</div>
          <div className="text-sm text-muted-foreground">
            الأيام المُغلقة: {doneCount}/{totalDays}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {MONTHS.map((name, mIdx) => {
          const cells = monthGrid(mIdx);
          return (
            <div key={name} className="rounded-lg border bg-card p-3">
              <div className="mb-2 font-bold">{name}</div>

              <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
                {weekDays.map((x) => (
                  <div key={x} className="text-center">
                    {x}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((c, i) => {
                  if (!c.d) return <div key={i} />;
                  const dk = dateKey(year, mIdx + 1, c.d);
                  const isDone = doneSet.has(dk);

                  return (
                    <button
                      key={dk}
                      onClick={() =>
                        toggleYearDoneDate({
                          tenantId,
                          yearCardId,
                          dateKey: dk,
                          isDone,
                        })
                      }
                      className={[
                        "h-8 rounded-md border text-xs font-bold",
                        isDone
                          ? "bg-muted text-muted-foreground opacity-60"
                          : "bg-background hover:bg-muted",
                      ].join(" ")}
                      title={dk}
                    >
                      {c.d}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
