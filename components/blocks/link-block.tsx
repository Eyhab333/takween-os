/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
  linkDoneOnce,
  linkUndoOnce,
  saveLinkBlock,
  validateExternalUrl,
} from "@/lib/link-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function LinkBlock({
  tenantId,
  blockId,
  block,
}: {
  tenantId: string;
  blockId: string;
  block: any;
}) {
  const initialTitle =
    typeof block?.linkTitle === "string" ? block.linkTitle : "";
  const initialDescription =
    typeof block?.linkDescription === "string" ? block.linkDescription : "";
  const initialUrl = typeof block?.linkUrl === "string" ? block.linkUrl : "";
  const initialDoneCount =
    typeof block?.linkDoneCount === "number" ? block.linkDoneCount : 0;
  const initialLastDoneAt =
    typeof block?.linkLastDoneAt === "number" ? block.linkLastDoneAt : null;

  const [linkTitle, setLinkTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [url, setUrl] = useState(initialUrl);
  const [savedUrl, setSavedUrl] = useState(initialUrl);

  const [doneCount, setDoneCount] = useState<number>(initialDoneCount);
  const [lastDoneAt, setLastDoneAt] = useState<number | null>(
    initialLastDoneAt,
  );

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextTitle =
      typeof block?.linkTitle === "string" ? block.linkTitle : "";
    const nextDescription =
      typeof block?.linkDescription === "string" ? block.linkDescription : "";
    const nextUrl = typeof block?.linkUrl === "string" ? block.linkUrl : "";
    const nextDoneCount =
      typeof block?.linkDoneCount === "number" ? block.linkDoneCount : 0;
    const nextLastDoneAt =
      typeof block?.linkLastDoneAt === "number" ? block.linkLastDoneAt : null;

    setLinkTitle(nextTitle);
    setDescription(nextDescription);
    setUrl(nextUrl);
    setSavedUrl(nextUrl);
    setDoneCount(nextDoneCount);
    setLastDoneAt(nextLastDoneAt);
  }, [
    block?.linkTitle,
    block?.linkDescription,
    block?.linkUrl,
    block?.linkDoneCount,
    block?.linkLastDoneAt,
  ]);

  const checkedSavedUrl = validateExternalUrl(savedUrl);
  const canOpen = checkedSavedUrl.ok;

  async function handleSave() {
    const title = linkTitle.trim();

    if (!title) {
      setError("اكتب عنوان الرابط أولًا.");
      return;
    }

    const checked = validateExternalUrl(url);

    if (!checked.ok) {
      setError(checked.message);
      return;
    }

    setError("");
    setSaving(true);

    try {
      await saveLinkBlock({
        tenantId,
        blockId,
        title,
        description,
        url,
      });

      setLinkTitle(title);
      setDescription(description.trim());
      setUrl(checked.url);
      setSavedUrl(checked.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الرابط.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="space-y-3">
        <div className="text-sm font-bold">بيانات الرابط</div>

        {error ? <div className="text-sm text-red-500">{error}</div> : null}

        <div className="space-y-1">
          <div className="text-sm font-medium">العنوان</div>
          <Input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="مثال: كورس JavaScript"
          />
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">الوصف</div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="اكتب المطلوب إنجازه في هذا الموقع..."
            className="min-h-24"
          />
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">الرابط الخارجي</div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />

            <Button variant="outline" disabled={saving} onClick={handleSave}>
              {saving ? "..." : "حفظ"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            يمكنك كتابة الرابط بدون https، وسيتم إضافتها تلقائيًا.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {canOpen ? (
          <Button asChild>
            <a
              href={checkedSavedUrl.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              فتح الرابط
            </a>
          </Button>
        ) : (
          <Button disabled>فتح الرابط</Button>
        )}

        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const now = Date.now();

            try {
              await linkDoneOnce({
                tenantId,
                blockId,
              });

              setDoneCount((cur: number) => cur + 1);
              setLastDoneAt(now);
            } finally {
              setBusy(false);
            }
          }}
        >
          تم مرة
        </Button>

        <Button
          variant="outline"
          disabled={busy || doneCount <= 0}
          onClick={async () => {
            setBusy(true);

            try {
              await linkUndoOnce({
                tenantId,
                blockId,
              });

              setDoneCount((cur: number) => Math.max(0, cur - 1));
            } finally {
              setBusy(false);
            }
          }}
        >
          تراجع مرة
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-3 text-sm space-y-1">
        <div className="font-bold">
          الحالة: {doneCount > 0 ? `تم ${doneCount} مرة` : "لم يتم بعد"}
        </div>

        {lastDoneAt ? (
          <div className="text-xs text-muted-foreground">
            آخر إتمام: {new Date(lastDoneAt).toLocaleString("ar")}
          </div>
        ) : null}

        {canOpen ? (
          <div className="text-xs text-muted-foreground break-all" dir="ltr">
            {checkedSavedUrl.url}
          </div>
        ) : null}
      </div>
    </div>
  );
}
