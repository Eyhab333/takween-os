/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { QURAN_LAST } from "@/lib/quran-data";

const CARD_ID = "ib_card_mind_tadabbur";
const BLOCK_ID = "qr_block_ib_card_mind_tadabbur";

function tsLabel(now: Date) {
  return new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

export async function ensureTadabburQuranReview(tenantId: string) {
  const now = Date.now();
  const blockRef = doc(db, "tenants", tenantId, "nodes", BLOCK_ID);
  const blockSnap = await getDoc(blockRef);


const blockData = blockSnap.exists() ? (blockSnap.data() as any) : {};
const currentRun = typeof blockData.currentRun === "number" ? blockData.currentRun : 1;

if (blockSnap.exists() && typeof blockData.currentRun !== "number") {
  await updateDoc(blockRef, { currentRun: 1, updatedAt: Date.now(), version: increment(1) });
}

  if (!blockSnap.exists()) {
    await setDoc(blockRef, {
      id: BLOCK_ID,
      tenantId,
      parentId: CARD_ID,
      type: "block",
      title: "مراجعة القرآن (التدبر)",
      blockType: "quran_review_hidden",
      hidden: true,
      runsCompleted: 0,
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  // ensure يوجد entry مفتوح (locked=false)
  const nodesRef = collection(db, "tenants", tenantId, "nodes");
  const qOpen = query(
    nodesRef,
    where("parentId", "==", BLOCK_ID),
    where("type", "==", "item"),
    where("archived", "==", false),
    where("locked", "==", false),
    limit(1)
  );
  const openSnap = await getDocs(qOpen);

  if (openSnap.empty) {
    const ref = doc(nodesRef);
    await setDoc(ref, {
      id: ref.id,
      tenantId,
      parentId: BLOCK_ID,
      type: "item",
      kind: "quran_review_entry",
      locked: false,
      timestampMs: null,
      timestampLabel: "",
      startSurah: 1,
      startAyah: 1,
      endSurah: null,
      endAyah: null,
      orderKey: `${now.toString(36)}_${ref.id}`,
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
      currentRun: 1,
      runNumber: currentRun,
    });
  }


// migrate old entries (runNumber missing) -> runNumber=1
{
  const nodesRef = collection(db, "tenants", tenantId, "nodes");
  const qAll = query(
    nodesRef,
    where("parentId", "==", BLOCK_ID),
    where("type", "==", "item"),
    where("archived", "==", false),
    limit(500)
  );
  const allSnap = await getDocs(qAll);

  const batch = writeBatch(db);
  let changed = 0;

  allSnap.docs.forEach((d) => {
    const data = d.data() as any;
    if (typeof data.runNumber !== "number") {
      batch.update(d.ref, { runNumber: 1, updatedAt: Date.now(), version: increment(1) });
      changed++;
    }
  });

  if (changed) await batch.commit();
}


  return { blockId: BLOCK_ID };
}

export async function setEntryTimestamp(tenantId: string, entryId: string) {
  const now = new Date();
  await updateDoc(doc(db, "tenants", tenantId, "nodes", entryId), {
    timestampMs: now.getTime(),
    timestampLabel: tsLabel(now),
    updatedAt: now.getTime(),
    version: increment(1),
  });
}

export async function patchEntry(
  tenantId: string,
  entryId: string,
  patch: Record<string, any>
) {
  await updateDoc(doc(db, "tenants", tenantId, "nodes", entryId), {
    ...patch,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function finalizeEntry(params: {
  tenantId: string;
  entryId: string;
  endSurah: number;
  endAyah: number;
}) {
  const now = Date.now();
  const nodesRef = collection(db, "tenants", params.tenantId, "nodes");

  const entryRef = doc(db, "tenants", params.tenantId, "nodes", params.entryId);
  const blockRef = doc(db, "tenants", params.tenantId, "nodes", BLOCK_ID);

  const blockSnap = await getDoc(blockRef);
  const bd = blockSnap.exists() ? (blockSnap.data() as any) : {};
  const currentRun = typeof bd.currentRun === "number" ? bd.currentRun : 1;

  const isKhatmah =
    params.endSurah === QURAN_LAST.surah && params.endAyah === QURAN_LAST.ayah;

  const nextRun = isKhatmah ? currentRun + 1 : currentRun;
  const nextStart = isKhatmah
    ? { surah: 1, ayah: 1 }
    : { surah: params.endSurah, ayah: params.endAyah };

  const nextRef = doc(nodesRef);

  const batch = writeBatch(db);

  batch.update(entryRef, {
    endSurah: params.endSurah,
    endAyah: params.endAyah,
    locked: true,
    doneAt: now,
    updatedAt: now,
    version: increment(1),
  });

  batch.set(nextRef, {
    id: nextRef.id,
    tenantId: params.tenantId,
    parentId: BLOCK_ID,
    type: "item",
    kind: "quran_review_entry",
    runNumber: nextRun,
    locked: false,
    timestampMs: null,
    timestampLabel: "",
    startSurah: nextStart.surah,
    startAyah: nextStart.ayah,
    endSurah: null,
    endAyah: null,
    orderKey: `${now.toString(36)}_${nextRef.id}`,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  if (isKhatmah) {
    batch.update(blockRef, {
      runsCompleted: increment(1),
      currentRun: nextRun,
      updatedAt: now,
      version: increment(1),
    });
  }

  await batch.commit();
}