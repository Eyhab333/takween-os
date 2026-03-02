import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

function uid() {
  return (globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

export async function createBlock(params: {
  tenantId: string;
  parentId: string;
  title: string;
  blockType: "checklist" | "counter" | "playlist" | "roadmap" | "project" | "notes" | "habit" | "routine";
}) {
  const now = Date.now();
  const id = uid();

  await setDoc(doc(db, "tenants", params.tenantId, "nodes", id), {
    id,
    tenantId: params.tenantId,
    parentId: params.parentId,
    type: "block",
    title: params.title,
    orderKey: now.toString(36),
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
    habitDailyTarget: 1,
    habitUnitLabel: "مرة",
    blockType: params.blockType,
    config: {},
    progressSnapshot: { current: 0, total: 0, percent: 0, status: "not_started" },

    counterCurrent: 0,
    counterTarget: null, // null = مفتوح (لا نهائي)
routineSteps: [],
  });

  return id;
}