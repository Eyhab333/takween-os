/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  VISION_ROOT_ID,
  addVision,
  advanceVisionLoop,
  archiveVision,
  ensureVisionRoot,
  getDateKey,
  parseVisionTasks,
  toggleDailyTaskDone,
  updateVision,
  type VisionAllowedDay,
  type VisionExecutionType,
  type VisionRow,
  type VisionSection,
} from "@/lib/vision-actions";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { celebrateDone } from "@/lib/celebrate";

const SECTION_LABELS: Record<VisionSection, string> = {
  daily: "مهام يومية",
  loop: "ختمات متوالية",
  mindset: "نمط تفكير وحياة",
  identity: "هوية",
  goals: "أهداف",
};

const EXECUTION_LABELS: Record<VisionExecutionType, string> = {
  none: "بدون تنفيذ",
  daily_tasks: "مهام يومية",
  sequential_loop: "ختمات متوالية",
};

// لاحقًا اربطها بمصدر فعلي للإجازات
const MANUAL_HOLIDAY_DATES: string[] = [];

function isHolidayDate(dateKey: string) {
  return MANUAL_HOLIDAY_DATES.includes(dateKey);
}

function getTodayTag(date = new Date()): "friday" | "saturday" | "weekday" {
  const day = date.getDay();
  if (day === 5) return "friday";
  if (day === 6) return "saturday";
  return "weekday";
}

function isLoopAllowedToday(vision: VisionRow, todayKey: string) {
  const allowed = vision.allowedLoopDays ?? ["friday", "saturday", "holiday"];
  const todayTag = getTodayTag();

  if (todayTag === "friday" && allowed.includes("friday")) return true;
  if (todayTag === "saturday" && allowed.includes("saturday")) return true;
  if (isHolidayDate(todayKey) && allowed.includes("holiday")) return true;

  return false;
}

function tasksToText(tasks?: Array<{ title: string; note?: string }>) {
  return (tasks ?? [])
    .map((task) => (task.note ? `${task.title} | ${task.note}` : task.title))
    .join("\n");
}

