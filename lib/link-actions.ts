import { db } from "@/lib/firebase";
import { doc, increment, runTransaction, updateDoc } from "firebase/firestore";

function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

export async function saveLinkBlock(params: {
  tenantId: string;
  blockId: string;
  url: string;
}) {
  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.blockId),
    {
      linkUrl: normalizeExternalUrl(params.url),
      updatedAt: Date.now(),
      version: increment(1),
    },
  );
}

export async function linkDoneOnce(params: {
  tenantId: string;
  blockId: string;
}) {
  const now = Date.now();

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.blockId),
    {
      linkDoneCount: increment(1),
      linkLastDoneAt: now,
      updatedAt: now,
      version: increment(1),
    },
  );
}

export async function linkUndoOnce(params: {
  tenantId: string;
  blockId: string;
}) {
  const ref = doc(db, "tenants", params.tenantId, "nodes", params.blockId);
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const current =
      typeof data.linkDoneCount === "number" ? data.linkDoneCount : 0;

    tx.update(ref, {
      linkDoneCount: Math.max(0, current - 1),
      updatedAt: now,
      version: increment(1),
    });
  });
}
