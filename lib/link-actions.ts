import { db } from "@/lib/firebase";
import { doc, increment, runTransaction, updateDoc } from "firebase/firestore";

export function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

export function validateExternalUrl(url: string) {
  const normalized = normalizeExternalUrl(url);

  if (!normalized) {
    return {
      ok: false,
      url: "",
      message: "اكتب الرابط أولًا.",
    };
  }

  try {
    const parsed = new URL(normalized);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        ok: false,
        url: normalized,
        message: "الرابط يجب أن يبدأ بـ http أو https.",
      };
    }

    if (!parsed.hostname.includes(".")) {
      return {
        ok: false,
        url: normalized,
        message: "الرابط غير مكتمل. مثال صحيح: example.com",
      };
    }

    return {
      ok: true,
      url: normalized,
      message: "",
    };
  } catch {
    return {
      ok: false,
      url: normalized,
      message: "صيغة الرابط غير صحيحة.",
    };
  }
}

export async function saveLinkBlock(params: {
  tenantId: string;
  blockId: string;
  title: string;
  description: string;
  url: string;
}) {
  const title = params.title.trim();
  const description = params.description.trim();
  const checked = validateExternalUrl(params.url);

  if (!title) {
    throw new Error("اكتب عنوان الرابط أولًا.");
  }

  if (!checked.ok) {
    throw new Error(checked.message);
  }

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.blockId),
    {
      linkTitle: title,
      linkDescription: description,
      linkUrl: checked.url,
      updatedAt: Date.now(),
      version: increment(1),
    },
  );
}

export async function linkDoneOnce(params: {
  tenantId: string;
  blockId: string;
}) {
  const now = Date.now();

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.blockId),
    {
      linkDoneCount: increment(1),
      linkLastDoneAt: now,
      updatedAt: now,
      version: increment(1),
    },
  );
}

export async function linkUndoOnce(params: {
  tenantId: string;
  blockId: string;
}) {
  const ref = doc(db, "tenants", params.tenantId, "nodes", params.blockId);
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const current =
      typeof data.linkDoneCount === "number" ? data.linkDoneCount : 0;

    tx.update(ref, {
      linkDoneCount: Math.max(0, current - 1),
      updatedAt: now,
      version: increment(1),
    });
  });
}
