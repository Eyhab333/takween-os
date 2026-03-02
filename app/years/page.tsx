/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { ensureYearsSpace } from "@/lib/templates/years";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

type NodeRow = { id: string; title: string; orderKey: string };

export default function YearsPage() {
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

      await ensureYearsSpace(tenantId);

      const nodesRef = collection(db, "tenants", tenantId, "nodes");
      const qCards = query(
        nodesRef,
        where("parentId", "==", "years_sec_main"),
        where("type", "==", "card"),
        where("archived", "==", false),
        orderBy("orderKey", "desc"),
      );

      const snap = await getDocs(qCards);
      setCards(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
  }, []);

  if (!auth.currentUser)
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">السنوات</h1>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/card/${c.id}`}
            className="rounded-lg border bg-card p-4 hover:bg-muted"
          >
            <div className="text-xl font-bold">{c.title}</div>
          </Link>
        ))}
        {cards.length === 0 && (
          <div className="text-muted-foreground">
            لم تنشئ سنوات بعد من الصفحة الرئيسية.
          </div>
        )}
      </div>
    </div>
  );
}