export default function VisionPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visions, setVisions] = useState<VisionRow[]>([]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [motivation, setMotivation] = useState("");
  const [warning, setWarning] = useState("");
  const [howTo, setHowTo] = useState("");
  const [section, setSection] = useState<VisionSection>("daily");
  const [executionType, setExecutionType] =
    useState<VisionExecutionType>("none");
  const [tasksText, setTasksText] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const todayKey = useMemo(() => getDateKey(new Date()), []);
  const [formOpen, setFormOpen] = useState(false);

  const [sectionOpenMap, setSectionOpenMap] = useState<
    Record<VisionSection, boolean>
  >({
    daily: true,
    loop: true,
    mindset: false,
    identity: false,
    goals: false,
  });

  useEffect(() => {
    let unsubNodes: null | (() => void) = null;

    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (unsubNodes) {
        unsubNodes();
        unsubNodes = null;
      }

      if (!u) {
        setUid(null);
        setVisions([]);
        setLoading(false);
        return;
      }

      setUid(u.uid);
      setLoading(true);

      await ensureVisionRoot(u.uid);

      const nodesRef = collection(db, "tenants", u.uid, "nodes");
      const q = query(nodesRef, where("parentId", "==", VISION_ROOT_ID));

      unsubNodes = onSnapshot(q, (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((x) => x.kind === "vision" && x.archived !== true)
          .sort((a, b) =>
            String(a.orderKey || "").localeCompare(String(b.orderKey || "")),
          );

        setVisions(rows as VisionRow[]);
        setLoading(false);
      });
    });

    return () => {
      if (unsubNodes) unsubNodes();
      unsubAuth();
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setMotivation("");
    setWarning("");
    setHowTo("");
    setSection("daily");
    setExecutionType("none");
    setTasksText("");
    setFormError("");
    setFormOpen(false);
  }

  function startEdit(vision: VisionRow) {
    setEditingId(vision.id);
    setTitle(vision.title || "");
    setDescription(vision.description || "");
    setMotivation(vision.motivation || "");
    setWarning(vision.warning || "");
    setHowTo(vision.howTo || "");
    setSection(vision.section || "daily");
    setExecutionType(vision.executionType || "none");
    setTasksText(
      vision.executionType === "daily_tasks"
        ? tasksToText(vision.dailyTasks)
        : vision.executionType === "sequential_loop"
          ? tasksToText(vision.loopTasks)
          : "",
    );
    setFormError("");
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!uid) return;

    const t = title.trim();
    if (!t) {
      setFormError("اكتب عنوان الرؤية.");
      return;
    }

    const parsedTasks = parseVisionTasks(tasksText);

    if (executionType === "daily_tasks" && parsedTasks.length === 0) {
      setFormError("أضف مهمة يومية واحدة على الأقل.");
      return;
    }

    if (executionType === "sequential_loop" && parsedTasks.length === 0) {
      setFormError("أضف مهمة متوالية واحدة على الأقل.");
      return;
    }

    setFormError("");
    setSaving(true);

    try {
      const basePatch = {
        title: t,
        description: description.trim(),
        motivation: motivation.trim(),
        warning: warning.trim(),
        howTo: howTo.trim(),
        section,
        executionType,
        isActive: true,
      } as const;

      if (!editingId) {
        await addVision(uid, {
          ...basePatch,
          dailyTasks: executionType === "daily_tasks" ? parsedTasks : [],
          loopTasks: executionType === "sequential_loop" ? parsedTasks : [],
          allowedLoopDays:
            executionType === "sequential_loop"
              ? (["friday", "saturday", "holiday"] as VisionAllowedDay[])
              : [],
        });
      } else {
        const current = visions.find((v) => v.id === editingId);

        await updateVision(uid, editingId, {
          ...basePatch,
          dailyTasks: executionType === "daily_tasks" ? parsedTasks : [],
          loopTasks: executionType === "sequential_loop" ? parsedTasks : [],
          dailyDoneDateKey:
            executionType === "daily_tasks"
              ? (current?.dailyDoneDateKey ?? null)
              : null,
          dailyDoneTaskIds:
            executionType === "daily_tasks"
              ? (current?.dailyDoneTaskIds ?? [])
              : [],
          loopState:
            executionType === "sequential_loop"
              ? {
                  currentTaskIndex: Math.min(
                    current?.loopState?.currentTaskIndex ?? 0,
                    Math.max(parsedTasks.length - 1, 0),
                  ),
                  cycleCount: current?.loopState?.cycleCount ?? 0,
                  lastCycleCompletedAt:
                    current?.loopState?.lastCycleCompletedAt ?? null,
                }
              : null,
          allowedLoopDays:
            executionType === "sequential_loop"
              ? (current?.allowedLoopDays ?? ["friday", "saturday", "holiday"])
              : [],
        });
      }

      resetForm();
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    return {
      daily: visions.filter((v) => v.section === "daily"),
      loop: visions.filter((v) => v.section === "loop"),
      mindset: visions.filter((v) => v.section === "mindset"),
      identity: visions.filter((v) => v.section === "identity"),
      goals: visions.filter((v) => v.section === "goals"),
    };
  }, [visions]);

  const todayDailyVisions = visions.filter(
    (v) => v.executionType === "daily_tasks" && v.isActive,
  );

  const todayLoopVisions = visions.filter(
    (v) => v.executionType === "sequential_loop" && v.isActive,
  );

  if (loading) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  if (!uid) {
    return (
      <div className="space-y-2">
        <div className="text-muted-foreground">سجّل الدخول.</div>
        <Link className="underline" href="/login?next=/vision">
          الذهاب لصفحة الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="brand-card rounded-lg border bg-card p-4 space-y-2">
        <h1 className="text-2xl font-bold">تنفيذ الرؤية</h1>
        <p className="text-sm text-muted-foreground leading-7">
          هنا تتحول الرؤية إلى ممارسة عملية
        </p>
      </div>

      <div className=" grid gap-4 lg:grid-cols-2">
        <div className=" brand-card rounded-lg border bg-card p-4 space-y-3">
          <div className="text-sm font-bold">تنفيذ اليوم — المهام اليومية</div>

          {todayDailyVisions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              لا توجد رؤى يومية حالية.
            </div>
          ) : (
            <div className="space-y-2">
              {todayDailyVisions.map((vision) => {
                const tasks = (vision.dailyTasks ?? []).filter(
                  (t) => t.isActive,
                );
                const doneIds =
                  vision.dailyDoneDateKey === todayKey
                    ? (vision.dailyDoneTaskIds ?? [])
                    : [];

                return (
                  <div key={vision.id} className="rounded-lg border p-3">
                    <div className="font-bold">{vision.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {doneIds.length} من {tasks.length} مهام منجزة اليوم
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="brand-card rounded-lg border bg-card p-4 space-y-3">
          <div className="text-sm font-bold">تنفيذ اليوم — اللوب المتوالي</div>

          {todayLoopVisions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              لا توجد رؤى متوالية حالية.
            </div>
          ) : (
            <div className="space-y-2">
              {todayLoopVisions.map((vision) => {
                const tasks = (vision.loopTasks ?? []).filter(
                  (t) => t.isActive,
                );
                const currentIndex = Math.min(
                  vision.loopState?.currentTaskIndex ?? 0,
                  Math.max(tasks.length - 1, 0),
                );
                const currentTask = tasks[currentIndex];

                return (
                  <div key={vision.id} className="rounded-lg border p-3">
                    <div className="font-bold">{vision.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {isLoopAllowedToday(vision, todayKey)
                        ? `المهمة الحالية: ${currentTask?.title ?? "—"}`
                        : "غير متاح اليوم"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Collapsible open={formOpen} onOpenChange={setFormOpen}>
        <div className="brand-card rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b p-4">
            <div className="space-y-1">
              <div className="font-bold">
                {editingId ? "تعديل رؤية" : "إضافة رؤية جديدة"}
              </div>
              <div className="text-sm text-muted-foreground">
                {formOpen
                  ? "املأ البيانات ثم احفظ."
                  : "افتح النموذج عند الحاجة."}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editingId ? (
                <Button variant="outline" onClick={resetForm}>
                  إلغاء التعديل
                </Button>
              ) : null}

              <CollapsibleTrigger asChild>
                <Button variant={formOpen ? "outline" : "default"}>
                  <span>{formOpen ? "" : <Plus className="h-3 w-3" />}</span>
                  <ChevronDown
                    className={`mr-2 h-4 w-4 transition-transform ${
                      formOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent>
            <div className="space-y-4 p-4">
              {formError ? (
                <div className="text-sm text-red-500">{formError}</div>
              ) : null}

              <div className="space-y-2">
                <div className="text-sm font-bold">العنوان</div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: رؤية حافظ للقرآن"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-bold">القسم</div>
                  <select
                    value={section}
                    onChange={(e) =>
                      setSection(e.target.value as VisionSection)
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="daily">مهام يومية</option>
                    <option value="loop">اللوب المتوالي</option>
                    <option value="mindset">نمط تفكير وحياة</option>
                    <option value="identity">هوية</option>
                    <option value="goals">أهداف</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-bold">نوع التنفيذ</div>
                  <select
                    value={executionType}
                    onChange={(e) =>
                      setExecutionType(e.target.value as VisionExecutionType)
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="none">بدون تنفيذ</option>
                    <option value="daily_tasks">مهام يومية</option>
                    <option value="sequential_loop">لوب متوالي</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold">شرح مفصل للرؤية</div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-28"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold">الترغيب</div>
                <Textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold">الترهيب</div>
                <Textarea
                  value={warning}
                  onChange={(e) => setWarning(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold">كيف</div>
                <Textarea
                  value={howTo}
                  onChange={(e) => setHowTo(e.target.value)}
                  className="min-h-24"
                />
              </div>

              {executionType !== "none" ? (
                <div className="space-y-2">
                  <div className="text-sm font-bold">
                    {executionType === "daily_tasks"
                      ? "المهام اليومية"
                      : "المهام المتوالية"}
                  </div>

                  <Textarea
                    value={tasksText}
                    onChange={(e) => setTasksText(e.target.value)}
                    className="min-h-32"
                    placeholder={
                      executionType === "daily_tasks"
                        ? "كل سطر = مهمة يومية\nمثال:\nمراجعة وجهين\nتسميع ربع حزب | بعد الفجر"
                        : "كل سطر = مهمة متوالية\nمثال:\nمراجعة من الناس إلى النبأ\nمراجعة من عم إلى الملك"
                    }
                  />

                  <div className="text-xs text-muted-foreground">
                    كل سطر يمثل مهمة واحدة. ويمكنك كتابة ملاحظة اختيارية بعد
                    علامة |
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Button disabled={saving} onClick={handleSubmit}>
                  {saving ? "..." : editingId ? "حفظ التعديل" : "إضافة الرؤية"}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {(
        ["daily", "loop", "mindset", "identity", "goals"] as VisionSection[]
      ).map((sectionKey) => {
        const items = grouped[sectionKey];
        const sectionOpen = sectionOpenMap[sectionKey];

        return (
          <Collapsible
            key={sectionKey}
            open={sectionOpen}
            onOpenChange={(open) =>
              setSectionOpenMap((cur) => ({ ...cur, [sectionKey]: open }))
            }
          >
            <div className=" brand-card space-y-3 rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="text-lg font-bold">
                    {SECTION_LABELS[sectionKey]}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {items.length} عنصر
                  </div>
                </div>

                <CollapsibleTrigger asChild>
                  <Button variant="outline">
                    {/* <span>{sectionOpen ? "طي" : "فتح"}</span> */}
                    <ChevronDown
                      className={`mr-2 h-4 w-4 transition-transform ${
                        sectionOpen ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent>
                <div className="border-t p-4 pt-4">
                  {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      لا توجد رؤى في هذا القسم بعد.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((vision) => {
                        const isOpen = !!openMap[vision.id];
                        const dailyTasks = (vision.dailyTasks ?? []).filter(
                          (t) => t.isActive,
                        );
                        const loopTasks = (vision.loopTasks ?? []).filter(
                          (t) => t.isActive,
                        );
                        const doneIds =
                          vision.dailyDoneDateKey === todayKey
                            ? (vision.dailyDoneTaskIds ?? [])
                            : [];
                        const currentLoopIndex = Math.min(
                          vision.loopState?.currentTaskIndex ?? 0,
                          Math.max(loopTasks.length - 1, 0),
                        );
                        const currentLoopTask = loopTasks[currentLoopIndex];
                        const loopAllowed = isLoopAllowedToday(
                          vision,
                          todayKey,
                        );

                        return (
                          <div
                            key={vision.id}
                            className="brand-card rounded-lg border bg-card p-4 space-y-3"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-lg font-bold">
                                    {vision.title}
                                  </div>

                                  <span className="rounded-full border px-2 py-0.5 text-xs">
                                    {SECTION_LABELS[vision.section]}
                                  </span>

                                  <span className="rounded-full border px-2 py-0.5 text-xs">
                                    {EXECUTION_LABELS[vision.executionType]}
                                  </span>
                                </div>

                                {vision.executionType === "daily_tasks" ? (
                                  <div className="text-sm text-muted-foreground">
                                    تم اليوم: {doneIds.length} من{" "}
                                    {dailyTasks.length}
                                  </div>
                                ) : null}

                                {vision.executionType === "sequential_loop" ? (
                                  <div className="space-y-1 text-sm text-muted-foreground">
                                    <div>
                                      الختمات المكتملة:{" "}
                                      {vision.loopState?.cycleCount ?? 0}
                                    </div>
                                    <div>
                                      التقدم الحالي:{" "}
                                      {loopTasks.length
                                        ? `${Math.min(
                                            currentLoopIndex + 1,
                                            loopTasks.length,
                                          )} من ${loopTasks.length}`
                                        : "لا توجد مهام"}
                                    </div>
                                    <div>
                                      المهمة الحالية:{" "}
                                      {currentLoopTask?.title ?? "—"}
                                    </div>
                                    <div>
                                      الحالة اليوم:{" "}
                                      {loopAllowed
                                        ? "متاح للتنفيذ"
                                        : "غير متاح اليوم"}
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  aria-label={
                                    isOpen ? "طي التفاصيل" : "فتح التفاصيل"
                                  }
                                  title={
                                    isOpen ? "طي التفاصيل" : "فتح التفاصيل"
                                  }
                                  onClick={() =>
                                    setOpenMap((cur) => ({
                                      ...cur,
                                      [vision.id]: !cur[vision.id],
                                    }))
                                  }
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${
                                      isOpen ? "rotate-180" : ""
                                    }`}
                                  />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  aria-label="تعديل"
                                  title="تعديل"
                                  onClick={() => startEdit(vision)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">تعديل</span>
                                </Button>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  aria-label="حذف"
                                  title="حذف"
                                  onClick={async () => {
                                    if (!uid) return;
                                    const ok = window.confirm(
                                      "هل تريد حذف هذه الرؤية؟",
                                    );
                                    if (!ok) return;
                                    await archiveVision(uid, vision.id);
                                    if (editingId === vision.id) resetForm();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">حذف</span>
                                </Button>
                              </div>
                            </div>

                            {isOpen ? (
                              <div className="space-y-4 border-t pt-4">
                                <div className="space-y-1">
                                  <div className="text-sm font-bold">
                                    شرح مفصل للرؤية
                                  </div>
                                  <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                                    {vision.description || "—"}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-sm font-bold">
                                    الترغيب
                                  </div>
                                  <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                                    {vision.motivation || "—"}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-sm font-bold">
                                    الترهيب
                                  </div>
                                  <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                                    {vision.warning || "—"}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-sm font-bold">كيف</div>
                                  <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                                    {vision.howTo || "—"}
                                  </div>
                                </div>

                                {vision.executionType === "daily_tasks" ? (
                                  <div className="space-y-3">
                                    <div className="text-sm font-bold">
                                      المهام اليومية
                                    </div>

                                    {dailyTasks.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">
                                        لا توجد مهام يومية.
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {dailyTasks.map((task) => {
                                          const done = doneIds.includes(
                                            task.id,
                                          );

                                          return (
                                            <div
                                              key={task.id}
                                              className="flex items-center justify-between gap-3 rounded-lg border p-3"
                                            >
                                              <div className="min-w-0">
                                                <div className="font-medium">
                                                  {task.title}
                                                </div>
                                                {task.note ? (
                                                  <div className="text-sm text-muted-foreground">
                                                    {task.note}
                                                  </div>
                                                ) : null}
                                              </div>

                                              <Button
                                                variant="outline"
                                                size="icon"
                                                aria-label={
                                                  done
                                                    ? "إلغاء الإنجاز"
                                                    : "تم الإنجاز"
                                                }
                                                title={
                                                  done
                                                    ? "إلغاء الإنجاز"
                                                    : "تم الإنجاز"
                                                }
                                                className={[
                                                  "shrink-0 transition active:scale-95",
                                                  done
                                                    ? "bg-accent text-accent-foreground"
                                                    : "",
                                                ].join(" ")}
                                                onClick={async () => {
                                                  await toggleDailyTaskDone(
                                                    uid,
                                                    vision.id,
                                                    task.id,
                                                    todayKey,
                                                  );

                                                  if (!done) {
                                                    celebrateDone("soft");
                                                  }
                                                }}
                                              >
                                                {done ? (
                                                  <RotateCcw className="h-4 w-4" />
                                                ) : (
                                                  <CheckCircle2 className="h-4 w-4" />
                                                )}

                                                <span className="sr-only">
                                                  {done
                                                    ? "إلغاء الإنجاز"
                                                    : "تم الإنجاز"}
                                                </span>
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ) : null}

                                {vision.executionType === "sequential_loop" ? (
                                  <div className=" brand-card space-y-3">
                                    <div className="text-sm font-bold">
                                      اللوب المتوالي
                                    </div>

                                    {!loopAllowed ? (
                                      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                                        هذا اللوب يعمل فقط الجمعة والسبت
                                        والإجازات.
                                      </div>
                                    ) : null}

                                    <div className="space-y-2 rounded-lg border p-3">
                                      <div className="text-sm text-muted-foreground">
                                        المهمة الحالية الآن
                                      </div>
                                      <div className="font-bold">
                                        {currentLoopTask?.title ?? "—"}
                                      </div>
                                      {currentLoopTask?.note ? (
                                        <div className="text-sm text-muted-foreground">
                                          {currentLoopTask.note}
                                        </div>
                                      ) : null}

                                      <Button
                                        variant="outline"
                                        disabled={
                                          !loopAllowed || !currentLoopTask
                                        }
                                        className="gap-2 transition active:scale-95"
                                        onClick={async () => {
                                          await advanceVisionLoop(
                                            uid,
                                            vision.id,
                                          );
                                          celebrateDone("soft");
                                        }}
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>تم إنجاز المهمة الحالية</span>
                                      </Button>
                                    </div>

                                    <div className="space-y-2">
                                      {loopTasks.map((task, index) => {
                                        const isCurrent =
                                          index === currentLoopIndex;

                                        return (
                                          <div
                                            key={task.id}
                                            className={`rounded-lg border p-3 ${
                                              isCurrent
                                                ? "border-foreground/40"
                                                : ""
                                            }`}
                                          >
                                            <div className="font-medium">
                                              {index + 1}. {task.title}
                                            </div>
                                            {task.note ? (
                                              <div className="text-sm text-muted-foreground">
                                                {task.note}
                                              </div>
                                            ) : null}
                                            {isCurrent ? (
                                              <div className="mt-1 text-xs text-muted-foreground">
                                                هذه هي المهمة الحالية
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
