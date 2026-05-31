/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  Eye,
  EyeOff,
  Brain,
  CheckCircle2,
  Lightbulb,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  addPdfLearningQuestion,
  archivePdfLearningQuestion,
  PdfLearningMastery,
  PdfLearningQuestionType,
  setPdfLearningQuestionMastery,
  updatePdfLearningQuestion,
} from "@/lib/pdf-learning-lab-actions";

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

type PdfLearningQuestion = {
  id: string;
  tenantId: string;
  parentId: string;
  type: string;
  kind: string;
  title?: string;
  question: string;
  answer?: string;
  questionType: PdfLearningQuestionType;
  questionTypeLabel?: string;
  pageNumber: number;
  mastery: PdfLearningMastery;
  reviewCount?: number;
  lastReviewedAt?: number | null;
  nextReviewAt?: number | null;
  archived?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

type PdfLearningLabProps = {
  tenantId: string;
  blockId: string;
  currentPage: number;
};

const QUESTION_TYPES: Array<{
  value: PdfLearningQuestionType;
  label: string;
  description: string;
}> = [
  {
    value: "recall",
    label: "استرجاع",
    description: "ماذا تتذكر من الصفحة دون النظر؟",
  },
  {
    value: "understanding",
    label: "فهم",
    description: "لماذا الفكرة مهمة؟ وما معناها؟",
  },
  {
    value: "application",
    label: "تطبيق",
    description: "كيف تطبق الفكرة في حياتك أو مشروعك؟",
  },
  {
    value: "connection",
    label: "ربط",
    description: "اربط الفكرة بفكرة سابقة أو موقف مشابه.",
  },
  {
    value: "critique",
    label: "نقد",
    description: "هل توافق؟ متى لا تنطبق الفكرة؟",
  },
  {
    value: "feynman",
    label: "فاينمان",
    description: "اشرح الفكرة ببساطة شديدة.",
  },
];

const MASTERY_LEVELS: Array<{
  value: PdfLearningMastery;
  label: string;
  next: string;
}> = [
  {
    value: "not_understood",
    label: "لم أفهم",
    next: "مراجعة غدًا",
  },
  {
    value: "partial",
    label: "فهم جزئي",
    next: "بعد 3 أيام",
  },
  {
    value: "good",
    label: "فهم جيد",
    next: "بعد أسبوع",
  },
  {
    value: "mastered",
    label: "أتقنت",
    next: "بعد شهر",
  },
];

type FilterMode = "current_page" | "all" | "due";

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safePage(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function questionTypeLabel(type: PdfLearningQuestionType) {
  return QUESTION_TYPES.find((x) => x.value === type)?.label ?? "سؤال";
}

function masteryLabel(mastery: PdfLearningMastery) {
  return MASTERY_LEVELS.find((x) => x.value === mastery)?.label ?? "غير محدد";
}

function formatDate(ms?: number | null) {
  if (!ms) return "—";

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
  }).format(new Date(ms));
}

function emptyDraft(currentPage: number) {
  return {
    pageNumber: safePage(currentPage),
    questionType: "recall" as PdfLearningQuestionType,
    question: "",
    answer: "",
    mastery: "partial" as PdfLearningMastery,
  };
}

