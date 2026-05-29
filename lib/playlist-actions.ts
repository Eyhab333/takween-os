import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  increment,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { celebrateDone } from "./celebrate";

function extractYouTubeVideoId(url?: string) {
  const value = String(url || "").trim();
  if (!value) return null;

  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return u.pathname.replace(/^\/+/, "") || null;
    }

    if (host.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        return u.searchParams.get("v");
      }

      const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shorts?.[1]) return shorts[1];

      const embed = u.pathname.match(/^\/embed\/([^/?#]+)/);
      if (embed?.[1]) return embed[1];
    }

    return null;
  } catch {
    return null;
  }
}

export async function addPlaylistEpisode(
  tenantId: string,
  blockId: string,
  title: string,
  url: string,
) {
  const now = Date.now();
  const cleanTitle = title.trim() || "حلقة";
  const cleanUrl = url.trim();
  const videoId = extractYouTubeVideoId(cleanUrl);

  const colRef = collection(db, "tenants", tenantId, "nodes");
  const ref = doc(colRef);
  const id = ref.id;

  await setDoc(ref, {
    id,
    tenantId,
    parentId: blockId,
    type: "item",
    kind: "playlist_episode",
    title: cleanTitle,
    url: cleanUrl,
    videoId: videoId || null,
    sourceType: videoId ? "youtube" : "external",
    orderKey: `${now.toString(36)}_${id}`,
    archived: false,

    done: false,
    watchSeconds: 0,
    watchPercent: 0,
    completedAt: null,
    lastOpenedAt: null,

    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return id;
}

export async function toggleEpisodeDone(
  tenantId: string,
  episodeId: string,
  currentDone: boolean,
) {
  const now = Date.now();

  await updateDoc(doc(db, "tenants", tenantId, "nodes", episodeId), {
    done: !currentDone,
    watchPercent: !currentDone ? 100 : 0,
    completedAt: !currentDone ? now : null,
    updatedAt: now,
    version: increment(1),
  });

  if (!currentDone) {
    celebrateDone("soft");
  }
}

export async function markEpisodeOpened(
  tenantId: string,
  blockId: string,
  episodeId: string,
) {
  const now = Date.now();

  // نحدّث البلوك فقط لتقليل التضارب مع حفظ التقدم على الحلقة نفسها
  await updateDoc(doc(db, "tenants", tenantId, "nodes", blockId), {
    lastOpenedAt: now,
    lastOpenedEpisodeId: episodeId,
    updatedAt: now,
    version: increment(1),
  });
}

export async function savePlaylistEpisodeProgress(params: {
  tenantId: string;
  episodeId: string;
  watchSeconds: number;
  watchPercent: number;
}) {
  const now = Date.now();

  await updateDoc(
    doc(db, "tenants", params.tenantId, "nodes", params.episodeId),
    {
      watchSeconds: Math.max(0, Math.round(params.watchSeconds || 0)),
      watchPercent: Math.max(
        0,
        Math.min(100, Math.round(params.watchPercent || 0)),
      ),
      updatedAt: now,
      version: increment(1),
    },
  );
}
