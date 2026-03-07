/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const DAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

type Opt = { id: string; label: string }; // prefixed id: a:xxx or i:xxx
type Slot = {
  id: string;
  title: string;
  desc: string;
  from: string;
  to: string;
};
type DayPlan = {
  primary: string | null;
  secondary: string[];
  note: string;
  slots: Slot[];
};

function emptyPlan(): DayPlan[] {
  return Array.from({ length: 7 }, () => ({
    primary: null,
    secondary: [],
    note: "",
    slots: [],
  }));
}

function toPrefixed(kind: "a" | "i", id: string) {
  return `${kind}:${id}`;
}

function hrefFromPrefixed(pref: string) {
  const [, id] = pref.split(":");
  return id ? `/card/${id}` : "/";
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function validateSlots(slots: Slot[], ignoreId?: string) {
  const list = slots
    .filter((s) => s.id !== ignoreId)
    .map((s) => {
      const a = timeToMin(s.from);
      const b = timeToMin(s.to);
      return { ...s, a, b };
    });

  for (const s of list) {
    if (s.a === null || s.b === null) return "صيغة الوقت غير صحيحة.";
    if (s.a >= s.b) return `الوقت غير صحيح: ${s.from} يجب أن يكون قبل ${s.to}.`;
  }

  const sorted = [...list].sort((x, y) => x.a! - y.a!);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    if (cur.b! > nxt.a!) {
      return `تعارض بين ${cur.from}–${cur.to} و ${nxt.from}–${nxt.to}.`;
    }
  }
  return "";
}

