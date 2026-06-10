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
  | "routine"
  | "youtube_channel"
  | "pdf_reader"
  | "link";

const LABELS: Record<BlockType, string> = {
  roadmap: "خطة لتحقيق هدف",
  playlist: "قائمة تشغيل يوتيوب",
  youtube_channel: "قناة يوتيوب",
  pdf_reader: "قراءة كتاب PDF",
  project: "مشروع",
  notes: "ملاحظات",
  checklist: "قائمة مهام",
  habit: "عادة (Habit)",
  routine: "روتين (جلسات)",
  link: "رابط موقع خارجي",
  counter: "عداد استغفار",
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
  const [type, setType] = useState<BlockType | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!type) return;

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
          <SelectValue placeholder="اختر قالب..." />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="template-placeholder" disabled>
            اختر قالب...
          </SelectItem>

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

      <Button variant="outline" onClick={create} disabled={busy || !type}>
        {busy ? "..." : "إضافة Block"}
      </Button>
    </div>
  );
}
