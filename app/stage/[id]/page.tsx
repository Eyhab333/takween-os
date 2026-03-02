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

type NodeRow = {
  id: string;
  title: string;
  orderKey?: string;
  type: string;
  parentId: string | null;
  blockType?: string;
};

export default function StagePage() {
  const { id } = useParams<{ id: string }>();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageTitle, setStageTitle] = useState("");
  const [blocks, setBlocks] = useState<NodeRow[]>([]);

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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.id} className="flex items-stretch gap-2">
            <Link
              href={`/block/${b.id}`}
              className="flex-1 rounded-lg border bg-card px-4 py-3 hover:bg-muted"
            >
              <div className="font-bold">{b.title}</div>
              <div className="text-xs text-muted-foreground">
                {b.blockType ?? "block"}
              </div>
            </Link>

            <Button
              variant="outline"
              className="h-auto"
              onClick={async () => {
                const ok = window.confirm(
                  "حذف هذا البلوك؟ (سيتم أرشفة كل ما تحته)",
                );
                if (!ok) return;

                await archiveSubtree(tenantId, b.id);
                await loadBlocks(tenantId);
              }}
            >
              حذف
            </Button>
          </div>
        ))}
        {blocks.length === 0 && (
          <div className="text-muted-foreground">لا يوجد Blocks بعد.</div>
        )}
      </div>
    </div>
  );
}
