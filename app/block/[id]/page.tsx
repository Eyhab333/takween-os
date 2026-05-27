/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ChecklistBlock } from "@/components/blocks/checklist-block";
import { PlaylistBlock } from "@/components/blocks/playlist-block";
import { ProjectBlock } from "@/components/blocks/project-block";
import { RoadmapBlock } from "@/components/blocks/roadmap-block";
import { NotesBlock } from "@/components/blocks/notes-block";
import { CounterBlock } from "@/components/blocks/counter-block";
import { HabitBlock } from "@/components/blocks/habit-block";
import { RoutineBlock } from "@/components/blocks/routine-block";
import { YoutubeChannelBlock } from "@/components/blocks/youtube-channel-block";
import { YoutubePlaylistBlock } from "@/components/blocks/youtube-playlist-block";

import { linkDoneOnce, linkUndoOnce, saveLinkBlock } from "@/lib/link-actions";
import { renameNodeTitle } from "@/lib/node-actions";
import { archiveSubtree } from "@/lib/archive-subtree";

const PdfReaderBlock = dynamic(
  () =>
    import("@/components/blocks/pdf-reader-block").then(
      (mod) => mod.PdfReaderBlock,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        جارٍ تحميل قارئ PDF...
      </div>
    ),
  },
);

function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

function LinkBlock({
  tenantId,
  blockId,
  block,
}: {
  tenantId: string;
  blockId: string;
  block: any;
}) {
  const initialUrl = typeof block?.linkUrl === "string" ? block.linkUrl : "";
  const initialDoneCount =
    typeof block?.linkDoneCount === "number" ? block.linkDoneCount : 0;
  const initialLastDoneAt =
    typeof block?.linkLastDoneAt === "number" ? block.linkLastDoneAt : null;

  const [url, setUrl] = useState(initialUrl);
  const [savedUrl, setSavedUrl] = useState(initialUrl);

  const [doneCount, setDoneCount] = useState<number>(initialDoneCount);

  const [lastDoneAt, setLastDoneAt] = useState<number | null>(
    initialLastDoneAt,
  );

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const nextUrl = typeof block?.linkUrl === "string" ? block.linkUrl : "";
    const nextDoneCount =
      typeof block?.linkDoneCount === "number" ? block.linkDoneCount : 0;
    const nextLastDoneAt =
      typeof block?.linkLastDoneAt === "number" ? block.linkLastDoneAt : null;

    setUrl(nextUrl);
    setSavedUrl(nextUrl);
    setDoneCount(nextDoneCount);
    setLastDoneAt(nextLastDoneAt);
  }, [block?.linkUrl, block?.linkDoneCount, block?.linkLastDoneAt]);

  const normalizedSavedUrl = normalizeExternalUrl(savedUrl);
  const canOpen = normalizedSavedUrl.length > 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-bold">الرابط الخارجي</div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />

          <Button
            variant="outline"
            disabled={saving}
            onClick={async () => {
              const normalized = normalizeExternalUrl(url);

              setSaving(true);
              try {
                await saveLinkBlock({
                  tenantId,
                  blockId,
                  url: normalized,
                });

                setUrl(normalized);
                setSavedUrl(normalized);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "..." : "حفظ"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {canOpen ? (
          <Button asChild>
            <a
              href={normalizedSavedUrl}
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

              setDoneCount((cur) => cur + 1);
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

              setDoneCount((cur) => Math.max(0, cur - 1));
            } finally {
              setBusy(false);
            }
          }}
        >
          تراجع مرة
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-3 text-sm">
        <div className="font-bold">
          الحالة: {doneCount > 0 ? `تم ${doneCount} مرة` : "لم يتم بعد"}
        </div>

        {lastDoneAt ? (
          <div className="mt-1 text-xs text-muted-foreground">
            آخر إتمام: {new Date(lastDoneAt).toLocaleString("ar")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BlockPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [blockType, setBlockType] = useState<string>("");
  const [sourceType, setSourceType] = useState<string>("");
  const [blockData, setBlockData] = useState<any | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const tenantId = u.uid;

      const ref = doc(db, "tenants", tenantId, "nodes", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setTitle("Block غير موجود");
        setBlockType("");
        setSourceType("");
        setBlockData(null);
        setLoading(false);
        return;
      }

      const data = snap.data() as any;

      setBlockData(data);
      setParentId(data.parentId ?? null);
      setTitle(data.title ?? "");
      setDraftTitle((prev) => (prev ? prev : (data.title ?? "")));
      setBlockType(data.blockType ?? "");
      setSourceType(data.sourceType ?? "");
      setLoading(false);
    });
  }, [id]);

  if (!auth.currentUser) {
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  }

  if (loading) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  const tenantId = auth.currentUser.uid;

  return (
    <div className="space-y-4">
      <div>
        <Breadcrumbs tenantId={tenantId} nodeId={id} />

        <div className="flex items-center justify-between gap-2">
          {!editing ? (
            <h1 className="text-2xl font-bold">{title}</h1>
          ) : (
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!auth.currentUser) return;

                const ok = window.confirm(
                  "حذف هذا البلوك؟ (سيتم أرشفة كل ما تحته)",
                );
                if (!ok) return;

                await archiveSubtree(auth.currentUser.uid, String(id));

                if (parentId) {
                  router.push(`/card/${parentId}`);
                } else {
                  router.push("/explorer");
                }
              }}
            >
              حذف البلوك
            </Button>

            {!editing ? (
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setEditing(true)}
              >
                تعديل الاسم
              </button>
            ) : (
              <>
                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={async () => {
                    await renameNodeTitle({
                      tenantId,
                      nodeId: id,
                      title: draftTitle,
                    });

                    setTitle(draftTitle.trim() || title);
                    setEditing(false);
                  }}
                >
                  حفظ
                </button>

                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => {
                    setDraftTitle(title);
                    setEditing(false);
                  }}
                >
                  إلغاء
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-muted-foreground">
          {blockType || "block"}
          {sourceType ? ` • ${sourceType}` : ""}
        </p>
      </div>

      {blockType === "youtube_channel" ? (
        <YoutubeChannelBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "playlist" && sourceType === "youtube" ? (
        <YoutubePlaylistBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "pdf_reader" ? (
        <PdfReaderBlock tenantId={tenantId} blockId={id} block={blockData} />
      ) : blockType === "link" ? (
        <LinkBlock tenantId={tenantId} blockId={id} block={blockData} />
      ) : blockType === "roadmap" ? (
        <RoadmapBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "playlist" ? (
        <PlaylistBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "checklist" ? (
        <ChecklistBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "project" ? (
        <ProjectBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "counter" ? (
        <CounterBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "notes" ? (
        <NotesBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "habit" ? (
        <HabitBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "routine" ? (
        <RoutineBlock tenantId={tenantId} blockId={id} />
      ) : (
        <div className="text-muted-foreground">
          Renderer غير جاهز لهذا النوع بعد.
        </div>
      )}
    </div>
  );
}
