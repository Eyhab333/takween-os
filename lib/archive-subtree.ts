import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function archiveSubtree(tenantId: string, rootId: string) {
  const nodesRef = collection(db, "tenants", tenantId, "nodes");
  const discovered = new Set<string>([rootId]);
  const q: string[] = [rootId];

  // 1) اكتشف كل الأبناء (BFS)
  while (q.length) {
    const cur = q.shift()!;
    const snap = await getDocs(
      query(
        nodesRef,
        where("parentId", "==", cur),
        where("archived", "==", false),
        limit(500)
      )
    );

    snap.docs.forEach((d) => {
      if (!discovered.has(d.id)) {
        discovered.add(d.id);
        q.push(d.id);
      }
    });
  }

  // 2) أرشفة الجميع دفعة دفعة
  const now = Date.now();
  const ids = Array.from(discovered);
  for (const part of chunk(ids, 450)) {
    const batch = writeBatch(db);
    part.forEach((id) => {
      batch.update(doc(db, "tenants", tenantId, "nodes", id), {
        archived: true,
        archivedAt: now,
        updatedAt: now,
        version: increment(1),
      });
    });
    await batch.commit();
  }
}