"use client";

import { useState } from "react";
import { createBlock } from "@/lib/create-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BlockType =
  | "checklist"
  | "counter"
  | "playlist"
  | "roadmap"
  | "project"
  | "notes"
  | "habit"
  | "routine";

const LABELS: Record<BlockType, string> = {
  checklist: "Checklist",
  counter: "عداد",
  playlist: "قائمة تشغيل",
  roadmap: "خارطة طريق",
  project: "مشروع",
  notes: "ملاحظات",
  habit: "عادة (Habit)",
  routine: "روتين (جلسات)",
};

export function AddBlockInline({
  tenantId,
  parentId,
  onCreated,
}: {
  tenantId: string;
  parentId: string;
  onCreated?: () => void;
}) {
  const [type, setType] = useState<BlockType>("checklist");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    await createBlock({
      tenantId,
      parentId,
      blockType: type,
      title: title.trim() || `(${LABELS[type]}) جديد`,
    });
    setTitle("");
    setBusy(false);
    onCreated?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={type} onValueChange={(v) => setType(v as BlockType)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="النوع" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        className="w-64"
        placeholder="عنوان البلوك (اختياري)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <Button variant="outline" onClick={create} disabled={busy}>
        {busy ? "..." : "إضافة Block"}
      </Button>
    </div>
  );
}
