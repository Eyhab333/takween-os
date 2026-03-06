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

const DAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

type Opt = { id: string; label: string }; // id already prefixed: a:... or i:...

function toPrefixed(kind: "a" | "i", id: string) {
  return `${kind}:${id}`;
}

export default function WeeklyPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [options, setOptions] = useState<Opt[]>([]);
  const [plan, setPlan] = useState<
    Array<{ primary: string | null; secondary: string[]; note: string }>
  >(
    Array.from({ length: 7 }, () => ({
      primary: null,
      secondary: [],
      note: "",
    })),
  );

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
          })),
        );
      }

      // load options (aspects + ibadah)
      const nodesRef = collection(db, "tenants", u.uid, "nodes");

      // aspects cards: parentId=asp_sec_main
      const qAsp = query(
        nodesRef,
        where("parentId", "==", "asp_sec_main"),
        where("type", "==", "card"),
        where("archived", "==", false),
        orderBy("orderKey"),
      );

      // ibadah cards: all cards whose parentId in known sections
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
        label: (d.data() as any).title || d.id,
      }));

      const ibaOpts: Opt[] = ibaSnap.docs.map((d) => ({
        id: toPrefixed("i", d.id),
        label: (d.data() as any).title || d.id,
      }));

      // group order: aspects then ibadah
      setOptions([
        ...aspOpts.map((o) => ({ ...o, label: `🟩 ${o.label}` })),
        ...ibaOpts.map((o) => ({ ...o, label: `🟦 ${o.label}` })),
      ]);

      setLoading(false);
    });
  }, []);

  const optionsMap = useMemo(() => {
    const m = new Map<string, string>();
    options.forEach((o) => m.set(o.id, o.label));
    return m;
  }, [options]);

  async function save() {
    if (!uid) return;
    await setDoc(
      doc(db, "users", uid),
      { weeklyPlan: { days: plan }, updatedAt: Date.now() },
      { merge: true },
    );
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

  function setPrimary(dayIdx: number, optId: string) {
    setPlan((cur) => {
      const next = [...cur];
      const d = { ...next[dayIdx] };
      d.primary = optId || null;
      next[dayIdx] = d;
      return next;
    });
  }

  function hrefFromPrefixed(pref: string) {
    const [id] = pref.split(":");
    if (!id) return "/";
    // both aspects + ibadah are cards
    return `/card/${id}`;
  }

  if (!auth.currentUser)
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">أسبوعي</h1>
        <Button variant="outline" onClick={save}>
          حفظ
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {DAYS.map((dayName, idx) => {
          const d = plan[idx];
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

              {/* Secondary */}
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
                          onSelect={(e) => e.preventDefault()} // عشان ما يقفلش كل مرة
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
