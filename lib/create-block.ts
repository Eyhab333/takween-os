// import { db } from "@/lib/firebase";
// import { doc, setDoc } from "firebase/firestore";

// function uid() {
//   return (globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
// }

// export async function createBlock(params: {
//   tenantId: string;
//   parentId: string;
//   title: string;
//   blockType: "checklist" | "counter" | "playlist" | "roadmap" | "project" | "notes" | "habit" | "routine";
// }) {
//   const now = Date.now();
//   const id = uid();

//   await setDoc(doc(db, "tenants", params.tenantId, "nodes", id), {
//     id,
//     tenantId: params.tenantId,
//     parentId: params.parentId,
//     type: "block",
//     title: params.title,
//     orderKey: now.toString(36),
//     archived: false,
//     createdAt: now,
//     updatedAt: now,
//     version: 1,
//     habitDailyTarget: 1,
//     habitUnitLabel: "مرة",
//     blockType: params.blockType,
//     config: {},
//     progressSnapshot: { current: 0, total: 0, percent: 0, status: "not_started" },

//     counterCurrent: 0,
//     counterTarget: null, // null = مفتوح (لا نهائي)
// routineSteps: [],
//   });

//   return id;
// }

// import { db } from "@/lib/firebase";
// import { doc, setDoc } from "firebase/firestore";

// function uid() {
//   return (
//     globalThis.crypto?.randomUUID?.() ??
//     `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
//   );
// }

// export async function createBlock(params: {
//   tenantId: string;
//   parentId: string;
//   title: string;
//   blockType:
//     | "checklist"
//     | "counter"
//     | "playlist"
//     | "roadmap"
//     | "project"
//     | "notes"
//     | "habit"
//     | "routine"
//     | "youtube_channel";
// }) {
//   const now = Date.now();
//   const id = uid();
//   const isYoutubeChannel = params.blockType === "youtube_channel";

//   await setDoc(doc(db, "tenants", params.tenantId, "nodes", id), {
//     id,
//     tenantId: params.tenantId,
//     parentId: params.parentId,
//     type: "block",
//     title: params.title,
//     orderKey: now.toString(36),
//     archived: false,
//     createdAt: now,
//     updatedAt: now,
//     version: 1,

//     blockType: params.blockType,
//     config: {},
//     progressSnapshot: { current: 0, total: 0, percent: 0, status: "not_started" },

//     habitDailyTarget: 1,
//     habitUnitLabel: "مرة",
//     counterCurrent: 0,
//     counterTarget: null,
//     routineSteps: [],

//     sourceType: null,
//     lastOpenedAt: null,
//     lastOpenedEpisodeId: null,

//     currentRun: isYoutubeChannel ? 1 : null,
//     runsCompleted: 0,
//     isRunComplete: false,

//     youtubeChannelId: null,
//     youtubeChannelUrl: null,
//     youtubeHandle: null,
//     youtubeThumbnailUrl: null,
//     youtubeImportedAt: null,
//     youtubeLastSyncAt: null,

//     totalPlaylists: 0,
//     totalEpisodes: 0,
//     doneEpisodes: 0,

//     resumePlaylistId: null,
//     resumeEpisodeId: null,
//   });

//   return id;
// }

// import { db } from "@/lib/firebase";
// import { doc, setDoc } from "firebase/firestore";

// function uid() {
//   return (
//     globalThis.crypto?.randomUUID?.() ??
//     `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
//   );
// }

// export type BlockType =
//   | "roadmap"
//   | "checklist"
//   | "counter"
//   | "playlist"
//   | "project"
//   | "notes"
//   | "habit"
//   | "routine"
//   | "youtube_channel"
//   | "pdf_reader"
//   | "link";

// export async function createBlock(params: {
//   tenantId: string;
//   parentId: string;
//   title: string;
//   blockType: BlockType;
// }) {
//   const now = Date.now();
//   const id = uid();

