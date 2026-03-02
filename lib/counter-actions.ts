import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  increment,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

function mkOrderKey(now: number, id: string) {
  return `${now.toString(36)}_${id}`;
}

export async function counterAdd(params: {
  tenantId: string;
  blockId: string;
  delta: number;
}) {
  const now = Date.now();
  const colRef = collection(db, "tenants", params.tenantId, "nodes");

  const logRef = doc(colRef); // auto-id log item
  const blockRef = doc(db, "tenants", params.tenantId, "nodes", params.blockId);

  const batch = writeBatch(db);

  // log item (history)
  batch.set(logRef, {
    id: logRef.id,
    tenantId: params.tenantId,
    parentId: params.blockId,
    type: "item",
    title: params.delta >= 0 ? `+${params.delta}` : `${params.delta}`,
    logKind: "counter",
    delta: params.delta,
    orderKey: mkOrderKey(now, logRef.id),
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  // update counter current
  batch.update(blockRef, {
    counterCurrent: increment(params.delta),
    updatedAt: now,
    version: increment(1),
  });

  await batch.commit();
}

export async function counterReset(params: {
  tenantId: string;
  blockId: string;
}) {
  const now = Date.now();
  const colRef = collection(db, "tenants", params.tenantId, "nodes");

  const logRef = doc(colRef);
  const blockRef = doc(db, "tenants", params.tenantId, "nodes", params.blockId);

  const batch = writeBatch(db);

  batch.set(logRef, {
    id: logRef.id,
    tenantId: params.tenantId,
    parentId: params.blockId,
    type: "item",
    title: "Reset",
    logKind: "counter",
    delta: 0,
    orderKey: mkOrderKey(now, logRef.id),
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  batch.update(blockRef, {
    counterCurrent: 0,
    updatedAt: now,
    version: increment(1),
  });

  await batch.commit();
}

export async function counterSetTarget(params: {
  tenantId: string;
  blockId: string;
  target: number | null; // null = مفتوح
}) {
  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.blockId), {
    counterTarget: params.target,
    updatedAt: Date.now(),
    version: increment(1),
  });
}