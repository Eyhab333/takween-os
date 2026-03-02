import { db } from "@/lib/firebase";
import { arrayRemove, arrayUnion, doc, increment, updateDoc } from "firebase/firestore";

export async function toggleYearDoneDate(params: {
  tenantId: string;
  yearCardId: string; // year_2026
  dateKey: string;    // YYYY-MM-DD
  isDone: boolean;
}) {
  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.yearCardId), {
    doneDates: params.isDone ? arrayRemove(params.dateKey) : arrayUnion(params.dateKey),
    updatedAt: Date.now(),
    version: increment(1),
  });
}