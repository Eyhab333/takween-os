/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addTinyExperiment,
  archiveTinyExperiment,
  updateTinyExperiment,
  upsertTinyExperimentDay,
  type TinyExperimentDayStatus,
  type TinyExperimentDecision,
  type TinyExperimentStatus,
} from "@/lib/tiny-experiment-actions";

type TinyExperiment = {
  id: string;
  title: string;
  question?: string;
  hypothesis?: string;
  durationDays?: number;
  startDateKey?: string;
  dailyAction?: string;
  metricLabel?: string;
  status?: TinyExperimentStatus;

  positiveNotes?: string;
  negativeNotes?: string;
  improvementActions?: string;

  finalDecision?: TinyExperimentDecision;
  finalReason?: string;
  nextStep?: string;

  orderKey?: string;
  createdAt?: number;
  updatedAt?: number;
};

type TinyExperimentDay = {
  id: string;
  dateKey: string;
  dayNumber?: number;
  status?: TinyExperimentDayStatus;
  energy?: number | null;
  mood?: number | null;
  note?: string;
  updatedAt?: number;
};

const STATUS_LABELS: Record<TinyExperimentStatus, string> = {
  draft: "مسودة",
  active: "جارية",
  review_needed: "انتهت وتحتاج مراجعة",
  completed: "مكتملة",
  postponed: "مؤجلة",
  stopped: "متوقفة",
};

const DAY_STATUS_LABELS: Record<TinyExperimentDayStatus, string> = {
  "": "اختر حالة اليوم",
  done: "تم",
  partial: "جزئيًا",
  missed: "لم يتم",
};

const DECISION_LABELS: Record<Exclude<TinyExperimentDecision, "">, string> = {
  repeat_increase: "التكرار والزيادة",
  adjust: "تعديل المسار",
  stop: "إيقاف",
  adopt_habit: "اعتمادها كعادة",
  convert_project: "تحويلها إلى مشروع",
  postpone: "تأجيلها لوقت أنسب",
};

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getExperimentTimeInfo(exp: TinyExperiment) {
  const duration = Math.max(1, Number(exp.durationDays || 1));
  const startKey = exp.startDateKey || todayKey();
  const start = parseDateKey(startKey);
  const end = addDays(start, duration - 1);
  const today = parseDateKey(todayKey());

  const diffDays =
    Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;

  const beforeStart = diffDays < 1;
  const ended = diffDays > duration;
  const currentDay = beforeStart ? 0 : clamp(diffDays, 1, duration);
  const remaining = beforeStart ? duration : Math.max(0, duration - currentDay);
  const percent = beforeStart
    ? 0
    : clamp(Math.round((currentDay / duration) * 100), 0, 100);

  return {
    duration,
    start,
    end,
    beforeStart,
    ended,
    currentDay,
    remaining,
    percent,
  };
}

function derivedStatus(exp: TinyExperiment): TinyExperimentStatus {
  const s = exp.status || "active";
  const time = getExperimentTimeInfo(exp);

  if (
    time.ended &&
    s === "active" &&
    !exp.finalDecision
  ) {
    return "review_needed";
  }

  return s;
}

function decisionToStatus(decision: TinyExperimentDecision): TinyExperimentStatus {
  if (decision === "stop") return "stopped";
  if (decision === "postpone") return "postponed";
  return "completed";
}

function numOrNull(v: string) {
  if (!v.trim()) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return clamp(Math.floor(n), 1, 5);
}

