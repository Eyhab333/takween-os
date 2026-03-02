/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { ensureAspectsTemplate } from "@/lib/templates/aspects";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

type NodeRow = {
  id: string;
  title: string;
  orderKey: string;
  type: string;
  parentId: string | null;
};

export default function AspectsPage() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<NodeRow[]>([]);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setCards([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const tenantId = u.uid;

      await ensureAspectsTemplate(tenantId);

      const nodesRef = collection(db, "tenants", tenantId, "nodes");
      const qCards = query(
        nodesRef,
        where("parentId", "==", "asp_sec_main"),
        where("type", "==", "card"),
        where("archived", "==", false),
        orderBy("orderKey"),
      );

      const snap = await getDocs(qCards);
      setCards(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as NodeRow[],
      );
      setLoading(false);
    });
  }, []);

  if (!auth.currentUser)
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">بقية الجوانب</h1>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/card/${c.id}`}
            className="block rounded-lg border bg-card px-4 py-3 hover:bg-muted"
          >
            <div className="font-bold">{c.title}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
