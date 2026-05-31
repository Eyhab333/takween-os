/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export type RoadmapProgressResult = {
  done: number;
  total: number;
  percent: number;
};

function calcPercent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

async function calculateRoadmapProgressInner(params: {
  tenantId: string;
  roadmapBlockId: string;
  visited: Set<string>;
}): Promise<RoadmapProgressResult> {
  if (params.visited.has(params.roadmapBlockId)) {
    return { done: 0, total: 0, percent: 0 };
  }

  params.visited.add(params.roadmapBlockId);

  const nodesRef = collection(db, "tenants", params.tenantId, "nodes");

  const stagesSnap = await getDocs(
    query(
      nodesRef,
      where("parentId", "==", params.roadmapBlockId),
      where("type", "==", "stage"),
      where("archived", "==", false),
    ),
  );

  let done = 0;
  let total = 0;

  for (const stageDoc of stagesSnap.docs) {
    const blocksSnap = await getDocs(
      query(
        nodesRef,
        where("parentId", "==", stageDoc.id),
        where("type", "==", "block"),
        where("archived", "==", false),
      ),
    );

    for (const blockDoc of blocksSnap.docs) {
      const block = blockDoc.data() as any;

      if (block.blockType === "roadmap") {
        const nested = await calculateRoadmapProgressInner({
          tenantId: params.tenantId,
          roadmapBlockId: blockDoc.id,
          visited: params.visited,
        });

        done += nested.done;
        total += nested.total;
      } else {
        total += 1;
        if (block.done === true) done += 1;
      }
    }
  }

  return {
    done,
    total,
    percent: calcPercent(done, total),
  };
}

export async function calculateRoadmapProgress(params: {
  tenantId: string;
  roadmapBlockId: string;
}) {
  return calculateRoadmapProgressInner({
    tenantId: params.tenantId,
    roadmapBlockId: params.roadmapBlockId,
    visited: new Set<string>(),
  });
}
