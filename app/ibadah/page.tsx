/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { ensureIbadahTemplate } from "@/lib/templates/ibadah";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";

type NodeRow = {
  id: string;
  title: string;
  orderKey: string;
  type: string;
  parentId: string | null;
};

export default function IbadahPage() {
  const [loading, setLoading] = useState(true);
  const [spaceTitle] = useState("الشريعة والإصلاح");

  const [sections, setSections] = useState<NodeRow[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [cards, setCards] = useState<NodeRow[]>([]);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setSections([]);
        setCards([]);
        setActiveSectionId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const tenantId = u.uid;

      await ensureIbadahTemplate(tenantId);

      // 1) Load Space title (اختياري: من nodes/space_ibadah)
      // لو حبيت نقرأه لاحقًا.

      // 2) Load Sections
      const nodesRef = collection(db, "tenants", tenantId, "nodes");
      const qSections = query(
        nodesRef,
        where("parentId", "==", "space_ibadah"),
        where("type", "==", "section"),
        where("archived", "==", false),
        orderBy("orderKey"),
      );
      const secSnap = await getDocs(qSections);
      const secs = secSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as NodeRow[];

      setSections(secs);
      const first = secs[0]?.id ?? null;
      setActiveSectionId(first);

      // 3) Load Cards for first section
      if (first) {
        const qCards = query(
          nodesRef,
          where("parentId", "==", first),
          where("type", "==", "card"),
          where("archived", "==", false),
          orderBy("orderKey"),
        );
        const cardSnap = await getDocs(qCards);
        setCards(
          cardSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as NodeRow[],
        );
      } else {
        setCards([]);
      }

      setLoading(false);
    });
  }, []);

  async function openSection(sectionId: string) {
    const u = auth.currentUser;
    if (!u) return;

    setActiveSectionId(sectionId);
    setLoading(true);

    const tenantId = u.uid;
    const nodesRef = collection(db, "tenants", tenantId, "nodes");

    const qCards = query(
      nodesRef,
      where("parentId", "==", sectionId),
      where("type", "==", "card"),
      where("archived", "==", false),
      orderBy("orderKey"),
    );
    const cardSnap = await getDocs(qCards);
    setCards(
      cardSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as NodeRow[],
    );

    setLoading(false);
  }

  if (!auth.currentUser) {
    return (
      <div className="text-muted-foreground">سجّل الدخول لعرض بياناتك.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className=" space-y-1">
        <h1 className="text-2xl font-bold">{spaceTitle}</h1>
        <p className="text-muted-foreground">اختر قسمًا لعرض الكروت.</p>
      </div>

      {/* Sections */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => {
          const active = s.id === activeSectionId;
          return (
            <button
              key={s.id}
              onClick={() => openSection(s.id)}
              className={[
                " rounded-lg border px-4 py-3 text-right transition",
                "hover:bg-muted",
                active
                  ? "border-primary/35 bg-primary/10 font-extrabold text-primary shadow-[0_0_18px_rgba(234,179,8,0.12)] "
                  : "bg-card",
              ].join(" ")}
            >
              <div className="font-bold">{s.title}</div>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        <div className="text-sm font-bold">الكروت</div>
        {loading && (
          <div className="text-muted-foreground">جارٍ التحميل...</div>
        )}

        {!loading && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.id}
                href={`/card/${c.id}`}
                className="brand-card pressable block rounded-lg border bg-card px-4 py-3 hover:bg-muted"
              >
                <div className="font-bold">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.id}</div>
              </Link>
            ))}
            {cards.length === 0 && (
              <div className="text-muted-foreground">
                لا يوجد كروت في هذا القسم.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
