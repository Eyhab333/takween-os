/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/firebase";
import { collection, doc, increment, updateDoc, setDoc } from "firebase/firestore";

type Step = { id: string; label: string };

export async function routineAddStep(tenantId: string, blockId: string, label: string) {
  const l = label.trim();
  if (!l) return;

  const now = Date.now();
  const stepId = doc(collection(db, "tenants", tenantId, "nodes")).id;

  const blockRef = doc(db, "tenants", tenantId, "nodes", blockId);
  const snap = await (await import("firebase/firestore")).getDoc(blockRef);
  const d = snap.exists() ? (snap.data() as any) : {};
  const steps: Step[] = Array.isArray(d.routineSteps) ? d.routineSteps : [];

  await updateDoc(blockRef, {
    routineSteps: [...steps, { id: stepId, label: l }],
    updatedAt: now,
    version: increment(1),
  });
}

export async function routineRemoveStep(tenantId: string, blockId: string, stepId: string) {
  const now = Date.now();
  const blockRef = doc(db, "tenants", tenantId, "nodes", blockId);
  const snap = await (await import("firebase/firestore")).getDoc(blockRef);
  const d = snap.exists() ? (snap.data() as any) : {};
  const steps: Step[] = Array.isArray(d.routineSteps) ? d.routineSteps : [];

  await updateDoc(blockRef, {
    routineSteps: steps.filter((s) => s.id !== stepId),
    updatedAt: now,
    version: increment(1),
  });
}

export async function routineStartSession(tenantId: string, blockId: string) {
  const now = Date.now();
  const col = collection(db, "tenants", tenantId, "nodes");
  const ref = doc(col);

  await setDoc(ref, {
    id: ref.id,
    tenantId,
    parentId: blockId,
    type: "item",
    kind: "routine_session",
    locked: false,
    startedAt: now,
    endedAt: null,
    results: {}, // stepId -> boolean
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return ref.id;
}

export async function routineToggleStep(tenantId: string, sessionId: string, stepId: string, value: boolean) {
  await updateDoc(doc(db, "tenants", tenantId, "nodes", sessionId), {
    [`results.${stepId}`]: value,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function routineFinishSession(
  tenantId: string,
  sessionId: string,
  score: { done: number; total: number; percent: number }
) {
  const now = Date.now();
  await updateDoc(doc(db, "tenants", tenantId, "nodes", sessionId), {
    locked: true,
    endedAt: now,
    scoreDone: score.done,
    scoreTotal: score.total,
    scorePercent: score.percent,
    updatedAt: now,
    version: increment(1),
  });
}