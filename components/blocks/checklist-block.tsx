/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { addChecklistItem, toggleChecklistDone } from "@/lib/checklist-actions";

import { celebrateDone } from "@/lib/celebrate";

type ItemRow = { id: string; title: string; done?: boolean; orderKey?: string };

export function ChecklistBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "item"),
      where("archived", "==", false),
      orderBy("orderKey"),
    );

    return onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ItemRow[],
      );
    });
  }, [tenantId, blockId]);

  async function addItem() {
    const title = text.trim();
    if (!title) return;
    setBusy(true);
    await addChecklistItem(tenantId, blockId, title);
    setText("");
    setBusy(false);
  }

  async function toggleDone(itemId: string, currentDone: boolean) {
    await toggleChecklistDone(tenantId, itemId, currentDone);
    if (!currentDone) {
      celebrateDone("soft");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="أضف مهمة..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? addItem() : null)}
        />
        <button
          className="h-9 rounded-md border px-3 text-sm"
          onClick={addItem}
          disabled={busy}
        >
          إضافة
        </button>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => toggleDone(it.id, !!it.done)}
            className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-right text-sm hover:bg-muted"
          >
            <span className={it.done ? " text-muted-foreground" : ""}>
              {it.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {it.done ? "✅" : "لم يتم"}
            </span>
          </button>
        ))}
        {items.length === 0 && (
          <div className="text-muted-foreground">لا يوجد مهام بعد.</div>
        )}
      </div>
    </div>
  );
}
