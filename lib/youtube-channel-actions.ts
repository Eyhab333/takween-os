/* eslint-disable @typescript-eslint/no-explicit-any */
import { archiveSubtree } from "@/lib/archive-subtree";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

export type ImportedEpisode = {
  title: string;
  url: string;
  videoId: string;
  position: number;
  thumbnailUrl: string | null;
};

export type ImportedPlaylist = {
  playlistId: string;
  title: string;
  itemCount: number;
  thumbnailUrl: string | null;
  position: number;
  episodes: ImportedEpisode[];
};

export type ImportedChannel = {
  channelId: string;
  title: string;
  handle: string | null;
  url: string;
  thumbnailUrl: string | null;
  playlists: ImportedPlaylist[];
};

function chunks<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function padded(n: number, size = 6) {
  return String(n).padStart(size, "0");
}

async function archiveDirectChildren(tenantId: string, channelBlockId: string) {
  const nodesRef = collection(db, "tenants", tenantId, "nodes");
  const snap = await getDocs(
    query(
      nodesRef,
      where("parentId", "==", channelBlockId),
      where("archived", "==", false),
      limit(500)
    )
  );

  for (const d of snap.docs) {
    await archiveSubtree(tenantId, d.id);
  }
}

export async function saveImportedYouTubeChannel(params: {
  tenantId: string;
  channelBlockId: string;
  data: ImportedChannel;
}) {
  const now = Date.now();
  await archiveDirectChildren(params.tenantId, params.channelBlockId);

  const allEpisodes = params.data.playlists.reduce(
    (sum, p) => sum + p.episodes.length,
    0
  );

  for (const playlist of params.data.playlists) {
    const playlistRef = doc(collection(db, "tenants", params.tenantId, "nodes"));

    await writeBatch(db)
      .set(playlistRef, {
        id: playlistRef.id,
        tenantId: params.tenantId,
        parentId: params.channelBlockId,
        type: "block",
        title: playlist.title,
        orderKey: padded(playlist.position),
        archived: false,
        createdAt: now,
        updatedAt: now,
        version: 1,

        blockType: "playlist",
        sourceType: "youtube",
        youtubeChannelBlockId: params.channelBlockId,
        youtubeChannelId: params.data.channelId,
        youtubePlaylistId: playlist.playlistId,
        youtubeThumbnailUrl: playlist.thumbnailUrl,
        youtubeItemCount: playlist.episodes.length,
        playlistIndex: playlist.position,

        doneEpisodes: 0,
        totalEpisodes: playlist.episodes.length,
        lastOpenedAt: null,
        lastOpenedEpisodeId: null,
      })
      .commit();

    for (const part of chunks(playlist.episodes, 400)) {
      const batch = writeBatch(db);

      part.forEach((ep) => {
        const epRef = doc(collection(db, "tenants", params.tenantId, "nodes"));
        batch.set(epRef, {
          id: epRef.id,
          tenantId: params.tenantId,
          parentId: playlistRef.id,
          type: "item",
          kind: "youtube_episode",
          title: ep.title,
          url: ep.url,
          videoId: ep.videoId,
          orderKey: padded(ep.position),
          archived: false,
          createdAt: now,
          updatedAt: now,
          version: 1,

          sourceType: "youtube",
          youtubeChannelBlockId: params.channelBlockId,
          youtubeChannelId: params.data.channelId,
          youtubePlaylistId: playlist.playlistId,
          position: ep.position,
          thumbnailUrl: ep.thumbnailUrl,

          done: false,
          watchSeconds: 0,
          watchPercent: 0,
          completedAt: null,
          lastOpenedAt: null,
        });
      });

      await batch.commit();
    }
  }

  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.channelBlockId), {
    youtubeChannelId: params.data.channelId,
    youtubeChannelUrl: params.data.url,
    youtubeHandle: params.data.handle,
    youtubeThumbnailUrl: params.data.thumbnailUrl,
    youtubeImportedAt: now,
    youtubeLastSyncAt: now,

    totalPlaylists: params.data.playlists.length,
    totalEpisodes: allEpisodes,
    doneEpisodes: 0,

    currentRun: 1,
    runsCompleted: 0,
    isRunComplete: false,

    resumePlaylistId: null,
    resumeEpisodeId: null,
    updatedAt: now,
    version: 2,
  });
}

export async function markYoutubeEpisodeOpened(params: {
  tenantId: string;
  channelBlockId: string;
  playlistBlockId: string;
  episodeId: string;
}) {
  const now = Date.now();
  const batch = writeBatch(db);

  batch.update(doc(db, "tenants", params.tenantId, "nodes", params.episodeId), {
    lastOpenedAt: now,
    updatedAt: now,
    version: now,
  });

  batch.update(doc(db, "tenants", params.tenantId, "nodes", params.playlistBlockId), {
    lastOpenedAt: now,
    lastOpenedEpisodeId: params.episodeId,
    updatedAt: now,
    version: now,
  });

  batch.update(doc(db, "tenants", params.tenantId, "nodes", params.channelBlockId), {
    resumePlaylistId: params.playlistBlockId,
    resumeEpisodeId: params.episodeId,
    updatedAt: now,
    version: now,
  });

  await batch.commit();
}

