/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddBlockInline } from "@/components/add-block-inline";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { archiveSubtree } from "@/lib/archive-subtree";
import { getBlockTypeLabel } from "@/lib/block-type-labels";
import { swapNodeOrderKeys, toggleNodeDone } from "@/lib/node-actions";
import { Trash } from "lucide-react";

type NodeRow = {
  id: string;
  title: string;
  orderKey?: string;
  type: string;
  parentId: string | null;
  blockType?: string;
  done?: boolean;
};

export default function StagePage() {
  const { id } = useParams<{ id: string }>();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageTitle, setStageTitle] = useState("");
  const [blocks, setBlocks] = useState<NodeRow[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBlocks = useCallback(
    async (tid: string) => {
      const nodesRef = collection(db, "tenants", tid, "nodes");
      const qBlocks = query(
        nodesRef,
        where("parentId", "==", id),
        where("type", "==", "block"),
        where("archived", "==", false),
        orderBy("orderKey"),
      );

      const snap = await getDocs(qBlocks);
      setBlocks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    },
    [id],
  );

  async function toggleBlockDone(block: NodeRow) {
    if (!tenantId) return;

    const currentDone = block.done === true;

    setTogglingId(block.id);
    try {
      await toggleNodeDone({
        tenantId,
        nodeId: block.id,
        currentDone,
      });

      setBlocks((cur) =>
        cur.map((b) => (b.id === block.id ? { ...b, done: !currentDone } : b)),
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function removeBlock(blockId: string) {
    if (!tenantId) return;

    const ok = window.confirm(
      "هل تريد حذف هذا الكارت؟ سيتم إخفاؤه مع كل ما بداخله.",
    );

    if (!ok) return;

    setDeletingId(blockId);
    try {
      await archiveSubtree(tenantId, blockId);

      setBlocks((cur) => cur.filter((b) => b.id !== blockId));
    } finally {
      setDeletingId(null);
    }
  }

  async function moveBlock(blockId: string, direction: "up" | "down") {
    if (!tenantId) return;

    const index = blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const current = blocks[index];
    const target = blocks[targetIndex];

    if (!target) return;
    if (!current.orderKey || !target.orderKey) return;

    await swapNodeOrderKeys({
      tenantId,
      firstNodeId: current.id,
      firstOrderKey: current.orderKey,
      secondNodeId: target.id,
      secondOrderKey: target.orderKey,
    });

    setBlocks((cur) => {
      const copy = [...cur];
      [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
      return copy;
    });
  }

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setTenantId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const tid = u.uid;
      setTenantId(tid);

      const ref = doc(db, "tenants", tid, "nodes", id);
      const snap = await getDoc(ref);

      setStageTitle(
        snap.exists()
          ? ((snap.data() as any).title as string)
          : "مرحلة غير موجودة",
      );

      await loadBlocks(tid);
      setLoading(false);
    });
  }, [id, loadBlocks]);

  if (!tenantId)
    return <div className="text-muted-foreground">سجّل الدخول.</div>;

  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <Breadcrumbs tenantId={tenantId} nodeId={id} />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{stageTitle}</h1>

        <AddBlockInline
          tenantId={tenantId}
          parentId={id}
          onCreated={() => loadBlocks(tenantId)}
        />
      </div>

      <div className="space-y-2">
        {blocks.map((b, index) => {
          const isLast = index === blocks.length - 1;
          const done = b.done === true;

          return (
            <div key={b.id} className="space-y-2">
              <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold">
                    {index + 1}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/block/${b.id}`}
                        className="min-w-0 font-bold hover:underline"
                      >
                        {b.title}
                      </Link>

                      {done && <span title="تم">✅</span>}
                    </div>

                    {b.blockType && (
                      <div className="text-xs text-muted-foreground">
                        {getBlockTypeLabel(b.blockType)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => moveBlock(b.id, "up")}
                  >
                    ↑
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLast}
                    onClick={() => moveBlock(b.id, "down")}
                  >
                    ↓
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={togglingId === b.id}
                    onClick={() => toggleBlockDone(b)}
                  >
                    {togglingId === b.id ? "..." : done ? "إلغاء التمام" : "تم"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletingId === b.id}
                    onClick={() => removeBlock(b.id)}
                  >
                    {deletingId === b.id ? "..." : <Trash className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {!isLast && (
                <div className="flex justify-center text-2xl text-muted-foreground">
                  ↓
                </div>
              )}
            </div>
          );
        })}

        {blocks.length === 0 && (
          <div className="text-muted-foreground">لا يوجد Blocks بعد.</div>
        )}
      </div>
    </div>
  );
}
