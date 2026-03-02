import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch } from "firebase/firestore";

type NodeType = "space" | "section" | "card";

const SPACE_YEARS_ID = "space_years";
const SEC_YEARS_ID = "years_sec_main";

function base(now: number, tenantId: string, id: string, parentId: string | null, type: NodeType, title: string, orderKey: string) {
  return {
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
  };
}

export async function ensureYearsSpace(tenantId: string) {
  const spaceRef = doc(db, "tenants", tenantId, "nodes", SPACE_YEARS_ID);
  const snap = await getDoc(spaceRef);
  if (snap.exists()) return;

  const now = Date.now();
  const batch = writeBatch(db);

  batch.set(spaceRef, base(now, tenantId, SPACE_YEARS_ID, null, "space", "السنوات", "c"));
  batch.set(doc(db, "tenants", tenantId, "nodes", SEC_YEARS_ID), base(now, tenantId, SEC_YEARS_ID, SPACE_YEARS_ID, "section", "السنوات", "a"));

  await batch.commit();
}

export async function ensureYearCard(tenantId: string, year: number) {
  await ensureYearsSpace(tenantId);

  const id = `year_${year}`;
  const ref = doc(db, "tenants", tenantId, "nodes", id);
  const snap = await getDoc(ref);
  if (snap.exists()) return id;

  const now = Date.now();
  const batch = writeBatch(db);

  batch.set(ref, base(now, tenantId, id, SEC_YEARS_ID, "card", String(year), String(year)));
  await batch.commit();

  return id;
}