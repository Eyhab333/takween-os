/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { saveNotesBlock } from "@/lib/notes-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NotesBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const snap = await getDoc(doc(db, "tenants", tenantId, "nodes", blockId));
      const d = snap.exists() ? (snap.data() as any) : {};
      setText(d.notesText || "");
      setLoading(false);
    })();
  }, [tenantId, blockId]);

  async function save() {
    setSaving(true);
    await saveNotesBlock({ tenantId, blockId, text });
    setSaving(false);
  }

  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="اكتب ملاحظاتك هنا..."
        className="min-h-55"
      />
      <Button variant="outline" onClick={save} disabled={saving}>
        {saving ? "..." : "حفظ"}
      </Button>
    </div>
  );
}
