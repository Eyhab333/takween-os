/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  increment,
  setDoc,
  updateDoc,
} from "firebase/firestore";

export type TinyExperimentStatus =
  | "draft"
  | "active"
  | "review_needed"
  | "completed"
  | "postponed"
  | "stopped";

export type TinyExperimentDecision =
  | ""
  | "repeat_increase"
  | "adjust"
  | "stop"
  | "adopt_habit"
  | "convert_project"
  | "postpone";

export type TinyExperimentDayStatus = "" | "done" | "partial" | "missed";

function orderKey(now: number, id: string) {
  return `${now.toString(36)}_${id}`;
}

export function tinyExperimentDayId(experimentId: string, dateKey: string) {
  return `${experimentId}__tiny_exp_day__${dateKey}`;
}

export async function addTinyExperiment(params: {
  tenantId: string;
  blockId: string;
  title: string;
  question: string;
  hypothesis: string;
  durationDays: number;
  startDateKey: string;
  dailyAction: string;
  metricLabel: string;
}) {
  const now = Date.now();
  const colRef = collection(db, "tenants", params.tenantId, "nodes");
  const ref = doc(colRef);

  const durationDays = Math.max(1, Math.floor(params.durationDays || 1));

  await setDoc(ref, {
    id: ref.id,
    tenantId: params.tenantId,
    parentId: params.blockId,
    type: "item",
    kind: "tiny_experiment",

    title: params.title.trim() || "تجربة صغيرة جديدة",
    question: params.question,
    hypothesis: params.hypothesis,
    durationDays,
    startDateKey: params.startDateKey,
    dailyAction: params.dailyAction,
    metricLabel: params.metricLabel,

    status: "active" as TinyExperimentStatus,

    positiveNotes: "",
    negativeNotes: "",
    improvementActions: "",

    finalDecision: "",
    finalReason: "",
    nextStep: "",

    orderKey: orderKey(now, ref.id),
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.blockId), {
    updatedAt: now,
    version: increment(1),
  });

  return ref.id;
}

export async function updateTinyExperiment(params: {
  tenantId: string;
  experimentId: string;
  patch: Record<string, any>;
}) {
  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.experimentId), {
    ...params.patch,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function archiveTinyExperiment(params: {
  tenantId: string;
  experimentId: string;
}) {
  const now = Date.now();

  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.experimentId), {
    archived: true,
    archivedAt: now,
    updatedAt: now,
    version: increment(1),
  });
}

export async function upsertTinyExperimentDay(params: {
  tenantId: string;
  experimentId: string;
  dateKey: string;
  dayNumber: number;
  status: TinyExperimentDayStatus;
  energy: number | null;
  mood: number | null;
  note: string;
}) {
  const now = Date.now();
  const id = tinyExperimentDayId(params.experimentId, params.dateKey);

  await setDoc(
    doc(db, "tenants", params.tenantId, "nodes", id),
    {
      id,
      tenantId: params.tenantId,
      parentId: params.experimentId,
      type: "item",
      kind: "tiny_experiment_day",

      dateKey: params.dateKey,
      dayNumber: params.dayNumber,
      status: params.status,
      energy: params.energy,
      mood: params.mood,
      note: params.note,

      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    { merge: true },
  );
}