//   const hasRuns =
//     params.blockType === "youtube_channel" || params.blockType === "pdf_reader";

//   await setDoc(doc(db, "tenants", params.tenantId, "nodes", id), {
//     id,
//     tenantId: params.tenantId,
//     parentId: params.parentId,
//     type: "block",
//     title: params.title,
//     orderKey: now.toString(36),
//     archived: false,
//     createdAt: now,
//     updatedAt: now,
//     version: 1,

//     blockType: params.blockType,
//     config: {},
//     progressSnapshot: {
//       current: 0,
//       total: 0,
//       percent: 0,
//       status: "not_started",
//     },

//     habitDailyTarget: 1,
//     habitUnitLabel: "مرة",

//     counterCurrent: 0,
//     counterTarget: null,

//     linkUrl: "",
//     linkDoneCount: 0,
//     linkLastDoneAt: null,

//     routineSteps: [],

//     sourceType: null,
//     lastOpenedAt: null,
//     lastOpenedEpisodeId: null,

//     currentRun: hasRuns ? 1 : null,
//     runsCompleted: 0,
//     isRunComplete: false,

//     youtubeChannelId: null,
//     youtubeChannelUrl: null,
//     youtubeHandle: null,
//     youtubeThumbnailUrl: null,
//     youtubeImportedAt: null,
//     youtubeLastSyncAt: null,

//     totalPlaylists: 0,
//     totalEpisodes: 0,
//     doneEpisodes: 0,

//     resumePlaylistId: null,
//     resumeEpisodeId: null,

//     // PDF Reader
//     pdfFileName: "",
//     pdfStoragePath: "",
//     pdfDownloadUrl: "",
//     pdfTotalPages: 0,
//     currentPage: 1,
//     readingPercent: 0,
//     completedAt: null,
//     readyToCompleteRun: false,
//   });

//   return id;
// }



import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

export type BlockType =
  | "roadmap"
  | "checklist"
  | "counter"
  | "playlist"
  | "project"
  | "notes"
  | "habit"
  | "routine"
  | "youtube_channel"
  | "pdf_reader"
  | "link"
  | "tiny_experiments";

export async function createBlock(params: {
  tenantId: string;
  parentId: string;
  title: string;
  blockType: BlockType;
}) {
  const now = Date.now();
  const id = uid();

  const hasRuns =
    params.blockType === "youtube_channel" || params.blockType === "pdf_reader";

  await setDoc(doc(db, "tenants", params.tenantId, "nodes", id), {
    id,
    tenantId: params.tenantId,
    parentId: params.parentId,
    type: "block",
    title: params.title,
    orderKey: now.toString(36),
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,

    blockType: params.blockType,
    config: {},
    progressSnapshot: {
      current: 0,
      total: 0,
      percent: 0,
      status: "not_started",
    },

    habitDailyTarget: 1,
    habitUnitLabel: "مرة",

    counterCurrent: 0,
    counterTarget: null,

    linkUrl: "",
    linkDoneCount: 0,
    linkLastDoneAt: null,

    routineSteps: [],

    sourceType: null,
    lastOpenedAt: null,
    lastOpenedEpisodeId: null,

    currentRun: hasRuns ? 1 : null,
    runsCompleted: 0,
    isRunComplete: false,

    youtubeChannelId: null,
    youtubeChannelUrl: null,
    youtubeHandle: null,
    youtubeThumbnailUrl: null,
    youtubeImportedAt: null,
    youtubeLastSyncAt: null,

    totalPlaylists: 0,
    totalEpisodes: 0,
    doneEpisodes: 0,

    resumePlaylistId: null,
    resumeEpisodeId: null,

    // PDF Reader
    pdfFileName: "",
    pdfStoragePath: "",
    pdfDownloadUrl: "",
    pdfTotalPages: 0,
    currentPage: 1,
    readingPercent: 0,
    completedAt: null,
    readyToCompleteRun: false,
  });

  return id;
}