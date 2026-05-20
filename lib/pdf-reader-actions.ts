import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

function safePage(page: number, totalPages: number) {
  const p = Number.isFinite(page) ? Math.floor(page) : 1;
  const t = Number.isFinite(totalPages) ? Math.floor(totalPages) : 0;

  if (t > 0) return Math.min(Math.max(p, 1), t);
  return Math.max(p, 1);
}

function calcPercent(page: number, totalPages: number) {
  if (!totalPages || totalPages <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((page / totalPages) * 100)));
}

export async function savePdfReaderFile(params: {
  tenantId: string;
  blockId: string;
  pdfFileName: string;
  pdfStoragePath: string;
  pdfDownloadUrl: string;
  pdfTotalPages: number;
}) {
  const now = Date.now();
  const totalPages = Math.max(0, Math.floor(params.pdfTotalPages || 0));

  await runTransaction(db, async (tx) => {
    const blockRef = doc(
      db,
      "tenants",
      params.tenantId,
      "nodes",
      params.blockId,
    );

    tx.update(blockRef, {
      pdfFileName: params.pdfFileName,
      pdfStoragePath: params.pdfStoragePath,
      pdfDownloadUrl: params.pdfDownloadUrl,
      pdfTotalPages: totalPages,

      currentPage: 1,
      readingPercent: 0,

      runsCompleted: 0,
      currentRun: 1,
      isRunComplete: false,
      readyToCompleteRun: false,
      completedAt: null,

      progressSnapshot: {
        current: 0,
        total: totalPages,
        percent: 0,
        status: "not_started",
      },

      updatedAt: now,
      version: 1,
    });
  });
}

export async function savePdfReadingProgress(params: {
  tenantId: string;
  blockId: string;
  currentPage: number;
  pdfTotalPages: number;
}) {
  const now = Date.now();
  const totalPages = Math.max(0, Math.floor(params.pdfTotalPages || 0));
  const currentPage = safePage(params.currentPage, totalPages);
  const readingPercent = calcPercent(currentPage, totalPages);

  await runTransaction(db, async (tx) => {
    const blockRef = doc(
      db,
      "tenants",
      params.tenantId,
      "nodes",
      params.blockId,
    );

    tx.update(blockRef, {
      currentPage,
      pdfTotalPages: totalPages,
      readingPercent,

      progressSnapshot: {
        current: currentPage,
        total: totalPages,
        percent: readingPercent,
        status: readingPercent > 0 ? "in_progress" : "not_started",
      },

      updatedAt: now,
      version: 1,
    });
  });
}

export async function completePdfRunManually(params: {
  tenantId: string;
  blockId: string;
}) {
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    const blockRef = doc(
      db,
      "tenants",
      params.tenantId,
      "nodes",
      params.blockId,
    );

    const snap = await tx.get(blockRef);
    if (!snap.exists()) {
      throw new Error("PDF reader block not found.");
    }

    const data = snap.data();

    const currentRun =
      typeof data.currentRun === "number" && data.currentRun > 0
        ? data.currentRun
        : 1;

    const runsCompleted =
      typeof data.runsCompleted === "number" && data.runsCompleted >= 0
        ? data.runsCompleted
        : 0;

    const totalPages =
      typeof data.pdfTotalPages === "number" && data.pdfTotalPages > 0
        ? data.pdfTotalPages
        : 0;

    tx.update(blockRef, {
      runsCompleted: runsCompleted + 1,
      currentRun: currentRun + 1,

      currentPage: 1,
      readingPercent: 0,

      isRunComplete: false,
      readyToCompleteRun: false,
      completedAt: now,

      progressSnapshot: {
        current: 0,
        total: totalPages,
        percent: 0,
        status: "not_started",
      },

      updatedAt: now,
      version: 1,
    });
  });
}