export default function WeeklyPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [options, setOptions] = useState<Opt[]>([]);
  const [plan, setPlan] = useState<DayPlan[]>(emptyPlan());

  const [saveError, setSaveError] = useState("");

  // dialog state
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgDayIdx, setDlgDayIdx] = useState<number>(0);
  const [dlgEditId, setDlgEditId] = useState<string | null>(null);
  const [dlgTitle, setDlgTitle] = useState("");
  const [dlgDesc, setDlgDesc] = useState("");
  const [dlgFrom, setDlgFrom] = useState("09:00");
  const [dlgTo, setDlgTo] = useState("10:00");
  const [dlgErr, setDlgErr] = useState("");

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setUid(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setUid(u.uid);

      // load weeklyPlan
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const data = userSnap.exists() ? (userSnap.data() as any) : {};
      const wp = data.weeklyPlan?.days;

      if (Array.isArray(wp) && wp.length === 7) {
        setPlan(
          wp.map((d: any) => ({
            primary: typeof d.primary === "string" ? d.primary : null,
            secondary: Array.isArray(d.secondary)
              ? d.secondary.filter((x: any) => typeof x === "string")
              : [],
            note: typeof d.note === "string" ? d.note : "",
            slots: Array.isArray(d.slots)
              ? d.slots
                  .filter((s: any) => s && typeof s.id === "string")
                  .map((s: any) => ({
                    id: String(s.id),
                    title: String(s.title || ""),
                    desc: String(s.desc || ""),
                    from: String(s.from || "09:00"),
                    to: String(s.to || "10:00"),
                  }))
              : [],
          })),
        );
      }

      // load options (aspects + ibadah)
      const nodesRef = collection(db, "tenants", u.uid, "nodes");

      const qAsp = query(
        nodesRef,
        where("parentId", "==", "asp_sec_main"),
        where("type", "==", "card"),
        where("archived", "==", false),
        orderBy("orderKey"),
      );

      const ibadahSectionIds = [
        "ib_sec_inner",
        "ib_sec_mind",
        "ib_sec_outer",
        "ib_sec_plan",
      ];
      const qIba = query(
        nodesRef,
        where("parentId", "in", ibadahSectionIds),
        where("type", "==", "card"),
        where("archived", "==", false),
        orderBy("orderKey"),
      );

      const [aspSnap, ibaSnap] = await Promise.all([
        getDocs(qAsp),
        getDocs(qIba),
      ]);

      const aspOpts: Opt[] = aspSnap.docs.map((d) => ({
        id: toPrefixed("a", d.id),
        label: `🟩 ${(d.data() as any).title || d.id}`,
      }));

      const ibaOpts: Opt[] = ibaSnap.docs.map((d) => ({
        id: toPrefixed("i", d.id),
        label: `🟦 ${(d.data() as any).title || d.id}`,
      }));

      setOptions([...aspOpts, ...ibaOpts]);
      setLoading(false);
    });
  }, []);

  const optionsMap = useMemo(() => {
    const m = new Map<string, string>();
    options.forEach((o) => m.set(o.id, o.label));
    return m;
  }, [options]);

  function setPrimary(dayIdx: number, optId: string) {
    setPlan((cur) => {
      const next = [...cur];
      next[dayIdx] = { ...next[dayIdx], primary: optId || null };
      return next;
    });
  }

  function toggleSecondary(dayIdx: number, optId: string) {
    setPlan((cur) => {
      const next = [...cur];
      const d = { ...next[dayIdx] };
      const has = d.secondary.includes(optId);
      d.secondary = has
        ? d.secondary.filter((x) => x !== optId)
        : [...d.secondary, optId];
      next[dayIdx] = d;
      return next;
    });
  }

  function openAddSlot(dayIdx: number) {
    setDlgDayIdx(dayIdx);
    setDlgEditId(null);
    setDlgTitle("");
    setDlgDesc("");
    setDlgFrom("09:00");
    setDlgTo("10:00");
    setDlgErr("");
    setDlgOpen(true);
  }

  function openEditSlot(dayIdx: number, s: Slot) {
    setDlgDayIdx(dayIdx);
    setDlgEditId(s.id);
    setDlgTitle(s.title);
    setDlgDesc(s.desc);
    setDlgFrom(s.from);
    setDlgTo(s.to);
    setDlgErr("");
    setDlgOpen(true);
  }

  function removeSlot(dayIdx: number, slotId: string) {
    setPlan((cur) => {
      const next = [...cur];
      const d = { ...next[dayIdx] };
      d.slots = d.slots.filter((s) => s.id !== slotId);
      next[dayIdx] = d;
      return next;
    });
  }

  function saveSlot() {
    const title = dlgTitle.trim();
    if (!title) {
      setDlgErr("اكتب عنوانًا للتوقيت.");
      return;
    }

    const candidate: Slot = {
      id:
        dlgEditId ||
        (globalThis.crypto?.randomUUID?.() ??
          `slot_${Math.random().toString(16).slice(2)}`),
      title,
      desc: dlgDesc,
      from: dlgFrom,
      to: dlgTo,
    };

    const day = plan[dlgDayIdx];
    const other = dlgEditId
      ? day.slots.filter((x) => x.id !== dlgEditId)
      : day.slots;
    const err = validateSlots([...other, candidate]);
    if (err) {
      setDlgErr(err);
      return;
    }

    setPlan((cur) => {
      const next = [...cur];
      const d = { ...next[dlgDayIdx] };

      const replaced = dlgEditId
        ? d.slots.map((s) => (s.id === dlgEditId ? candidate : s))
        : [...d.slots, candidate];

      d.slots = replaced.sort(
        (a, b) => timeToMin(a.from)! - timeToMin(b.from)!,
      );
      next[dlgDayIdx] = d;
      return next;
    });

    setDlgOpen(false);
  }

  async function saveAll() {
    if (!uid) return;

    // validate all days overlaps before save
    for (let i = 0; i < 7; i++) {
      const err = validateSlots(plan[i].slots);
      if (err) {
        setSaveError(`خطأ في يوم ${DAYS[i]}: ${err}`);
        return;
      }
    }

    setSaveError("");
    await setDoc(
      doc(db, "users", uid),
      { weeklyPlan: { days: plan }, updatedAt: Date.now() },
      { merge: true },
    );
  }

  if (!auth.currentUser)
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">أسبوعي</h1>
        <Button variant="outline" onClick={saveAll}>
          حفظ
        </Button>
      </div>

      {saveError && <div className="text-sm text-red-500">{saveError}</div>}

      <div className="grid gap-3 lg:grid-cols-2">
        {DAYS.map((dayName, idx) => {
          const d = plan[idx];
          const dayErr = validateSlots(d.slots);

          return (
            <div
              key={dayName}
              className="rounded-lg border bg-card p-4 space-y-3"
            >
              <div className="font-bold">{dayName}</div>

              {/* Primary */}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  الأولوية الرئيسية
                </div>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={d.primary ?? ""}
                  onChange={(e) => setPrimary(idx, e.target.value)}
                >
                  <option value="">—</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {d.primary && (
                  <Link
                    className="text-sm underline"
                    href={hrefFromPrefixed(d.primary)}
                  >
                    اذهب للأولوية الرئيسية
                  </Link>
                )}
              </div>

              {/* Secondary dropdown multi */}
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  أولويات إضافية
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {d.secondary.length
                        ? `مختار: ${d.secondary.length}`
                        : "اختر أولويات إضافية"}
                      <span className="text-muted-foreground">▾</span>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    className="w-[--radix-dropdown-menu-trigger-width] max-h-80 overflow-auto"
                  >
                    {options.map((o) => {
                      const checked = d.secondary.includes(o.id);
                      return (
                        <DropdownMenuCheckboxItem
                          key={o.id}
                          checked={checked}
                          onCheckedChange={() => toggleSecondary(idx, o.id)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {o.label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {d.secondary.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {d.secondary.map((sid) => (
                      <Link
                        key={sid}
                        className="text-xs underline"
                        href={hrefFromPrefixed(sid)}
                      >
                        {optionsMap.get(sid) ?? sid}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">ملاحظة</div>
                <Input
                  value={d.note}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPlan((cur) => {
                      const next = [...cur];
                      next[idx] = { ...next[idx], note: v };
                      return next;
                    });
                  }}
                  placeholder="اختياري"
                />
              </div>

              {/* Slots */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">التوقيتات</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddSlot(idx)}
                  >
                    إضافة توقيت
                  </Button>
                </div>

                {dayErr && <div className="text-xs text-red-500">{dayErr}</div>}

                <div className="space-y-2">
                  {d.slots.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold">
                            {s.from} – {s.to} • {s.title}
                          </div>
                          {s.desc && (
                            <div className="text-xs text-muted-foreground">
                              {s.desc}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditSlot(idx, s)}
                          >
                            تعديل
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeSlot(idx, s.id)}
                          >
                            حذف
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {d.slots.length === 0 && (
                    <div className="text-muted-foreground">
                      لا يوجد توقيتات بعد.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slot Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-right">
              {dlgEditId ? "تعديل توقيت" : "إضافة توقيت"} — {DAYS[dlgDayIdx]}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {dlgErr && <div className="text-sm text-red-500">{dlgErr}</div>}

            <div className="space-y-1">
              <div className="text-sm font-bold">العنوان</div>
              <Input
                value={dlgTitle}
                onChange={(e) => setDlgTitle(e.target.value)}
                placeholder="مثال: مراجعة / رياضة"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold">وصف</div>
              <Textarea
                value={dlgDesc}
                onChange={(e) => setDlgDesc(e.target.value)}
                className="min-h-25"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-bold">من</div>
                <Input
                  type="time"
                  value={dlgFrom}
                  onChange={(e) => setDlgFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold">إلى</div>
                <Input
                  type="time"
                  value={dlgTo}
                  onChange={(e) => setDlgTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              إلغاء
            </Button>
            <Button variant="outline" onClick={saveSlot}>
              حفظ التوقيت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
