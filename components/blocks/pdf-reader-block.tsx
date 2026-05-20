/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "@/lib/firebase";
import {
  completePdfRunManually,
  savePdfReaderFile,
  savePdfReadingProgress,
} from "@/lib/pdf-reader-actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PdfReaderBlockProps = {
  tenantId: string;
  blockId: string;
  block: any;
};

type UiError = {
  title: string;
  message: string;
  details?: string;
};

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampPage(page: number, totalPages: number) {
  const p = Math.floor(page || 1);
  const t = Math.floor(totalPages || 0);

  if (t > 0) return Math.min(Math.max(p, 1), t);
  return Math.max(p, 1);
}

function calcPercent(page: number, totalPages: number) {
  if (!totalPages || totalPages <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((page / totalPages) * 100)));
}

function safeFileName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);

  return cleaned || "file.pdf";
}

function errorDetails(err: unknown) {
  if (!err) return "";

  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }

  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

function firebaseCode(err: unknown) {
  if (typeof err === "object" && err && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }

  return "";
}

function buildUploadError(err: unknown): UiError {
  const code = firebaseCode(err);
  const details = errorDetails(err);
  const text = `${code}\n${details}`.toLowerCase();

  if (
    text.includes("cors") ||
    text.includes("preflight") ||
    text.includes("xhr") ||
    text.includes("err_failed") ||
    text.includes("storage/unknown")
  ) {
    return {
      title: "تعذر رفع ملف PDF",
      message:
        "غالبًا المشكلة من إعدادات CORS في Firebase Storage أو من اتصال الشبكة. افتح Console للتأكد، وستحتاج غالبًا لضبط CORS للـ Storage bucket.",
      details,
    };
  }

  if (code === "storage/unauthorized") {
    return {
      title: "لا توجد صلاحية لرفع الملف",
      message:
        "قواعد Firebase Storage لا تسمح للمستخدم الحالي برفع الملف في هذا المسار.",
      details,
    };
  }

  if (code === "storage/canceled") {
    return {
      title: "تم إلغاء الرفع",
      message: "تم إلغاء عملية رفع الملف قبل اكتمالها.",
      details,
    };
  }

  if (code === "storage/retry-limit-exceeded") {
    return {
      title: "فشل الرفع بسبب الاتصال",
      message:
        "تمت محاولات الرفع أكثر من مرة ولم تكتمل. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.",
      details,
    };
  }

  return {
    title: "حدث خطأ أثناء رفع ملف PDF",
    message:
      "لم يكتمل رفع الملف. تحقق من الاتصال، ومن إعدادات Firebase Storage، ثم أعد المحاولة.",
    details,
  };
}

function buildPdfLoadError(err: unknown): UiError {
  const details = errorDetails(err);
  const text = details.toLowerCase();

  if (
    text.includes("cors") ||
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("err_failed")
  ) {
    return {
      title: "تعذر تحميل ملف PDF",
      message:
        "غالبًا الملف موجود لكن المتصفح لا يستطيع تحميله بسبب CORS أو بسبب انقطاع الاتصال.",
      details,
    };
  }

  if (
    text.includes("invalid pdf") ||
    text.includes("missing pdf") ||
    text.includes("pdf header")
  ) {
    return {
      title: "ملف PDF غير صالح",
      message: "يبدو أن الملف المرفوع ليس PDF صالحًا أو حدث تلف أثناء الرفع.",
      details,
    };
  }

  return {
    title: "تعذر عرض ملف PDF",
    message:
      "تم العثور على رابط الملف، لكن القارئ لم يستطع عرضه. جرّب إعادة رفع الملف أو تحقق من رابط التحميل.",
    details,
  };
}

