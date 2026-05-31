import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  increment,
  setDoc,
  updateDoc,
} from "firebase/firestore";

export type PdfLearningQuestionType =
  | "recall"
  | "understanding"
  | "application"
  | "connection"
  | "critique"
  | "feynman";

export type PdfLearningMastery =
  | "not_understood"
  | "partial"
  | "good"
  | "mastered";

export type PdfLearningQuestionInput = {
  tenantId: string;
  blockId: string;
  pageNumber: number;
  questionType: PdfLearningQuestionType;
  question: string;
  answer: string;
  mastery: PdfLearningMastery;
};

function cleanText(value: string) {
  return value.trim();
}

function safePageNumber(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function nextReviewDelayDays(mastery: PdfLearningMastery) {
  if (mastery === "not_understood") return 1;
  if (mastery === "partial") return 3;
  if (mastery === "good") return 7;
  return 30;
}

function nextReviewAtFromMastery(mastery: PdfLearningMastery) {
  const days = nextReviewDelayDays(mastery);
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

function questionTypeLabel(type: PdfLearningQuestionType) {
  if (type === "recall") return "استرجاع";
  if (type === "understanding") return "فهم";
  if (type === "application") return "تطبيق";
  if (type === "connection") return "ربط";
  if (type === "critique") return "نقد";
  return "فاينمان";
}

export async function addPdfLearningQuestion(params: PdfLearningQuestionInput) {
  const question = cleanText(params.question);
  const answer = cleanText(params.answer);

  if (!question) {
    throw new Error("Question text is required.");
  }

  const now = Date.now();
  const colRef = collection(db, "tenants", params.tenantId, "nodes");
  const ref = doc(colRef);

  await setDoc(ref, {
    id: ref.id,
    tenantId: params.tenantId,
    parentId: params.blockId,
    type: "item",
    kind: "pdf_learning_question",

    title: question,
    question,
    answer,

    questionType: params.questionType,
    questionTypeLabel: questionTypeLabel(params.questionType),

    pageNumber: safePageNumber(params.pageNumber),
    mastery: params.mastery,

    reviewCount: 0,
    lastReviewedAt: null,
    nextReviewAt: nextReviewAtFromMastery(params.mastery),

    orderKey: `${now.toString(36)}_${ref.id}`,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.blockId),
    {
      learningQuestionsCount: increment(1),
      updatedAt: now,
      version: increment(1),
    },
  );

  return ref.id;
}

export async function updatePdfLearningQuestion(params: {
  tenantId: string;
  questionId: string;
  pageNumber: number;
  questionType: PdfLearningQuestionType;
  question: string;
  answer: string;
  mastery: PdfLearningMastery;
}) {
  const question = cleanText(params.question);
  const answer = cleanText(params.answer);

  if (!question) {
    throw new Error("Question text is required.");
  }

  const now = Date.now();

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.questionId),
    {
      title: question,
      question,
      answer,

      questionType: params.questionType,
      questionTypeLabel: questionTypeLabel(params.questionType),

      pageNumber: safePageNumber(params.pageNumber),
      mastery: params.mastery,
      nextReviewAt: nextReviewAtFromMastery(params.mastery),

      updatedAt: now,
      version: increment(1),
    },
  );
}

export async function setPdfLearningQuestionMastery(params: {
  tenantId: string;
  questionId: string;
  mastery: PdfLearningMastery;
}) {
  const now = Date.now();

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.questionId),
    {
      mastery: params.mastery,
      lastReviewedAt: now,
      nextReviewAt: nextReviewAtFromMastery(params.mastery),
      reviewCount: increment(1),
      updatedAt: now,
      version: increment(1),
    },
  );
}

export async function archivePdfLearningQuestion(params: {
  tenantId: string;
  blockId: string;
  questionId: string;
}) {
  const now = Date.now();

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.questionId),
    {
      archived: true,
      archivedAt: now,
      updatedAt: now,
      version: increment(1),
    },
  );

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.blockId),
    {
      learningQuestionsCount: increment(-1),
      updatedAt: now,
      version: increment(1),
    },
  );
}
