import { db } from "@/lib/firebase";
import { doc, increment, updateDoc } from "firebase/firestore";
import { celebrateDone } from "./celebrate";

export async function renameNodeTitle(params: {
  tenantId: string;
  nodeId: string;
  title: string;
}) {
  const t = params.title.trim();
  if (!t) return;

  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.nodeId), {
    title: t,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function toggleNodeDone(params: {
  tenantId: string;
  nodeId: string;
  currentDone: boolean;
}) {
  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.nodeId), {
    done: !params.currentDone,
    updatedAt: Date.now(),
    version: increment(1),
  });

  if (!params.currentDone) {
    celebrateDone("big");
  }
}