export function PdfLearningLab({
  tenantId,
  blockId,
  currentPage,
}: PdfLearningLabProps) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<PdfLearningQuestion[]>([]);
  const [filter, setFilter] = useState<FilterMode>("current_page");
  const [visibleAnswers, setVisibleAnswers] = useState<Set<string>>(
    () => new Set(),
  );
  const [draft, setDraft] = useState(() => emptyDraft(currentPage));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft((cur) => ({
      ...cur,
      pageNumber: safePage(currentPage),
    }));
  }, [currentPage]);

  useEffect(() => {
    setLoading(true);

    const nodesRef = collection(db, "tenants", tenantId, "nodes");

    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("kind", "==", "pdf_learning_question"),
      where("archived", "==", false),
      limit(300),
    );

    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const data = d.data() as any;

            return {
              id: d.id,
              tenantId: data.tenantId,
              parentId: data.parentId,
              type: data.type,
              kind: data.kind,
              title: data.title,
              question: typeof data.question === "string" ? data.question : "",
              answer: typeof data.answer === "string" ? data.answer : "",
              questionType:
                typeof data.questionType === "string"
                  ? data.questionType
                  : "recall",
              questionTypeLabel: data.questionTypeLabel,
              pageNumber: asNumber(data.pageNumber, 1),
              mastery:
                typeof data.mastery === "string" ? data.mastery : "partial",
              reviewCount: asNumber(data.reviewCount, 0),
              lastReviewedAt: data.lastReviewedAt ?? null,
              nextReviewAt: data.nextReviewAt ?? null,
              archived: Boolean(data.archived),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } as PdfLearningQuestion;
          })
          .sort((a, b) => asNumber(b.createdAt, 0) - asNumber(a.createdAt, 0));

        setQuestions(rows);
        setLoading(false);
      },
      (err) => {
        console.error("PDF learning questions load failed:", err);
        setError("تعذر تحميل أسئلة مختبر التعلم.");
        setLoading(false);
      },
    );
  }, [tenantId, blockId]);

  const pageQuestionsCount = useMemo(
    () =>
      questions.filter((q) => q.pageNumber === safePage(currentPage)).length,
    [questions, currentPage],
  );

  const dueQuestionsCount = useMemo(() => {
    const now = Date.now();
    return questions.filter((q) => q.nextReviewAt && q.nextReviewAt <= now)
      .length;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const now = Date.now();

    if (filter === "current_page") {
      return questions.filter((q) => q.pageNumber === safePage(currentPage));
    }

    if (filter === "due") {
      return questions.filter((q) => q.nextReviewAt && q.nextReviewAt <= now);
    }

    return questions;
  }, [questions, filter, currentPage]);

  const selectedType = QUESTION_TYPES.find(
    (x) => x.value === draft.questionType,
  );

  function toggleAnswer(questionId: string) {
    setVisibleAnswers((cur) => {
      const next = new Set(cur);

      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }

      return next;
    });
  }

  function openNewQuestionForm() {
    setEditingId(null);
    setDraft(emptyDraft(currentPage));
    setShowQuestionForm(true);
    setError("");
  }

  function resetDraft() {
    setEditingId(null);
    setDraft(emptyDraft(currentPage));
    setShowQuestionForm(false);
    setError("");
  }

  function startEdit(q: PdfLearningQuestion) {
    setEditingId(q.id);
    setShowQuestionForm(true);
    setDraft({
      pageNumber: safePage(q.pageNumber),
      questionType: q.questionType,
      question: q.question,
      answer: q.answer ?? "",
      mastery: q.mastery,
    });
    setError("");
  }

  async function saveQuestion() {
    const question = draft.question.trim();

    if (!question) {
      setError("اكتب السؤال أولًا.");
      return;
    }

    setError("");
    setBusy(true);

    try {
      if (editingId) {
        await updatePdfLearningQuestion({
          tenantId,
          questionId: editingId,
          pageNumber: draft.pageNumber,
          questionType: draft.questionType,
          question: draft.question,
          answer: draft.answer,
          mastery: draft.mastery,
        });
      } else {
        await addPdfLearningQuestion({
          tenantId,
          blockId,
          pageNumber: draft.pageNumber,
          questionType: draft.questionType,
          question: draft.question,
          answer: draft.answer,
          mastery: draft.mastery,
        });
      }

      resetDraft();
    } catch (err) {
      console.error("Save PDF learning question failed:", err);
      setError("تعذر حفظ السؤال.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveQuestion(questionId: string) {
    const ok = window.confirm("هل تريد حذف هذا السؤال من مختبر التعلم؟");
    if (!ok) return;

    setError("");
    setBusy(true);

    try {
      await archivePdfLearningQuestion({
        tenantId,
        blockId,
        questionId,
      });

      if (editingId === questionId) resetDraft();
    } catch (err) {
      console.error("Archive PDF learning question failed:", err);
      setError("تعذر حذف السؤال.");
    } finally {
      setBusy(false);
    }
  }

  async function changeMastery(
    questionId: string,
    mastery: PdfLearningMastery,
  ) {
    setError("");

    try {
      await setPdfLearningQuestionMastery({
        tenantId,
        questionId,
        mastery,
      });
    } catch (err) {
      console.error("Set PDF learning question mastery failed:", err);
      setError("تعذر تحديث درجة الإتقان.");
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card  p-4">
      <div className="flex  flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className=" space-y-1">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <h2 className="text-lg font-bold">مختبر التعلم</h2>
          </div>

          <p className="text-sm text-muted-foreground">
            حوّل القراءة إلى استرجاع وفهم وتطبيق. الأسئلة هنا لا تُحمّل إلا عند
            فتح المختبر.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-72">
          <div className="rounded-lg border bg-background p-2">
            <div className="font-bold">{questions.length}</div>
            <div className="text-muted-foreground">كل الأسئلة</div>
          </div>

          <div className="rounded-lg border bg-background p-2">
            <div className="font-bold">{pageQuestionsCount}</div>
            <div className="text-muted-foreground">هذه الصفحة</div>
          </div>

          <div className="rounded-lg border bg-background p-2">
            <div className="font-bold">{dueQuestionsCount}</div>
            <div className="text-muted-foreground">للمراجعة</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className=" flex flex-wrap items-center gap-2">
        <Button onClick={openNewQuestionForm}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة سؤال
        </Button>

        {showQuestionForm && (
          <Button variant="outline" onClick={resetDraft}>
            <X className="ml-2 h-4 w-4" />
            إغلاق الفورم
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {showQuestionForm && (
          <div className="space-y-3 rounded-xl border bg-background p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div className="font-bold">
                {editingId ? "تعديل سؤال" : "إضافة سؤال"}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">رقم الصفحة</div>
                <Input
                  type="number"
                  min={1}
                  value={draft.pageNumber}
                  onChange={(e) =>
                    setDraft((cur) => ({
                      ...cur,
                      pageNumber: safePage(Number(e.target.value)),
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">نوع السؤال</div>
                <Select
                  value={draft.questionType}
                  onValueChange={(value) =>
                    setDraft((cur) => ({
                      ...cur,
                      questionType: value as PdfLearningQuestionType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع السؤال" />
                  </SelectTrigger>

                  <SelectContent>
                    {QUESTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedType && (
                  <div className="text-xs text-muted-foreground">
                    {selectedType.description}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">السؤال</div>
              <Textarea
                value={draft.question}
                onChange={(e) =>
                  setDraft((cur) => ({
                    ...cur,
                    question: e.target.value,
                  }))
                }
                placeholder="مثال: ما أهم فكرة في هذه الصفحة؟"
                className="min-h-24"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">الإجابة / الملاحظة</div>
              <Textarea
                value={draft.answer}
                onChange={(e) =>
                  setDraft((cur) => ({
                    ...cur,
                    answer: e.target.value,
                  }))
                }
                placeholder="اكتب إجابتك أو ملخصك من الذاكرة..."
                className="min-h-28"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">درجة الإتقان</div>
              <Select
                value={draft.mastery}
                onValueChange={(value) =>
                  setDraft((cur) => ({
                    ...cur,
                    mastery: value as PdfLearningMastery,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر درجة الإتقان" />
                </SelectTrigger>

                <SelectContent>
                  {MASTERY_LEVELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} — {m.next}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy} onClick={saveQuestion}>
                {editingId ? (
                  <>
                    <Save className="ml-2 h-4 w-4" />
                    حفظ التعديل
                  </>
                ) : (
                  <>
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة السؤال
                  </>
                )}
              </Button>

              {editingId && (
                <Button variant="outline" onClick={resetDraft} disabled={busy}>
                  <X className="ml-2 h-4 w-4" />
                  إلغاء التعديل
                </Button>
              )}

              {!editingId && (
                <Button variant="outline" onClick={resetDraft} disabled={busy}>
                  <X className="ml-2 h-4 w-4" />
                  إلغاء
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === "current_page" ? "default" : "outline"}
              onClick={() => setFilter("current_page")}
            >
              الصفحة الحالية
            </Button>

            <Button
              variant={filter === "due" ? "default" : "outline"}
              onClick={() => setFilter("due")}
            >
              مراجعات الآن
            </Button>

            <Button
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              الكل
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {loading ? (
              <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground md:col-span-2 2xl:col-span-3">
                جارٍ تحميل أسئلة مختبر التعلم...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground md:col-span-2 2xl:col-span-3">
                لا توجد أسئلة في هذا القسم بعد.
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const answerVisible = visibleAnswers.has(q.id);

                return (
                  <div
                    key={q.id}
                    className="flex min-h-64 flex-col space-y-3 rounded-xl border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border px-2 py-1">
                            صفحة {q.pageNumber}
                          </span>
                          <span className="rounded-full border px-2 py-1">
                            {questionTypeLabel(q.questionType)}
                          </span>
                          <span className="rounded-full border px-2 py-1">
                            {masteryLabel(q.mastery)}
                          </span>
                        </div>

                        <div className="font-bold leading-7">{q.question}</div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => startEdit(q)}
                          title="تعديل"
                          aria-label="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => archiveQuestion(q.id)}
                          title="حذف"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAnswer(q.id)}
                      >
                        {answerVisible ? (
                          <>
                            <EyeOff className="ml-2 h-4 w-4" />
                            إخفاء الإجابة
                          </>
                        ) : (
                          <>
                            <Eye className="ml-2 h-4 w-4" />
                            فكّر ثم أظهر الإجابة
                          </>
                        )}
                      </Button>

                      {answerVisible ? (
                        q.answer ? (
                          <div className="rounded-lg border bg-card/50 p-3 text-sm leading-7">
                            {q.answer}
                          </div>
                        ) : (
                          <div className="rounded-lg border bg-card/50 p-3 text-sm text-muted-foreground">
                            لا توجد إجابة مسجلة بعد.
                          </div>
                        )
                      ) : (
                        <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                          الإجابة مخفية لدعم الاسترجاع النشط. حاول الإجابة من
                          ذاكرتك أولًا.
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <div className="flex flex-wrap gap-2">
                        <span>المراجعات: {q.reviewCount ?? 0}</span>
                        <span>آخر مراجعة: {formatDate(q.lastReviewedAt)}</span>
                        <span>القادمة: {formatDate(q.nextReviewAt)}</span>
                      </div>

                      {answerVisible && (
                        <Select
                          value={q.mastery}
                          onValueChange={(value) =>
                            changeMastery(q.id, value as PdfLearningMastery)
                          }
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {MASTERY_LEVELS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label} — {m.next}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-bold text-foreground">
              <Lightbulb className="h-4 w-4" />
              اقتراح للتعلم الفائق
            </div>
            بعد كل صفحة أو جزء مهم، اكتب سؤال استرجاع واحد على الأقل قبل أن
            تتابع القراءة.
          </div>

          <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-bold text-foreground">
              <CheckCircle2 className="h-4 w-4" />
              قاعدة المراجعة
            </div>
            كلما غيّرت درجة الإتقان، يتم تحديث موعد المراجعة القادمة تلقائيًا.
          </div>
        </div>
      </div>
    </div>
  );
}
