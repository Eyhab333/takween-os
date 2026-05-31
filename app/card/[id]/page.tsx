/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
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
import { Breadcrumbs } from "@/components/breadcrumbs";

import { TadabburQuranReview } from "@/components/special/tadabbur-quran-review";
import { YearCalendar } from "@/components/special/year-calendar";

import { archiveSubtree } from "@/lib/archive-subtree";
import { Button } from "@/components/ui/button";
import { getBlockTypeLabel } from "@/lib/block-type-labels";

type NodeRow = {
  id: string;
  title: string;
  orderKey: string;
  type: string;
  parentId: string | null;
  blockType?: string;
};

export default function CardPage() {
  const { id } = useParams<{ id: string }>();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cardTitle, setCardTitle] = useState("");
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

      const blkSnap = await getDocs(qBlocks);
      setBlocks(blkSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    },
    [id],
  );

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setTenantId(null);
        setCardTitle("");
        setBlocks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const tid = u.uid;
      setTenantId(tid);

      const cardRef = doc(db, "tenants", tid, "nodes", id);
      const cardSnap = await getDoc(cardRef);

      setCardTitle(
        cardSnap.exists()
          ? ((cardSnap.data() as any).title as string)
          : "كارت غير موجود",
      );
      await loadBlocks(tid);

      setLoading(false);
    });
  }, [id, loadBlocks]);

  if (!tenantId)
    return (
      <div className="text-muted-foreground">سجّل الدخول لعرض بياناتك.</div>
    );
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  if (id === "ib_card_mind_tadabbur") {
    return (
      <div className="space-y-4">
        <Breadcrumbs tenantId={tenantId} nodeId={id} />
        <h1 className="text-2xl font-bold">{cardTitle}</h1>
        <TadabburQuranReview tenantId={tenantId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Breadcrumbs tenantId={tenantId} nodeId={id} />
        <h1 className="text-2xl font-bold">{cardTitle}</h1>
        {String(id).startsWith("year_") && (
          <YearCalendar
            tenantId={tenantId}
            yearCardId={id}
            year={Number(String(id).replace("year_", ""))}
          />
        )}
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
              className="pressable brand-card flex-1 rounded-lg border bg-card px-4 py-3 hover:bg-muted"
            >
              <div className="font-bold">{b.title}</div>
              <div className="text-xs text-muted-foreground">
                {getBlockTypeLabel(b.blockType)}
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