export function TinyExperimentsBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [experiments, setExperiments] = useState<TinyExperiment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newHypothesis, setNewHypothesis] = useState("");
  const [newDuration, setNewDuration] = useState("7");
  const [newStartDate, setNewStartDate] = useState(todayKey());
  const [newDailyAction, setNewDailyAction] = useState("");
  const [newMetric, setNewMetric] = useState("");

  const selected = useMemo(
    () => experiments.find((x) => x.id === selectedId) ?? experiments[0] ?? null,
    [experiments, selectedId],
  );

  const [editTitle, setEditTitle] = useState("");
  const [editQuestion, setEditQuestion] = useState("");
  const [editHypothesis, setEditHypothesis] = useState("");
  const [editDuration, setEditDuration] = useState("7");
  const [editStartDate, setEditStartDate] = useState(todayKey());
  const [editDailyAction, setEditDailyAction] = useState("");
  const [editMetric, setEditMetric] = useState("");

  const [positiveNotes, setPositiveNotes] = useState("");
  const [negativeNotes, setNegativeNotes] = useState("");
  const [improvementActions, setImprovementActions] = useState("");

  const [days, setDays] = useState<TinyExperimentDay[]>([]);
  const [dayStatus, setDayStatus] = useState<TinyExperimentDayStatus>("");
  const [energy, setEnergy] = useState("");
  const [mood, setMood] = useState("");
  const [dayNote, setDayNote] = useState("");

  const [finalDecision, setFinalDecision] =
    useState<TinyExperimentDecision>("");
  const [finalReason, setFinalReason] = useState("");
  const [nextStep, setNextStep] = useState("");

  useEffect(() => {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(nodesRef, where("parentId", "==", blockId));

    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (x) =>
            x.type === "item" &&
            x.kind === "tiny_experiment" &&
            x.archived !== true,
        )
        .sort((a, b) => String(b.orderKey || "").localeCompare(String(a.orderKey || ""))) as TinyExperiment[];

      setExperiments(rows);

      setSelectedId((cur) => {
        if (cur && rows.some((x) => x.id === cur)) return cur;
        return rows[0]?.id ?? null;
      });
    });
  }, [tenantId, blockId]);

  useEffect(() => {
    if (!selected) {
      setDays([]);
      return;
    }

    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(nodesRef, where("parentId", "==", selected.id));

    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (x) =>
            x.type === "item" &&
            x.kind === "tiny_experiment_day" &&
            x.archived !== true,
        )
        .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || ""))) as TinyExperimentDay[];

      setDays(rows);
    });
  }, [tenantId, selected?.id]);

  useEffect(() => {
    if (!selected) return;

    setEditTitle(selected.title || "");
    setEditQuestion(selected.question || "");
    setEditHypothesis(selected.hypothesis || "");
    setEditDuration(String(selected.durationDays || 7));
    setEditStartDate(selected.startDateKey || todayKey());
    setEditDailyAction(selected.dailyAction || "");
    setEditMetric(selected.metricLabel || "");

    setPositiveNotes(selected.positiveNotes || "");
    setNegativeNotes(selected.negativeNotes || "");
    setImprovementActions(selected.improvementActions || "");

    setFinalDecision(selected.finalDecision || "");
    setFinalReason(selected.finalReason || "");
    setNextStep(selected.nextStep || "");
  }, [selected]);

  useEffect(() => {
    if (!selected) return;

    const t = getExperimentTimeInfo(selected);
    const today = todayKey();
    const todayLog = days.find((d) => d.dateKey === today);

    setDayStatus(todayLog?.status || "");
    setEnergy(
      typeof todayLog?.energy === "number" ? String(todayLog.energy) : "",
    );
    setMood(typeof todayLog?.mood === "number" ? String(todayLog.mood) : "");
    setDayNote(todayLog?.note || "");

    if (!todayLog && t.currentDay === 0) {
      setDayStatus("");
      setEnergy("");
      setMood("");
      setDayNote("");
    }
  }, [selected, days]);

  async function createExperiment() {
    const title = newTitle.trim();
    if (!title) return;

    setBusy(true);
    try {
      const id = await addTinyExperiment({
        tenantId,
        blockId,
        title,
        question: newQuestion,
        hypothesis: newHypothesis,
        durationDays: Number(newDuration || 1),
        startDateKey: newStartDate || todayKey(),
        dailyAction: newDailyAction,
        metricLabel: newMetric,
      });

      setSelectedId(id);
      setShowCreate(false);

      setNewTitle("");
      setNewQuestion("");
      setNewHypothesis("");
      setNewDuration("7");
      setNewStartDate(todayKey());
      setNewDailyAction("");
      setNewMetric("");
    } finally {
      setBusy(false);
    }
  }

  async function saveExperimentDefinition() {
    if (!selected) return;

    setBusy(true);
    try {
      await updateTinyExperiment({
        tenantId,
        experimentId: selected.id,
        patch: {
          title: editTitle.trim() || "تجربة صغيرة",
          question: editQuestion,
          hypothesis: editHypothesis,
          durationDays: Math.max(1, Math.floor(Number(editDuration || 1))),
          startDateKey: editStartDate || todayKey(),
          dailyAction: editDailyAction,
          metricLabel: editMetric,
        },
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveRunningNotes() {
    if (!selected) return;

    setBusy(true);
    try {
      await updateTinyExperiment({
        tenantId,
        experimentId: selected.id,
        patch: {
          positiveNotes,
          negativeNotes,
          improvementActions,
        },
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveTodayLog() {
    if (!selected) return;

    const t = getExperimentTimeInfo(selected);
    const dayNumber = t.currentDay || 1;

    setBusy(true);
    try {
      await upsertTinyExperimentDay({
        tenantId,
        experimentId: selected.id,
        dateKey: todayKey(),
        dayNumber,
        status: dayStatus,
        energy: numOrNull(energy),
        mood: numOrNull(mood),
        note: dayNote,
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveFinalDecision() {
    if (!selected || !finalDecision) return;

    setBusy(true);
    try {
      await updateTinyExperiment({
        tenantId,
        experimentId: selected.id,
        patch: {
          finalDecision,
          finalReason,
          nextStep,
          status: decisionToStatus(finalDecision),
          reviewedAt: Date.now(),
        },
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: TinyExperimentStatus) {
    if (!selected) return;

    setBusy(true);
    try {
      await updateTinyExperiment({
        tenantId,
        experimentId: selected.id,
        patch: { status },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">
              مختبر التجارب الصغيرة
            </div>
            <p className="text-sm text-muted-foreground">
              اختبر فكرة صغيرة لمدة محددة، سجّل الملاحظات، ثم قرر: أعتمدها،
              أعدلها، أكررها، أو أتركها.
            </p>
          </div>

          <Button variant="outline" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "إغلاق" : "+ تجربة جديدة"}
          </Button>
        </div>

        {showCreate && (
          <div className="rounded-lg border bg-background p-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-bold">عنوان التجربة</div>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: تقليل السكريات"
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold">مدة التجربة بالأيام</div>
                <Input
                  type="number"
                  min={1}
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold">تاريخ البداية</div>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold">مؤشر قياس اختياري</div>
                <Input
                  value={newMetric}
                  onChange={(e) => setNewMetric(e.target.value)}
                  placeholder="مثال: الطاقة / المزاج / التركيز"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold">السؤال / الفضول</div>
              <Textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="ما الذي تريد اختباره؟"
                className="min-h-24"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold">الفرضية</div>
              <Textarea
                value={newHypothesis}
                onChange={(e) => setNewHypothesis(e.target.value)}
                placeholder="ماذا تتوقع أن يحدث؟"
                className="min-h-24"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold">الفعل اليومي المطلوب</div>
              <Textarea
                value={newDailyAction}
                onChange={(e) => setNewDailyAction(e.target.value)}
                placeholder="ما الفعل الصغير الذي ستجربه كل يوم؟"
                className="min-h-24"
              />
            </div>

            <Button onClick={createExperiment} disabled={busy || !newTitle.trim()}>
              {busy ? "..." : "إنشاء التجربة"}
            </Button>
          </div>
        )}
      </div>

      {experiments.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
          لا توجد تجارب بعد. ابدأ بتجربة صغيرة لمدة 7 أيام.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-2">
            {experiments.map((exp) => {
              const time = getExperimentTimeInfo(exp);
              const status = derivedStatus(exp);
              const selectedCard = selected?.id === exp.id;

              return (
                <button
                  key={exp.id}
                  onClick={() => setSelectedId(exp.id)}
                  className={[
                    "w-full rounded-xl border p-4 text-right transition hover:bg-muted",
                    selectedCard ? "bg-muted" : "bg-card",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold">{exp.title}</div>
                    <span className="rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground">
                    {time.ended
                      ? `انتهت التجربة • ${time.duration} يوم`
                      : time.beforeStart
                        ? `لم تبدأ بعد • ${time.duration} يوم`
                        : `اليوم ${time.currentDay} من ${time.duration}`}
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted-foreground/15">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${time.percent}%` }}
                    />
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    التقدم الزمني: {time.percent}%
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="space-y-4">
              <ExperimentHeader
                exp={selected}
                onStatusChange={changeStatus}
                onArchive={async () => {
                  const ok = window.confirm("أرشفة هذه التجربة؟");
                  if (!ok) return;
                  await archiveTinyExperiment({
                    tenantId,
                    experimentId: selected.id,
                  });
                }}
                busy={busy}
              />

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-extrabold">تعريف التجربة</div>
                  <Button
                    variant="outline"
                    onClick={saveExperimentDefinition}
                    disabled={busy}
                  >
                    {busy ? "..." : "حفظ التعريف"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-sm font-bold">العنوان</div>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-bold">المدة بالأيام</div>
                    <Input
                      type="number"
                      min={1}
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-bold">تاريخ البداية</div>
                    <Input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-bold">مؤشر القياس</div>
                    <Input
                      value={editMetric}
                      onChange={(e) => setEditMetric(e.target.value)}
                      placeholder="مثال: الطاقة / المزاج / التركيز"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold">السؤال / الفضول</div>
                  <Textarea
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold">الفرضية</div>
                  <Textarea
                    value={editHypothesis}
                    onChange={(e) => setEditHypothesis(e.target.value)}
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold">الفعل اليومي</div>
                  <Textarea
                    value={editDailyAction}
                    onChange={(e) => setEditDailyAction(e.target.value)}
                    className="min-h-24"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold">تسجيل اليوم</div>
                    <div className="text-sm text-muted-foreground">
                      تسجيل خفيف لليوم الحالي فقط.
                    </div>
                  </div>

                  <Button variant="outline" onClick={saveTodayLog} disabled={busy}>
                    {busy ? "..." : "حفظ اليوم"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-sm font-bold">حالة اليوم</div>
                    <Select
                      value={dayStatus}
                      onValueChange={(v) =>
                        setDayStatus(v as TinyExperimentDayStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر حالة اليوم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="done">تم</SelectItem>
                        <SelectItem value="partial">جزئيًا</SelectItem>
                        <SelectItem value="missed">لم يتم</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-bold">الطاقة من 1 إلى 5</div>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={energy}
                      onChange={(e) => setEnergy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-bold">المزاج من 1 إلى 5</div>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold">ملاحظة اليوم</div>
                  <Textarea
                    value={dayNote}
                    onChange={(e) => setDayNote(e.target.value)}
                    className="min-h-24"
                    placeholder="ماذا لاحظت اليوم؟"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold">
                      ملاحظات أثناء التجربة
                    </div>
                    <div className="text-sm text-muted-foreground">
                      فورم ثابت قابل للتعديل دائمًا أثناء التجربة.
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={saveRunningNotes}
                    disabled={busy}
                  >
                    {busy ? "..." : "حفظ الملاحظات"}
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-sm font-extrabold">
                      + ملاحظات إيجابية
                    </div>
                    <Textarea
                      value={positiveNotes}
                      onChange={(e) => setPositiveNotes(e.target.value)}
                      className="min-h-44"
                      placeholder="ما الذي نجح؟ ما الفوائد التي ظهرت؟"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-extrabold">
                      - ملاحظات سلبية
                    </div>
                    <Textarea
                      value={negativeNotes}
                      onChange={(e) => setNegativeNotes(e.target.value)}
                      className="min-h-44"
                      placeholder="ما العوائق أو الصعوبات؟"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-extrabold">
                      ← أفعال للتحسين
                    </div>
                    <Textarea
                      value={improvementActions}
                      onChange={(e) => setImprovementActions(e.target.value)}
                      className="min-h-44"
                      placeholder="ما التعديل العملي أثناء التجربة؟"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold">القرار النهائي</div>
                    <div className="text-sm text-muted-foreground">
                      يظهر بعد انتهاء التجربة، ويمكن تسجيله في أي وقت.
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={saveFinalDecision}
                    disabled={busy || !finalDecision}
                  >
                    {busy ? "..." : "حفظ القرار"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-sm font-bold">ما القرار النهائي؟</div>
                    <Select
                      value={finalDecision}
                      onValueChange={(v) =>
                        setFinalDecision(v as TinyExperimentDecision)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر القرار" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DECISION_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                    {finalDecision
                      ? DECISION_LABELS[
                          finalDecision as Exclude<TinyExperimentDecision, "">
                        ]
                      : "اختر القرار المناسب بعد قراءة الملاحظات."}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold">لماذا اخترت هذا القرار؟</div>
                  <Textarea
                    value={finalReason}
                    onChange={(e) => setFinalReason(e.target.value)}
                    className="min-h-28"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold">ما الخطوة التالية؟</div>
                  <Textarea
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                    className="min-h-28"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="font-extrabold">سجل الأيام</div>

                {days.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    لا توجد تسجيلات يومية بعد.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {days.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-lg border bg-background p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-bold">
                            اليوم {d.dayNumber || "؟"} • {d.dateKey}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {DAY_STATUS_LABELS[d.status || ""]}
                          </div>
                        </div>

                        <div className="mt-1 text-sm text-muted-foreground">
                          الطاقة: {d.energy ?? "—"} • المزاج: {d.mood ?? "—"}
                        </div>

                        {d.note && (
                          <div className="mt-2 whitespace-pre-wrap text-sm">
                            {d.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExperimentHeader({
  exp,
  onStatusChange,
  onArchive,
  busy,
}: {
  exp: TinyExperiment;
  onStatusChange: (status: TinyExperimentStatus) => void;
  onArchive: () => void;
  busy: boolean;
}) {
  const time = getExperimentTimeInfo(exp);
  const status = derivedStatus(exp);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">{exp.title}</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            {time.beforeStart
              ? `لم تبدأ بعد • المدة ${time.duration} يوم`
              : time.ended
                ? `انتهت التجربة • المدة ${time.duration} يوم`
                : `اليوم ${time.currentDay} من ${time.duration}`}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border bg-background px-3 py-1 text-sm">
            {STATUS_LABELS[status]}
          </span>

          <Button variant="outline" onClick={onArchive}>
            أرشفة
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="تاريخ البداية" value={formatDate(time.start)} />
        <InfoCard label="تاريخ النهاية" value={formatDate(time.end)} />
        <InfoCard label="المتبقي" value={`${time.remaining} يوم`} />
        <InfoCard label="التقدم الزمني" value={`${time.percent}%`} />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted-foreground/15">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${time.percent}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onStatusChange("active")}
        >
          جعلها جارية
        </Button>

        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onStatusChange("review_needed")}
        >
          تحتاج مراجعة
        </Button>

        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onStatusChange("stopped")}
        >
          إيقاف
        </Button>

        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onStatusChange("postponed")}
        >
          تأجيل
        </Button>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-extrabold">{value}</div>
    </div>
  );
}