/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";

type Row = {
  id: string;
  type: string;
  title?: string;
  updatedAt?: number | Timestamp;
  blockType?: string;
};

function hrefForNode(n: Row) {
  if (n.type === "block") return `/block/${n.id}`;
  if (n.type === "card") return `/card/${n.id}`;
  if (n.type === "stage") return `/stage/${n.id}`;
  return `/explorer`;
}

function typeLabel(n: Row) {
  if (n.type === "block") return n.blockType ? `بلوك: ${n.blockType}` : "بلوك";
  if (n.type === "card") return "كارت";
  if (n.type === "stage") return "مرحلة";
  return n.type;
}

const dtf = new Intl.DateTimeFormat("ar-SA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type SnapState = {
  tenantId: string | null;
  rows: Row[];
  error?: string | null;
};

export default function ActivityPage() {
  const [user, setUser] = useState<typeof auth.currentUser>(auth.currentUser);
  const [snapState, setSnapState] = useState<SnapState>({
    tenantId: null,
    rows: [],
    error: null,
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setSnapState({ tenantId: null, rows: [], error: null });
      }
    });
    return () => unsub();
  }, []);

  const tenantId = user?.uid ?? null;

  useEffect(() => {
    if (!tenantId) return;

    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("archived", "==", false),
      where("type", "in", ["card", "block", "stage"]),
      orderBy("updatedAt", "desc"),
      limit(50),
    );

    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setSnapState({ tenantId, rows, error: null });
      },
      (err) => {
        setSnapState({ tenantId, rows: [], error: err?.message ?? "Error" });
      },
    );
  }, [tenantId]);

  const loading =
    !!tenantId && snapState.tenantId !== tenantId && !snapState.error;

  const rowsForTenant = useMemo(
    () => (snapState.tenantId === tenantId ? snapState.rows : []),
    [snapState.tenantId, snapState.rows, tenantId],
  );

  const items = useMemo(
    () =>
      rowsForTenant.map((r) => {
        const d =
          typeof r.updatedAt === "number"
            ? new Date(r.updatedAt)
            : r.updatedAt && typeof (r.updatedAt as any).toDate === "function"
              ? (r.updatedAt as any).toDate()
              : null;

        return {
          ...r,
          title: (r.title || r.id) as string,
          time: d ? dtf.format(d) : "",
          href: hrefForNode(r),
          label: typeLabel(r),
        };
      }),
    [rowsForTenant],
  );

  if (!user) return <div className="text-muted-foreground">سجّل الدخول.</div>;
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">النشاط</h1>

      <div className="space-y-2">
        {items.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            className="block rounded-lg border bg-card px-4 py-3 hover:bg-muted"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold">{it.title}</div>
              <div className="text-xs text-muted-foreground">{it.time}</div>
            </div>
            <div className="text-xs text-muted-foreground">{it.label}</div>
          </Link>
        ))}

        {items.length === 0 && (
          <div className="text-muted-foreground">لا يوجد نشاط بعد.</div>
        )}

        {snapState.error && (
          <div className="text-destructive text-sm">{snapState.error}</div>
        )}
      </div>
    </div>
  );
}