export async function saveYoutubeWatchProgress(params: {
  tenantId: string;
  episodeId: string;
  watchSeconds: number;
  watchPercent: number;
}) {
  const episodeRef = doc(
    db,
    "tenants",
    params.tenantId,
    "nodes",
    params.episodeId,
  );

  await updateDoc(episodeRef, {
    watchSeconds: Math.max(0, Math.round(params.watchSeconds || 0)),
    watchPercent: Math.max(
      0,
      Math.min(100, Math.round(params.watchPercent || 0)),
    ),
    updatedAt: Date.now(),
  });
}

export async function completeYoutubeEpisode(params: {
  tenantId: string;
  channelBlockId: string;
  playlistBlockId: string;
  episodeId: string;
  durationSeconds: number;
}) {
  const episodeRef = doc(db, "tenants", params.tenantId, "nodes", params.episodeId);
  const playlistRef = doc(db, "tenants", params.tenantId, "nodes", params.playlistBlockId);
  const channelRef = doc(db, "tenants", params.tenantId, "nodes", params.channelBlockId);

  await runTransaction(db, async (tx) => {
    const [episodeSnap, playlistSnap, channelSnap] = await Promise.all([
      
      tx.get(episodeRef),
      tx.get(playlistRef),
      tx.get(channelRef),
    ]);

    if (!episodeSnap.exists() || !playlistSnap.exists() || !channelSnap.exists()) {
      throw new Error("بعض مستندات التقدم غير موجودة.");
    }

    const episode = episodeSnap.data() as any;
    const playlist = playlistSnap.data() as any;
    const channel = channelSnap.data() as any;
    const now = Date.now();

    if (episode.done === true) {
      return;
    }

    const nextPlaylistDone = (playlist.doneEpisodes || 0) + 1;
    const nextChannelDone = (channel.doneEpisodes || 0) + 1;
    const totalEpisodes = channel.totalEpisodes || 0;
    const completedWholeRun = totalEpisodes > 0 && nextChannelDone >= totalEpisodes;

    tx.update(episodeRef, {
      done: true,
      watchSeconds: Math.max(
        episode.watchSeconds || 0,
        Math.round(params.durationSeconds || 0),
      ),
      watchPercent: 100,
      completedAt: now,
      updatedAt: now,
    });

    tx.update(playlistRef, {
      doneEpisodes: nextPlaylistDone,
      lastOpenedEpisodeId: params.episodeId,
      updatedAt: now,
    });

    tx.update(channelRef, {
      doneEpisodes: nextChannelDone,
      resumePlaylistId: params.playlistBlockId,
      resumeEpisodeId: params.episodeId,
      isRunComplete: completedWholeRun,
      runsCompleted:
        completedWholeRun && !channel.isRunComplete
          ? (channel.runsCompleted || 0) + 1
          : channel.runsCompleted || 0,
      updatedAt: now,
    });
  });
}

export async function startNewYouTubeChannelRun(params: {
  tenantId: string;
  channelBlockId: string;
}) {
  const now = Date.now();
  const nodesRef = collection(db, "tenants", params.tenantId, "nodes");

  const episodesSnap = await getDocs(
    query(
      nodesRef,
      where("youtubeChannelBlockId", "==", params.channelBlockId),
      where("kind", "==", "youtube_episode"),
      where("archived", "==", false)
    )
  );

  for (const part of chunks(episodesSnap.docs, 400)) {
    const batch = writeBatch(db);
    part.forEach((d) => {
      batch.update(d.ref, {
        done: false,
        watchSeconds: 0,
        watchPercent: 0,
        completedAt: null,
        lastOpenedAt: null,
        updatedAt: now,
      });
    });
    await batch.commit();
  }

  const playlistsSnap = await getDocs(
    query(
      nodesRef,
      where("parentId", "==", params.channelBlockId),
      where("type", "==", "block"),
      where("archived", "==", false),
      orderBy("orderKey")
    )
  );

  for (const part of chunks(playlistsSnap.docs, 400)) {
    const batch = writeBatch(db);
    part.forEach((d) => {
      batch.update(d.ref, {
        doneEpisodes: 0,
        lastOpenedAt: null,
        lastOpenedEpisodeId: null,
        updatedAt: now,
      });
    });
    await batch.commit();
  }

  const channelRef = doc(db, "tenants", params.tenantId, "nodes", params.channelBlockId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(channelRef);
    if (!snap.exists()) throw new Error("القناة غير موجودة.");
    const data = snap.data() as any;

    tx.update(channelRef, {
      currentRun: (data.currentRun || 1) + 1,
      doneEpisodes: 0,
      isRunComplete: false,
      resumePlaylistId: null,
      resumeEpisodeId: null,
      updatedAt: now,
    });
  });
}

export async function findFirstIncompleteEpisode(params: {
  tenantId: string;
  playlistBlockId: string;
}) {
  const nodesRef = collection(db, "tenants", params.tenantId, "nodes");

  const undone = await getDocs(
    query(
      nodesRef,
      where("parentId", "==", params.playlistBlockId),
      where("type", "==", "item"),
      where("archived", "==", false),
      where("done", "==", false),
      orderBy("orderKey"),
      limit(1)
    )
  );

  if (!undone.empty) return undone.docs[0].id;

  const firstAny = await getDocs(
    query(
      nodesRef,
      where("parentId", "==", params.playlistBlockId),
      where("type", "==", "item"),
      where("archived", "==", false),
      orderBy("orderKey"),
      limit(1)
    )
  );

  return firstAny.empty ? null : firstAny.docs[0].id;
}
