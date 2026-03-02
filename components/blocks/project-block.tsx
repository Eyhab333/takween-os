/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { saveProjectBlock, type ProjectLink } from "@/lib/project-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PIPELINE = [
  { v: "research", t: "بحث" },
  { v: "recon", t: "استطلاع" },
  { v: "testing", t: "اختبار" },
  { v: "writeup", t: "كتابة التقرير" },
  { v: "submitted", t: "تم الإرسال" },
  { v: "accepted", t: "مقبول" },
  { v: "rejected", t: "مرفوض" },
];

export function ProjectBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState("research");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("");
  const [links, setLinks] = useState<ProjectLink[]>([]);

  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const snap = await getDoc(doc(db, "tenants", tenantId, "nodes", blockId));
      const d = snap.exists() ? (snap.data() as any) : {};

      setStatus(d.projectStatus || "research");
      setDescription(d.projectDescription || "");
      setScope(d.projectScope || "");
      setLinks(Array.isArray(d.projectLinks) ? d.projectLinks : []);

      setLoading(false);
    })();
  }, [tenantId, blockId]);

  async function save() {
    setSaving(true);
    await saveProjectBlock({
      tenantId,
      blockId,
      status,
      description,
      scope,
      links,
    });
    setSaving(false);
  }

  function addLinkLocal() {
    const l = linkLabel.trim();
    const u = linkUrl.trim();
    if (!l || !u) return;
    setLinks((x) => [...x, { label: l, url: u }]);
    setLinkLabel("");
    setLinkUrl("");
  }

  function removeLink(idx: number) {
    setLinks((x) => x.filter((_, i) => i !== idx));
  }

  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE.map((s) => (
              <SelectItem key={s.v} value={s.v}>
                {s.t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={save} disabled={saving}>
          {saving ? "..." : "حفظ"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-bold">وصف</div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-bold">Scope</div>
        <Textarea value={scope} onChange={(e) => setScope(e.target.value)} />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-bold">روابط</div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="اسم الرابط"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
          />
          <Input
            placeholder="URL"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Button variant="outline" onClick={addLinkLocal}>
            إضافة
          </Button>
        </div>

        <div className="space-y-2">
          {links.map((l, idx) => (
            <div
              key={`${l.label}_${idx}`}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
            >
              <a
                className="text-sm hover:underline"
                href={l.url}
                target="_blank"
                rel="noreferrer"
              >
                {l.label}
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeLink(idx)}
              >
                حذف
              </Button>
            </div>
          ))}
          {links.length === 0 && (
            <div className="text-muted-foreground">لا توجد روابط بعد.</div>
          )}
        </div>
      </div>
    </div>
  );
}
