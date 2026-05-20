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
      currentRun: 1,
      currentOpenEntryId: null,
      lastCompletedEntryId: null,
      quranReviewRunNumberMigrated: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  } else {
    const blockData = blockSnap.data() as any;
    const needsPatch: Record<string, any> = {};

    if (typeof blockData.currentRun !== "number") {
      needsPatch.currentRun = 1;
    }

    if (!("currentOpenEntryId" in blockData)) {
      needsPatch.currentOpenEntryId = null;
    }

    if (!("lastCompletedEntryId" in blockData)) {
      needsPatch.lastCompletedEntryId = null;
    }

    if (Object.keys(needsPatch).length) {
      await updateDoc(blockRef, {
        ...needsPatch,
        updatedAt: now,
        version: increment(1),
      });
    }
  }

  const freshBlockSnap = await getDoc(blockRef);
  const freshBlockData = freshBlockSnap.exists()
    ? (freshBlockSnap.data() as any)
    : {};
  const currentRun =
    typeof freshBlockData.currentRun === "number" ? freshBlockData.currentRun : 1;

  // Migration قديمة: نفذها مرة واحدة فقط بدل قراءتها مع كل فتح للصفحة.
  if (freshBlockData.quranReviewRunNumberMigrated !== true) {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const qAll = query(
      nodesRef,
      where("parentId", "==", BLOCK_ID),
      where("type", "==", "item"),
      where("archived", "==", false),
      limit(500),
    );
    const allSnap = await getDocs(qAll);

    const batch = writeBatch(db);
    let changed = 0;

    allSnap.docs.forEach((d) => {
      const data = d.data() as any;
      if (typeof data.runNumber !== "number") {
        batch.update(d.ref, {
          runNumber: 1,
          updatedAt: now,
          version: increment(1),
        });
        changed++;
      }
    });

    batch.update(blockRef, {
      quranReviewRunNumberMigrated: true,
      updatedAt: now,
      version: increment(1),
    });

    await batch.commit();
  }

  // تأكد من وجود entry مفتوح واحد على الأقل، وخزن id الخاص به على البلوك.
  const nodesRef = collection(db, "tenants", tenantId, "nodes");
  const qOpen = query(
    nodesRef,
    where("parentId", "==", BLOCK_ID),
    where("type", "==", "item"),
    where("archived", "==", false),
    where("locked", "==", false),
    limit(1),
  );
  const openSnap = await getDocs(qOpen);

  if (openSnap.empty) {
    const nextRef = doc(nodesRef);
    const batch = writeBatch(db);

    batch.set(nextRef, {
      id: nextRef.id,
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
      orderKey: `${now.toString(36)}_${nextRef.id}`,
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
      currentRun: 1,
      runNumber: currentRun,
    });

    batch.update(blockRef, {
      currentOpenEntryId: nextRef.id,
      updatedAt: now,
      version: increment(1),
    });

    await batch.commit();
  } else {
    const openId = openSnap.docs[0].id;
    if (freshBlockData.currentOpenEntryId !== openId) {
      await updateDoc(blockRef, {
        currentOpenEntryId: openId,
        updatedAt: now,
        version: increment(1),
      });
    }
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
  patch: Record<string, any>,
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
  startSurah: number;
  startAyah: number;
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
    startSurah: params.startSurah,
    startAyah: params.startAyah,
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

  const blockPatch: Record<string, any> = {
    currentOpenEntryId: nextRef.id,
    lastCompletedEntryId: params.entryId,
    updatedAt: now,
    version: increment(1),
  };

  if (isKhatmah) {
    blockPatch.runsCompleted = increment(1);
    blockPatch.currentRun = nextRun;
  }

  batch.update(blockRef, blockPatch);

  await batch.commit();
}
