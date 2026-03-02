import { db } from "@/lib/firebase";
import { doc, increment, setDoc, updateDoc, writeBatch } from "firebase/firestore";

export function habitDayId(blockId: string, dateKey: string) {
  return `${blockId}__habit_day__${dateKey}`;
}

export async function habitSetConfig(params: {
  tenantId: string;
  blockId: string;
  dailyTarget: number;
  unitLabel: string;
}) {
  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.blockId), {
    habitDailyTarget: params.dailyTarget,
    habitUnitLabel: params.unitLabel.trim() || "مرة",
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function habitAdd(params: {
  tenantId: string;
  blockId: string;
  dateKey: string; // YYYY-MM-DD
  delta: number;
}) {
  const now = Date.now();
  const dayId = habitDayId(params.blockId, params.dateKey);

  const dayRef = doc(db, "tenants", params.tenantId, "nodes", dayId);
  const blockRef = doc(db, "tenants", params.tenantId, "nodes", params.blockId);

  const batch = writeBatch(db);

  // يوم واحد = وثيقة واحدة (count فقط)
  batch.set(
    dayRef,
    {
      id: dayId,
      tenantId: params.tenantId,
      parentId: params.blockId,
      type: "item",
      kind: "habit_day",
      dateKey: params.dateKey,
      count: increment(params.delta),
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    { merge: true }
  );

  batch.update(blockRef, { updatedAt: now, version: increment(1) });

  await batch.commit();
}

export async function habitResetDay(params: {
  tenantId: string;
  blockId: string;
  dateKey: string;
}) {
  const now = Date.now();
  const dayId = habitDayId(params.blockId, params.dateKey);
  await setDoc(
    doc(db, "tenants", params.tenantId, "nodes", dayId),
    {
      id: dayId,
      tenantId: params.tenantId,
      parentId: params.blockId,
      type: "item",
      kind: "habit_day",
      dateKey: params.dateKey,
      count: 0,
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    { merge: true }
  );
}