/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ensureYearCard } from "@/lib/templates/years";
import { saveBirthDate, saveCompass } from "@/lib/profile-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { saveFocusCurrent, clearFocusCurrent } from "@/lib/profile-actions";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function computeAgeYMD(birth: Date, now: Date) {
  let y = now.getFullYear() - birth.getFullYear();
  let m = now.getMonth() - birth.getMonth();
  let d = now.getDate() - birth.getDate();

  if (d < 0) {
    const prevMonthDays = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    ).getDate();
    d += prevMonthDays;
    m -= 1;
  }
  if (m < 0) {
    m += 12;
    y -= 1;
  }
  return {
    years: Math.max(0, y),
    months: Math.max(0, m),
    days: Math.max(0, d),
  };
}

const PRIORITIES = [
  { id: "ib_card_inner_allah", label: "الشريعة والإصلاح" },
  { id: "asp_card_professional", label: "الجانب المهني" },
  { id: "asp_card_financial", label: "الجانب المالي" },
  { id: "asp_card_health", label: "الصحي" },
  { id: "asp_card_human", label: "البشري" },
  { id: "asp_card_psych", label: "النفسي" },
  { id: "asp_card_mental", label: "العقلي" },
  { id: "asp_card_personal", label: "الشخصي" },
  { id: "asp_card_family", label: "الأسري" },
  { id: "asp_card_relatives", label: "العائلي" },
  { id: "asp_card_social", label: "الاجتماعي" },
] as const;

