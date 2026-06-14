/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addRoadmapStage,
  setStageStatus,
  type StageStatus,
} from "@/lib/roadmap-actions";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { renameNodeTitle } from "@/lib/node-actions";
import { archiveSubtree } from "@/lib/archive-subtree";
import { celebrateDone } from "@/lib/celebrate";

import {
  calculateRoadmapProgress,
  type RoadmapProgressResult,
} from "@/lib/roadmap-progress";
import { Pencil, Trash } from "lucide-react";

type StageRow = {
  id: string;
  title: string;
  status?: StageStatus;
  orderKey?: string;
};

const STATUS_LABEL: Record<StageStatus, string> = {
  not_started: "لم تبدأ",
  in_progress: "جاري",
  done: "✅",
};

export function RoadmapBlock({
  tenantId,
  blockId,
}: {
  tenantId: string;
  blockId: string;
}) {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const [progressBusy, setProgressBusy] = useState(false);
  const [progress, setProgress] = useState<RoadmapProgressResult | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const nodesRef = collection(db, "tenants", tenantId, "nodes");
    const q = query(
      nodesRef,
      where("parentId", "==", blockId),
      where("type", "==", "stage"),
      where("archived", "==", false),
      orderBy("orderKey"),
    );

    return onSnapshot(q, (snap) => {
      setStages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [tenantId, blockId]);

  async function addStage() {
    setBusy(true);
    await addRoadmapStage(tenantId, blockId, title);
    setTitle("");
    setBusy(false);
  }

  async function showProgress() {
    setProgressBusy(true);

    try {
      const result = await calculateRoadmapProgress({
        tenantId,
        roadmapBlockId: blockId,
      });

      setProgress(result);
    } finally {
      setProgressBusy(false);
    }
  }

  function startEditStage(stage: StageRow) {
    setEditingId(stage.id);
    setEditTitle(stage.title || "");
  }

  async function saveStageTitle(stageId: string) {
    const t = editTitle.trim();
    if (!t) return;

    setSavingId(stageId);
    try {
      await renameNodeTitle({
        tenantId,
        nodeId: stageId,
        title: t,
      });

      setEditingId(null);
      setEditTitle("");
    } finally {
      setSavingId(null);
    }
  }

  async function archiveStage(stageId: string) {
    const ok = window.confirm(
      "هل تريد حذف هذه المرحلة؟ سيتم إخفاؤها مع كل ما بداخلها.",
    );

    if (!ok) return;

    setDeletingId(stageId);
    try {
      await archiveSubtree(tenantId, stageId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="اسم المرحلة"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button variant="outline" onClick={addStage} disabled={busy}>
          {busy ? "..." : "إضافة مرحلة"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold">نسبة تقدمي في الخطة</div>
            <div className="text-xs text-muted-foreground">
              يتم الحساب فقط عند الضغط حتى لا يؤثر على سرعة تحميل الصفحة.
            </div>
          </div>

          <Button
            variant="outline"
            onClick={showProgress}
            disabled={progressBusy}
          >
            {progressBusy ? "جارٍ الحساب..." : "عرض نسبة التقدم"}
          </Button>
        </div>

        {progress && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              {/* <span>
                المكتمل: {progress.done} / {progress.total}
              </span> */}
              <span className="font-bold">{progress.percent}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            {progress.total === 0 && (
              <div className="text-xs text-muted-foreground">
                لا توجد عناصر قابلة للحساب داخل خارطة الطريق بعد.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {stages.map((s, index) => {
          const isLast = index === stages.length - 1;
          const status = (s.status ?? "not_started") as StageStatus;

          return (
            <div key={s.id} className="space-y-2">
              <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  {editingId === s.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                      />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === s.id || !editTitle.trim()}
                          onClick={() => saveStageTitle(s.id)}
                        >
                          {savingId === s.id ? "..." : "حفظ"}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === s.id}
                          onClick={() => {
                            setEditingId(null);
                            setEditTitle("");
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={`/stage/${s.id}`}
                      className="font-bold hover:underline"
                    >
                      {s.title}
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {STATUS_LABEL[status]}
                  </div>

                  <Select
                    value={status}
                    onValueChange={async (v) => {
                      const nextStatus = v as StageStatus;
                      const wasDone = status === "done";

                      await setStageStatus(tenantId, s.id, nextStatus);

                      if (!wasDone && nextStatus === "done") {
                        celebrateDone("big");
                      }
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">لم تبدأ</SelectItem>
                      <SelectItem value="in_progress">جاري</SelectItem>
                      <SelectItem value="done">تم</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={editingId === s.id}
                    onClick={() => startEditStage(s)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deletingId === s.id}
                    onClick={() => archiveStage(s.id)}
                  >
                    {deletingId === s.id ? "..." : <Trash className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {!isLast && (
                <div className="flex justify-center text-2xl text-muted-foreground">
                  ↓
                </div>
              )}
            </div>
          );
        })}

        {stages.length === 0 && (
          <div className="text-muted-foreground">لا توجد مراحل بعد.</div>
        )}
      </div>
    </div>
  );
}
