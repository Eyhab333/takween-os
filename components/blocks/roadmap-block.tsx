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

type StageRow = {
  id: string;
  title: string;
  status?: StageStatus;
  orderKey?: string;
};

const STATUS_LABEL: Record<StageStatus, string> = {
  not_started: "لم تبدأ",
  in_progress: "جاري",
  done: "تم",
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

      <div className="space-y-2">
        {stages.map((s) => {
          const status = (s.status ?? "not_started") as StageStatus;

          return (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href={`/stage/${s.id}`}
                className="font-bold hover:underline"
              >
                {s.title}
              </Link>

              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  {STATUS_LABEL[status]}
                </div>

                <Select
                  value={status}
                  onValueChange={(v) =>
                    setStageStatus(tenantId, s.id, v as StageStatus)
                  }
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
              </div>
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