function ErrorBox({
  error,
  onDismiss,
}: {
  error: UiError;
  onDismiss: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-bold">{error.title}</div>
          <div>{error.message}</div>
        </div>

        <Button variant="outline" size="sm" onClick={onDismiss}>
          إخفاء
        </Button>
      </div>

      {error.details ? (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "إخفاء التفاصيل التقنية" : "عرض التفاصيل التقنية"}
          </Button>

          {showDetails ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-white p-3 text-xs text-red-900">
              {error.details}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PdfReaderBlock({
  tenantId,
  blockId,
  block,
}: PdfReaderBlockProps) {
  const initialTotalPages = asNumber(block?.pdfTotalPages, 0);
  const initialCurrentPage = clampPage(
    asNumber(block?.currentPage, 1),
    initialTotalPages,
  );

  const [pdfDownloadUrl, setPdfDownloadUrl] = useState(
    typeof block?.pdfDownloadUrl === "string" ? block.pdfDownloadUrl : "",
  );
  const [pdfFileName, setPdfFileName] = useState(
    typeof block?.pdfFileName === "string" ? block.pdfFileName : "",
  );

  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [page, setPage] = useState(initialCurrentPage);
  const [pageInput, setPageInput] = useState(String(initialCurrentPage));

  const [scale, setScale] = useState(1);

  const [isReaderFullscreen, setIsReaderFullscreen] = useState(false);

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [viewerWidth, setViewerWidth] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completingRun, setCompletingRun] = useState(false);

  const [uiError, setUiError] = useState<UiError | null>(null);

  const [runsCompleted, setRunsCompleted] = useState(
    asNumber(block?.runsCompleted, 0),
  );
  const [currentRun, setCurrentRun] = useState(asNumber(block?.currentRun, 1));

  useEffect(() => {
    const nextUrl =
      typeof block?.pdfDownloadUrl === "string" ? block.pdfDownloadUrl : "";
    const nextName =
      typeof block?.pdfFileName === "string" ? block.pdfFileName : "";
    const nextTotal = asNumber(block?.pdfTotalPages, 0);
    const nextPage = clampPage(asNumber(block?.currentPage, 1), nextTotal);

    setPdfDownloadUrl(nextUrl);
    setPdfFileName(nextName);
    setTotalPages(nextTotal);
    setPage(nextPage);
    setPageInput(String(nextPage));
    setRunsCompleted(asNumber(block?.runsCompleted, 0));
    setCurrentRun(asNumber(block?.currentRun, 1));
  }, [block]);

  const readingPercent = useMemo(
    () => calcPercent(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    function updateWidth() {
      const el = viewerRef.current;
      if (!el) return;

      setViewerWidth(Math.floor(el.clientWidth));
    }

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const target = viewerRef.current;
    if (!target) return;

    const observer = new ResizeObserver(updateWidth);
    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  const pdfPageWidth = useMemo(() => {
    if (!viewerWidth) return undefined;

    const horizontalPadding = 24;
    const available = Math.max(280, viewerWidth - horizontalPadding);

    return Math.floor(available * scale);
  }, [viewerWidth, scale]);

  useEffect(() => {
    if (!isReaderFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isReaderFullscreen]);

  const hasPdf = Boolean(pdfDownloadUrl);

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setUiError({
        title: "نوع الملف غير صحيح",
        message: "اختر ملف PDF فقط.",
      });
      return;
    }

    setUiError(null);
    setUploading(true);

    try {
      const cleanName = safeFileName(file.name);
      const storagePath = `tenants/${tenantId}/pdf-readers/${blockId}/${Date.now()}_${cleanName}`;

      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, file, {
        contentType: "application/pdf",
      });

      const downloadUrl = await getDownloadURL(fileRef);

      await savePdfReaderFile({
        tenantId,
        blockId,
        pdfFileName: file.name,
        pdfStoragePath: storagePath,
        pdfDownloadUrl: downloadUrl,
        pdfTotalPages: 0,
      });

      setPdfDownloadUrl(downloadUrl);
      setPdfFileName(file.name);
      setTotalPages(0);
      setPage(1);
      setPageInput("1");
      setRunsCompleted(0);
      setCurrentRun(1);
      setUiError(null);
    } catch (err) {
      console.error("PDF upload failed:", err);
      setUiError(buildUploadError(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDocumentLoadSuccess(pdf: { numPages: number }) {
    const nextTotal = pdf.numPages || 0;
    const nextPage = clampPage(page, nextTotal);

    setTotalPages(nextTotal);
    setPage(nextPage);
    setPageInput(String(nextPage));

    if (nextTotal > 0 && nextTotal !== totalPages) {
      try {
        await savePdfReadingProgress({
          tenantId,
          blockId,
          currentPage: nextPage,
          pdfTotalPages: nextTotal,
        });
      } catch (err) {
        console.error("PDF total pages save failed:", err);
        setUiError({
          title: "تم عرض PDF لكن تعذر حفظ عدد الصفحات",
          message:
            "القارئ يعمل، لكن لم نستطع تحديث بيانات التقدم في Firestore.",
          details: errorDetails(err),
        });
      }
    }
  }

  function handleDocumentLoadError(err: unknown) {
    console.error("PDF load failed:", err);
    setUiError(buildPdfLoadError(err));
  }

  function goToPage(nextPage: number) {
    const fixed = clampPage(nextPage, totalPages);
    setPage(fixed);
    setPageInput(String(fixed));
  }

  async function saveProgress() {
    if (!hasPdf) return;

    setUiError(null);
    setSaving(true);

    try {
      await savePdfReadingProgress({
        tenantId,
        blockId,
        currentPage: page,
        pdfTotalPages: totalPages,
      });
    } catch (err) {
      console.error("PDF progress save failed:", err);
      setUiError({
        title: "تعذر حفظ موضع القراءة",
        message:
          "لم نستطع حفظ الصفحة الحالية. تحقق من الاتصال ومن صلاحيات Firestore.",
        details: errorDetails(err),
      });
    } finally {
      setSaving(false);
    }
  }

  function resumeReading() {
    const savedTotal = asNumber(block?.pdfTotalPages, totalPages);
    const savedPage = clampPage(asNumber(block?.currentPage, 1), savedTotal);

    setPage(savedPage);
    setPageInput(String(savedPage));
  }

  async function completeRun() {
    const ok = window.confirm(
      "هل تريد إنهاء هذه الختمة وبدء ختمة جديدة؟\nسيتم زيادة عدد الختمات المكتملة والرجوع إلى الصفحة الأولى.",
    );

    if (!ok) return;

    setUiError(null);
    setCompletingRun(true);

    try {
      await completePdfRunManually({
        tenantId,
        blockId,
      });

      setRunsCompleted((v) => v + 1);
      setCurrentRun((v) => v + 1);
      setPage(1);
      setPageInput("1");
    } catch (err) {
      console.error("PDF run complete failed:", err);
      setUiError({
        title: "تعذر إنهاء الختمة",
        message:
          "لم نستطع تحديث بيانات الختمة. تحقق من الاتصال ومن صلاحيات Firestore.",
        details: errorDetails(err),
      });
    } finally {
      setCompletingRun(false);
    }
  }

  const rootClassName = isReaderFullscreen
    ? "fixed inset-0 z-[100] flex flex-col gap-2 overflow-hidden bg-background p-2"
    : "space-y-4 rounded-xl border bg-card p-4";

  const toolbarClassName = isReaderFullscreen
    ? "flex shrink-0 flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm"
    : "flex flex-wrap items-center gap-2";

  const zoomToolbarClassName = isReaderFullscreen
    ? "flex shrink-0 flex-wrap items-center gap-2 rounded-xl border bg-card p-2"
    : "flex flex-wrap items-center gap-2";

  const viewerClassName = isReaderFullscreen
    ? "min-h-0 flex-1 overflow-auto rounded-xl border bg-background p-2"
    : "w-full overflow-x-auto overflow-y-hidden rounded-xl border bg-background p-2 sm:p-3";

  const viewerInnerClassName = isReaderFullscreen
    ? "flex min-h-full w-full justify-center"
    : "flex min-h-96 w-full justify-center";

  return (
    <div className={rootClassName}>
      <div
        className={
          isReaderFullscreen
            ? "hidden"
            : "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
        }
      >
        <div className="space-y-1">
          <div className="text-lg font-bold">قراءة PDF</div>

          <div className="text-sm text-muted-foreground">
            الختمة الحالية: {currentRun} • الختمات المكتملة: {runsCompleted}
          </div>

          {pdfFileName && (
            <div className="text-sm text-muted-foreground">
              الملف: {pdfFileName}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:min-w-64">
          <Input
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />

          <div className="text-xs text-muted-foreground">
            {uploading
              ? "جارٍ رفع الملف..."
              : hasPdf
                ? "اختيار ملف جديد سيستبدل ملف هذا البلوك."
                : "ارفع ملف PDF للبدء."}
          </div>
        </div>
      </div>

      {uiError ? (
        <ErrorBox error={uiError} onDismiss={() => setUiError(null)} />
      ) : null}

      {!hasPdf ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          لا يوجد ملف PDF داخل هذا البلوك بعد.
        </div>
      ) : (
        <>
          <div
            className={
              isReaderFullscreen ? "hidden" : "grid gap-2 sm:grid-cols-4"
            }
          >
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">
                الصفحة الحالية
              </div>
              <div className="text-xl font-bold">
                {page}
                {totalPages ? ` / ${totalPages}` : ""}
              </div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">نسبة القراءة</div>
              <div className="text-xl font-bold">{readingPercent}%</div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">
                الختمة الحالية
              </div>
              <div className="text-xl font-bold">{currentRun}</div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">المكتملة</div>
              <div className="text-xl font-bold">{runsCompleted}</div>
            </div>
          </div>

          <div className={toolbarClassName}>
            <Button
              variant="outline"
              onClick={() => setIsReaderFullscreen((v) => !v)}
            >
              {isReaderFullscreen ? "خروج" : "ملء الشاشة"}
            </Button>

            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              السابق
            </Button>

            <Button
              variant="outline"
              disabled={totalPages > 0 ? page >= totalPages : false}
              onClick={() => goToPage(page + 1)}
            >
              التالي
            </Button>

            <div className="flex items-center gap-2">
              <Input
                value={pageInput}
                inputMode="numeric"
                className="w-24"
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    goToPage(Number(pageInput));
                  }
                }}
              />

              <Button
                variant="outline"
                onClick={() => goToPage(Number(pageInput))}
              >
                اذهب
              </Button>
            </div>

            <Button disabled={saving} onClick={saveProgress}>
              {saving ? "جارٍ الحفظ..." : "حفظ موضع القراءة"}
            </Button>

            <Button variant="outline" onClick={resumeReading}>
              تابع القراءة
            </Button>

            <Button
              variant="destructive"
              disabled={completingRun}
              onClick={completeRun}
            >
              {completingRun ? "جارٍ الإنهاء..." : "إنهاء الختمة"}
            </Button>
          </div>

          <div className={zoomToolbarClassName}>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setScale((v) => Math.max(0.8, +(v - 0.1).toFixed(1)))
              }
            >
              تصغير
            </Button>

            <div className="text-sm text-muted-foreground">
              التكبير: {Math.round(scale * 100)}%
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setScale((v) => Math.min(1.8, +(v + 0.1).toFixed(1)))
              }
            >
              تكبير
            </Button>
          </div>

          <div ref={viewerRef} dir="ltr" className={viewerClassName}>
            <div className={viewerInnerClassName}>
              <div className="max-w-none">
                <Document
                  file={pdfDownloadUrl}
                  loading={
                    <div className="p-6 text-sm text-muted-foreground">
                      جارٍ تحميل PDF...
                    </div>
                  }
                  error={
                    <div className="p-6 text-sm text-red-500">
                      تعذر عرض ملف PDF. راجع رسالة الخطأ بالأعلى.
                    </div>
                  }
                  onLoadSuccess={handleDocumentLoadSuccess}
                  onLoadError={handleDocumentLoadError}
                  onSourceError={handleDocumentLoadError}
                >
                  <Page
                    pageNumber={page}
                    width={pdfPageWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
