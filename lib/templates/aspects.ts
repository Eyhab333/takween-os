import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch } from "firebase/firestore";

type NodeType = "space" | "section" | "card" | "folder" | "block" | "item" | "stage";

export async function ensureAspectsTemplate(tenantId: string) {
  const markerId = "asp_card_professional";
  const markerRef = doc(db, "tenants", tenantId, "nodes", markerId);
  const markerSnap = await getDoc(markerRef);
  if (markerSnap.exists()) return;

  const now = Date.now();
  const batch = writeBatch(db);
  const nref = (id: string) => doc(db, "tenants", tenantId, "nodes", id);

  const base = (id: string, parentId: string | null, type: NodeType, title: string, orderKey: string) => ({
    id,
    tenantId,
    parentId,
    type,
    title,
    orderKey,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  // Space + Section
  batch.set(nref("space_aspects"), base("space_aspects", null, "space", "بقية الجوانب", "b"));
  batch.set(nref("asp_sec_main"), base("asp_sec_main", "space_aspects", "section", "الجوانب", "a"));

  // Cards
  const cards: Array<[string, string, string]> = [
    ["asp_card_professional", "الجانب المهني", "a"],
    ["asp_card_financial", "الجانب المالي", "b"],
    ["asp_card_health", "الصحي", "c"],
    ["asp_card_human", "البشري", "d"],
    ["asp_card_psych", "النفسي", "e"],
    ["asp_card_mental", "العقلي", "f"],
    ["asp_card_personal", "الشخصي", "g"],
    ["asp_card_family", "الأسري", "h"],
    ["asp_card_relatives", "العائلي", "i"],
    ["asp_card_social", "الاجتماعي", "j"],
  ];

  cards.forEach(([id, title, orderKey]) => {
    batch.set(nref(id), base(id, "asp_sec_main", "card", title, orderKey));
  });

  await batch.commit();
}