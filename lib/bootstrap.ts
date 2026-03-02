import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { ensureIbadahTemplate } from "@/lib/templates/ibadah";
import { ensureYearsSpace } from "@/lib/templates/years";


export async function bootstrapUserIfNeeded(uid: string) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;

  const now = Date.now();
  const tenantId = uid;

  const tenantRef = doc(db, "tenants", tenantId);
  const ibadahSpaceRef = doc(db, "tenants", tenantId, "nodes", "space_ibadah");

  const batch = writeBatch(db);

  batch.set(userRef, {
    tenantId,
    createdAt: now,
    settings: { theme: "system", language: "ar" },
  });

  batch.set(tenantRef, {
    ownerUserId: uid,
    createdAt: now,
  });

  batch.set(ibadahSpaceRef, {
    id: "space_ibadah",
    tenantId,
    parentId: null,
    type: "space",
    title: "الشريعة والإصلاح",
    orderKey: "a",
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  await batch.commit();
  await ensureYearsSpace(tenantId);
  await ensureIbadahTemplate(tenantId);
}