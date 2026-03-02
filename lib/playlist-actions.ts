import { db } from "@/lib/firebase";
import { collection, doc, increment, setDoc, updateDoc, writeBatch } from "firebase/firestore";

export async function addPlaylistEpisode(tenantId: string, blockId: string, title: string, url: string) {
  const now = Date.now();
  const colRef = collection(db, "tenants", tenantId, "nodes");
  const ref = doc(colRef); // auto-id
  const id = ref.id;

  await setDoc(ref, {
    id,
    tenantId,
    parentId: blockId,
    type: "item",
    title,
    url,
    orderKey: `${now.toString(36)}_${id}`,
    archived: false,
    done: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return id;
}

export async function toggleEpisodeDone(tenantId: string, episodeId: string, currentDone: boolean) {
  await updateDoc(doc(db, "tenants", tenantId, "nodes", episodeId), {
    done: !currentDone,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function markEpisodeOpened(tenantId: string, blockId: string, episodeId: string) {
  const now = Date.now();

  const epRef = doc(db, "tenants", tenantId, "nodes", episodeId);
  const blockRef = doc(db, "tenants", tenantId, "nodes", blockId);

  const batch = writeBatch(db);

  batch.update(epRef, { lastOpenedAt: now, updatedAt: now, version: increment(1) });
  batch.update(blockRef, { lastOpenedAt: now, lastOpenedEpisodeId: episodeId, updatedAt: now, version: increment(1) });

  await batch.commit();
}
