"use client";

import { useMemo, useState } from "react";
import { mockVisions } from "./mock-data";
import type { Vision } from "./types";
import VisionCard from "@/components/vision/VisionCard";

const SECTION_TITLES: Array<{
  key: Vision["section"] | "loop-execution";
  title: string;
}> = [
  { key: "daily", title: "مهام يومية" },
  { key: "loop-execution", title: "اللوب المتوالي" },
  { key: "mindset", title: "نمط تفكير وحياة" },
  { key: "identity", title: "هوية" },
  { key: "goals", title: "أهداف" },
];

export default function VisionPageClient() {
  const [visions, setVisions] = useState<Vision[]>(mockVisions);

  async function toggleDailyTask(visionId: string, taskId: string) {
    setVisions((prev) =>
      prev.map((vision) => {
        if (vision.id !== visionId) return vision;

        const current = vision.completedDailyTaskIdsToday ?? [];
        const exists = current.includes(taskId);

        return {
          ...vision,
          completedDailyTaskIdsToday: exists
            ? current.filter((id) => id !== taskId)
            : [...current, taskId],
        };
      }),
    );
  }

  async function advanceLoop(visionId: string) {
    setVisions((prev) =>
      prev.map((vision) => {
        if (vision.id !== visionId) return vision;
        if (vision.executionType !== "sequential_loop") return vision;

        const tasks = vision.loopTasks?.filter((t) => t.isActive) ?? [];
        if (!tasks.length) return vision;

        const currentIndex = vision.loopState?.currentTaskIndex ?? 0;
        const cycleCount = vision.loopState?.cycleCount ?? 0;
        const isLast = currentIndex >= tasks.length - 1;

        return {
          ...vision,
          loopState: {
            currentTaskIndex: isLast ? 0 : currentIndex + 1,
            cycleCount: isLast ? cycleCount + 1 : cycleCount,
            lastCycleCompletedAt: isLast
              ? new Date().toISOString()
              : (vision.loopState?.lastCycleCompletedAt ?? null),
          },
        };
      }),
    );
  }

  const grouped = useMemo(() => {
    return {
      daily: visions
        .filter((v) => v.section === "daily")
        .sort((a, b) => a.sortOrder - b.sortOrder),

      loopExecution: visions
        .filter((v) => v.executionType === "sequential_loop")
        .sort((a, b) => a.sortOrder - b.sortOrder),

      mindset: visions
        .filter((v) => v.section === "mindset")
        .sort((a, b) => a.sortOrder - b.sortOrder),

      identity: visions
        .filter((v) => v.section === "identity")
        .sort((a, b) => a.sortOrder - b.sortOrder),

      goals: visions
        .filter((v) => v.section === "goals")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }, [visions]);

  const todayDailyItems = useMemo(() => {
    return visions
      .filter((v) => v.executionType === "daily_tasks" && v.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [visions]);

  const todayLoopItems = useMemo(() => {
    return visions
      .filter((v) => v.executionType === "sequential_loop" && v.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [visions]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">تنفيذ الرؤية</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            هنا تتحول الرؤية إلى ممارسة عملية يومية أو متوالية.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">تنفيذ اليوم</h2>
          <p className="text-sm text-muted-foreground">
            عرض سريع للرؤى التي عندها تنفيذ عملي الآن.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-semibold">المهام اليومية</h3>

            {todayDailyItems.length ? (
              <div className="space-y-2">
                {todayDailyItems.map((vision) => {
                  const activeTasks =
                    vision.dailyTasks?.filter((t) => t.isActive) ?? [];
                  const total = activeTasks.length;
                  const done = activeTasks.filter((task) =>
                    (vision.completedDailyTaskIdsToday ?? []).includes(task.id),
                  ).length;

                  return (
                    <div key={vision.id} className="rounded-xl border p-3">
                      <p className="font-medium">{vision.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {done} من {total} مهام منجزة اليوم
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                لا توجد رؤى يومية مفعلة الآن.
              </p>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-semibold">اللوب المتوالي</h3>

            {todayLoopItems.length ? (
              <div className="space-y-2">
                {todayLoopItems.map((vision) => {
                  const tasks =
                    vision.loopTasks?.filter((t) => t.isActive) ?? [];
                  const currentIndex = vision.loopState?.currentTaskIndex ?? 0;
                  const currentTask = tasks[currentIndex];

                  return (
                    <div key={vision.id} className="rounded-xl border p-3">
                      <p className="font-medium">{vision.title}</p>
                      <p className="text-sm text-muted-foreground">
                        المهمة الحالية: {currentTask?.title ?? "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                لا توجد رؤى متوالية مفعلة الآن.
              </p>
            )}
          </div>
        </div>
      </section>

      {SECTION_TITLES.map((section) => {
        const items =
          section.key === "daily"
            ? grouped.daily
            : section.key === "loop-execution"
              ? grouped.loopExecution
              : section.key === "mindset"
                ? grouped.mindset
                : section.key === "identity"
                  ? grouped.identity
                  : grouped.goals;

        return (
          <section key={section.key} className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">{section.title}</h2>
            </div>

            {items.length ? (
              <div className="space-y-4">
                {items.map((vision) => (
                  <VisionCard
                    key={vision.id}
                    vision={vision}
                    onToggleDailyTask={toggleDailyTask}
                    onAdvanceLoop={advanceLoop}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                لا توجد عناصر في هذا القسم بعد.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
