import { db } from "@/lib/firebase";
import { doc, increment, updateDoc } from "firebase/firestore";

export async function saveNotesBlock(params: {
  tenantId: string;
  blockId: string;
  text: string;
}) {
  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.blockId), {
    notesText: params.text,
    updatedAt: Date.now(),
    version: increment(1),
  });
}