export default function Home() {
  const router = useRouter();
  const [nowMs] = useState(() => Date.now());

  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");

  const [birthDate, setBirthDate] = useState<string>(""); // YYYY-MM-DD
  const [editBirth, setEditBirth] = useState(false);
  const [savingBirth, setSavingBirth] = useState(false);

  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [values, setValues] = useState("");
  const [savingCompass, setSavingCompass] = useState(false);
  const [compassError, setCompassError] = useState("");

  const [loading, setLoading] = useState(true);

  const [focusTitle, setFocusTitle] = useState("");
  const [focusDesc, setFocusDesc] = useState("");
  const [focusSelected, setFocusSelected] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [focusSaving, setFocusSaving] = useState(false);
  const [focusError, setFocusError] = useState("");

  const [routines, setRoutines] = useState<
    Array<{ id: string; title: string; blockType: string; updatedAt?: number }>
  >([]);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setUid(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setUid(u.uid);
      setName(u.displayName || "مستخدم");

      const userSnap = await getDoc(doc(db, "users", u.uid));
      const data = userSnap.exists() ? (userSnap.data() as any) : {};

      const bd = typeof data.birthDate === "string" ? data.birthDate : "";
      setBirthDate(bd);
      setEditBirth(!bd); // لو مفيش تاريخ ميلاد: افتح الفورم تلقائيًا

      const c = data.compass || {};
      setMission(typeof c.mission === "string" ? c.mission : "");
      setVision(typeof c.vision === "string" ? c.vision : "");
      setValues(typeof c.values === "string" ? c.values : "");

      const f = data.focusCurrent || null;
      setFocusTitle(typeof f?.title === "string" ? f.title : "");
      setFocusDesc(typeof f?.description === "string" ? f.description : "");
      setFocusSelected(Array.isArray(f?.priorities) ? f.priorities : []);

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;

    const nodesRef = collection(db, "tenants", uid, "nodes");
    const qBlocks = query(
      nodesRef,
      where("archived", "==", false),
      where("type", "==", "block"),
      orderBy("updatedAt", "desc"),
      limit(50),
    );

    return onSnapshot(qBlocks, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((x) => x.blockType === "habit" || x.blockType === "routine")
        .map((x) => ({
          id: x.id,
          title: x.title || x.id,
          blockType: x.blockType,
          updatedAt: x.updatedAt,
        }))
        .slice(0, 20);

      setRoutines(rows);
    });
  }, [uid]);

  const computed = useMemo(() => {
    if (!birthDate) return null;

    const birth = new Date(`${birthDate}T00:00:00`);
    const now = new Date(nowMs);

    const age = computeAgeYMD(birth, now);

    const startYear = birth.getFullYear();
    const endYear = startYear + 89; // 1..90
    const currentYearRaw = now.getFullYear();
    const currentYear = Math.min(Math.max(currentYearRaw, startYear), endYear);

    const years = Array.from({ length: 90 }, (_, i) => startYear + i);
    const past = years.filter((y) => y < currentYear);
    const future = years.filter((y) => y > currentYear);

    return { age, startYear, endYear, currentYear, past, future };
  }, [birthDate, nowMs]);

  async function openYear(year: number) {
    if (!uid) return;
    await ensureYearCard(uid, year);
    router.push(`/card/year_${year}`);
  }

  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  if (!uid)
    return (
      <div className="space-y-2">
        <div className="text-muted-foreground">سجّل الدخول.</div>
        <Link className="underline" href="/login?next=/">
          الذهاب لصفحة الدخول
        </Link>
      </div>
    );

  function togglePriority(p: { id: string; label: string }) {
    setFocusSelected((cur) =>
      cur.some((x) => x.id === p.id)
        ? cur.filter((x) => x.id !== p.id)
        : [...cur, p],
    );
  }

  async function saveFocus() {
    if (!uid) return;

    const t = focusTitle.trim();
    const hasAny = t || focusDesc.trim() || focusSelected.length;

    if (!hasAny) {
      setFocusError("اكتب عنوان الفترة أو اختر أولوية واحدة على الأقل.");
      return;
    }

    setFocusError("");
    setFocusSaving(true);
    try {
      await saveFocusCurrent(uid, {
        title: t || "فترة بدون عنوان",
        description: focusDesc,
        priorities: focusSelected,
      });
    } finally {
      setFocusSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">مرحبًا، {name}</h1>
        {computed && (
          <div className="text-sm text-muted-foreground">
            عمرك الآن: {computed.age.years} سنة، {computed.age.months} شهر،{" "}
            {computed.age.days} يوم
          </div>
        )}
      </div>

      {/* Birthdate */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="text-sm font-bold">تاريخ الميلاد</div>

        {birthDate && !editBirth ? (
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{birthDate}</div>
            <Button variant="outline" onClick={() => setEditBirth(true)}>
              تعديل
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-56"
            />
            <Button
              variant="outline"
              disabled={savingBirth || !birthDate || !uid}
              onClick={async () => {
                if (!uid || !birthDate) return;
                setSavingBirth(true);
                await saveBirthDate(uid, birthDate);
                setSavingBirth(false);
                setEditBirth(false);
              }}
            >
              {savingBirth ? "..." : "حفظ"}
            </Button>
          </div>
        )}
      </div>

      {/* Compass */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold">
            البوصلة (الرسالة / الرؤية / القيم)
          </div>
          <Button
            variant="outline"
            disabled={savingCompass || !uid}
            onClick={async () => {
              if (!uid) return;

              const hasAny = mission.trim() || vision.trim() || values.trim();
              if (!hasAny) {
                setCompassError(
                  "اكتب شيئًا في الرسالة أو الرؤية أو القيم قبل الحفظ.",
                );
                return;
              }

              setCompassError("");
              setSavingCompass(true);
              try {
                await saveCompass(uid, { mission, vision, values });
              } finally {
                setSavingCompass(false);
              }
            }}
          >
            {savingCompass ? "..." : "حفظ"}
          </Button>
        </div>

        {compassError && (
          <div className="text-sm text-red-500">{compassError}</div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-bold">الرسالة</div>
            <Textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              className="min-h-35"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold">الرؤية</div>
            <Textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              className="min-h-35"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold">القيم</div>
            <Textarea
              value={values}
              onChange={(e) => setValues(e.target.value)}
              className="min-h-35"
            />
          </div>
        </div>
      </div>

      {/* Years */}
      <div className="space-y-3">
        <div className="text-sm font-bold">السنوات (1 → 90)</div>

        {!computed ? (
          <div className="text-muted-foreground">
            أدخل تاريخ الميلاد لعرض السنوات.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                السنوات السابقة
              </div>
              <div className="flex flex-wrap gap-2">
                {computed.past.map((y) => (
                  <button
                    key={y}
                    className="h-10 w-10 rounded-full border bg-background text-xs font-bold hover:bg-muted"
                    onClick={() => openYear(y)}
                  >
                    {y}
                  </button>
                ))}
                {computed.past.length === 0 && (
                  <div className="text-muted-foreground">—</div>
                )}
              </div>
            </div>

            {/* Current big (real current year) */}
            <button
              className="w-full rounded-xl border bg-card p-6 text-center hover:bg-muted"
              onClick={() => openYear(computed.currentYear)}
            >
              <div className="text-sm text-muted-foreground">السنة الحالية</div>
              <div className="text-4xl font-extrabold">
                {computed.currentYear}
              </div>
            </button>

            {/* Future (wrap, no box, show all) */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                السنوات القادمة
              </div>
              <div className="flex flex-wrap gap-2">
                {computed.future.map((y) => (
                  <button
                    key={y}
                    className="h-10 w-10 rounded-full border bg-background text-sm font-bold hover:bg-muted"
                    onClick={() => openYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold">التركيز الحالي</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={focusSaving}
              onClick={saveFocus}
            >
              {focusSaving ? "..." : "حفظ"}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!uid) return;
                await clearFocusCurrent(uid);
                setFocusTitle("");
                setFocusDesc("");
                setFocusSelected([]);
              }}
            >
              مسح
            </Button>
          </div>
        </div>

        {focusError && <div className="text-sm text-red-500">{focusError}</div>}

        <div className="space-y-2">
          <div className="text-sm font-bold">عنوان الفترة</div>
          <Input
            value={focusTitle}
            onChange={(e) => setFocusTitle(e.target.value)}
            placeholder="مثال: رمضان 2026"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold">وصف</div>
          <Textarea
            value={focusDesc}
            onChange={(e) => setFocusDesc(e.target.value)}
            className="min-h-30"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold">الأولويات</div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {focusSelected.length
                  ? `مختار: ${focusSelected.length}`
                  : "اختر الأولويات"}
                <span className="text-muted-foreground">▾</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-80 overflow-auto">
              {PRIORITIES.map((p) => {
                const checked = focusSelected.some((x) => x.id === p.id);
                return (
                  <DropdownMenuCheckboxItem
                    key={p.id}
                    checked={checked}
                    onCheckedChange={() => togglePriority(p)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {p.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {focusSelected.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-2">
              {focusSelected.map((p) => (
                <Link
                  key={p.id}
                  href={`/card/${p.id}`}
                  className="rounded-full border bg-background px-3 py-2 text-sm hover:bg-muted"
                >
                  اذهب إلى: {p.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="text-sm font-bold">روتيناتي</div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {routines.map((b) => (
            <Link
              key={b.id}
              href={`/block/${b.id}`}
              className="rounded-lg border bg-background p-3 hover:bg-muted"
            >
              <div className="font-bold">{b.title}</div>
              <div className="text-xs text-muted-foreground">
                {b.blockType === "habit" ? "Habit" : "Routine"}{" "}
                {b.updatedAt
                  ? `• ${new Date(b.updatedAt).toLocaleString("ar")}`
                  : ""}
              </div>
            </Link>
          ))}
          {routines.length === 0 && (
            <div className="text-muted-foreground">
              لا يوجد Habits أو Routines بعد.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
