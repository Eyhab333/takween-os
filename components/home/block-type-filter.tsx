/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BLOCK_TYPE_OPTIONS = [
  { value: "roadmap", label: "خارطة طريق (هدف)" },
  { value: "playlist", label: "قائمة تشغيل يوتيوب" },
  { value: "youtube_channel", label: "قناة يوتيوب" },
  { value: "pdf_reader", label: "قراءة كتاب PDF" },
  { value: "project", label: "مشروع" },
  { value: "notes", label: "ملاحظات" },
  { value: "checklist", label: "قائمة مهام" },
  { value: "habit", label: "عادة (Habit)" },
  { value: "routine", label: "روتين (جلسات)" },
  { value: "link", label: "رابط موقع خارجي" },
  { value: "counter", label: "عداد استغفار" },
] as const;

type BlockTypeFilter = (typeof BLOCK_TYPE_OPTIONS)[number]["value"];

type BlockRow = {
  id: string;
  title: string;
  blockType: string;
  updatedAt?: number;
};

function blockTypeLabel(value: string) {
  return BLOCK_TYPE_OPTIONS.find((x) => x.value === value)?.label ?? value;
}

export function BlockTypeFilter({ tenantId }: { tenantId: string }) {
  const [selectedBlockType, setSelectedBlockType] =
    useState<BlockTypeFilter>("playlist");

  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function loadBlocksByType() {
    setError("");
    setLoading(true);
    setSearched(true);

    try {
      const nodesRef = collection(db, "tenants", tenantId, "nodes");

      const qBlocks = query(
        nodesRef,
        where("archived", "==", false),
        where("type", "==", "block"),
        where("blockType", "==", selectedBlockType),
        orderBy("updatedAt", "desc"),
      );

      const snap = await getDocs(qBlocks);

      const rows = snap.docs.map((d) => {
        const x = { id: d.id, ...(d.data() as any) };

        return {
          id: x.id,
          title: x.title || x.id,
          blockType: x.blockType || selectedBlockType,
          updatedAt: x.updatedAt,
        };
      });

      setBlocks(rows);
    } catch (e: any) {
      setBlocks([]);
      setError(e?.message || "حدث خطأ أثناء جلب البلوكات.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="text-base font-bold">مكتبتي</div>
          <div className="text-sm text-muted-foreground">
            اختر نوع البلوك لعرض كل العناصر المنشأة منه.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between sm:w-64">
                <span>{blockTypeLabel(selectedBlockType)}</span>
                <span className="text-muted-foreground">▾</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="max-h-80 w-[--radix-dropdown-menu-trigger-width] overflow-auto">
              <DropdownMenuLabel>نوع البلوك</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuRadioGroup
                value={selectedBlockType}
                onValueChange={(value) => {
                  setSelectedBlockType(value as BlockTypeFilter);
                  setBlocks([]);
                  setSearched(false);
                  setError("");
                }}
              >
                {BLOCK_TYPE_OPTIONS.map((x) => (
                  <DropdownMenuRadioItem key={x.value} value={x.value}>
                    {x.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            disabled={loading}
            onClick={loadBlocksByType}
            className="w-full sm:w-auto"
          >
            {loading ? "جارٍ العرض..." : "عرض"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b) => (
          <Link
            key={b.id}
            href={`/block/${b.id}`}
            className="rounded-xl border bg-background p-3 transition hover:bg-muted active:scale-[0.99]"
          >
            <div className="line-clamp-1 font-bold">{b.title}</div>

            <div className="mt-1 text-xs text-muted-foreground">
              {blockTypeLabel(b.blockType)}
              {b.updatedAt
                ? ` • ${new Date(b.updatedAt).toLocaleString("ar")}`
                : ""}
            </div>
          </Link>
        ))}

        {searched && !loading && blocks.length === 0 && (
          <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            لا توجد بلوكات من نوع: {blockTypeLabel(selectedBlockType)}.
          </div>
        )}

        {!searched && (
          <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            اختر نوع البلوك ثم اضغط عرض.
          </div>
        )}
      </div>
    </div>
  );
}