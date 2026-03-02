import { db } from "@/lib/firebase";
import { collection, doc, increment, setDoc, updateDoc } from "firebase/firestore";

export type StageStatus = "not_started" | "in_progress" | "done";

export async function addRoadmapStage(tenantId: string, roadmapBlockId: string, title: string) {
  const now = Date.now();
  const colRef = collection(db, "tenants", tenantId, "nodes");
  const ref = doc(colRef); // auto-id

  await setDoc(ref, {
    id: ref.id,
    tenantId,
    parentId: roadmapBlockId,
    type: "stage",
    title: title.trim() || "مرحلة جديدة",
    status: "not_started" as StageStatus,
    orderKey: `${now.toString(36)}_${ref.id}`,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return ref.id;
}

export async function setStageStatus(tenantId: string, stageId: string, status: StageStatus) {
  await updateDoc(doc(db, "tenants", tenantId, "nodes", stageId), {
    status,
    updatedAt: Date.now(),
    version: increment(1),
  });
}