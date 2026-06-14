// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import dynamic from "next/dynamic";
// import { useEffect, useState } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { auth, db } from "@/lib/firebase";
// import { doc, getDoc } from "firebase/firestore";

// import { Breadcrumbs } from "@/components/breadcrumbs";
// import { Button } from "@/components/ui/button";

// import { ChecklistBlock } from "@/components/blocks/checklist-block";
// import { PlaylistBlock } from "@/components/blocks/playlist-block";
// import { ProjectBlock } from "@/components/blocks/project-block";
// import { RoadmapBlock } from "@/components/blocks/roadmap-block";
// import { NotesBlock } from "@/components/blocks/notes-block";
// import { CounterBlock } from "@/components/blocks/counter-block";
// import { HabitBlock } from "@/components/blocks/habit-block";
// import { RoutineBlock } from "@/components/blocks/routine-block";
// import { YoutubeChannelBlock } from "@/components/blocks/youtube-channel-block";
// import { YoutubePlaylistBlock } from "@/components/blocks/youtube-playlist-block";

// import { renameNodeTitle } from "@/lib/node-actions";
// import { archiveSubtree } from "@/lib/archive-subtree";
// import { LinkBlock } from "@/components/blocks/link-block";

// const PdfReaderBlock = dynamic(
//   () =>
//     import("@/components/blocks/pdf-reader-block").then(
//       (mod) => mod.PdfReaderBlock,
//     ),
//   {
//     ssr: false,
//     loading: () => (
//       <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
//         جارٍ تحميل قارئ PDF...
//       </div>
//     ),
//   },
// );

// export default function BlockPage() {
//   const { id } = useParams<{ id: string }>();
//   const router = useRouter();

//   const [loading, setLoading] = useState(true);
//   const [title, setTitle] = useState("");
//   const [blockType, setBlockType] = useState<string>("");
//   const [sourceType, setSourceType] = useState<string>("");
//   const [blockData, setBlockData] = useState<any | null>(null);

//   const [editing, setEditing] = useState(false);
//   const [draftTitle, setDraftTitle] = useState("");

//   const [parentId, setParentId] = useState<string | null>(null);

//   useEffect(() => {
//     return auth.onAuthStateChanged(async (u) => {
//       if (!u) {
//         setLoading(false);
//         return;
//       }

//       setLoading(true);
//       const tenantId = u.uid;

//       const ref = doc(db, "tenants", tenantId, "nodes", id);
//       const snap = await getDoc(ref);

//       if (!snap.exists()) {
//         setTitle("Block غير موجود");
//         setBlockType("");
//         setSourceType("");
//         setBlockData(null);
//         setLoading(false);
//         return;
//       }

//       const data = snap.data() as any;

//       setBlockData(data);
//       setParentId(data.parentId ?? null);
//       setTitle(data.title ?? "");
//       setDraftTitle((prev) => (prev ? prev : (data.title ?? "")));
//       setBlockType(data.blockType ?? "");
//       setSourceType(data.sourceType ?? "");
//       setLoading(false);
//     });
//   }, [id]);

//   if (!auth.currentUser) {
//     return <div className="text-muted-foreground">سجّل الدخول.</div>;
//   }

//   if (loading) {
//     return <div className="text-muted-foreground">جارٍ التحميل...</div>;
//   }

//   const tenantId = auth.currentUser.uid;

//   return (
//     <div className="space-y-4">
//       <div>
//         <Breadcrumbs tenantId={tenantId} nodeId={id} />

//         <div className="flex items-center justify-between gap-2">
//           {!editing ? (
//             <h1 className="text-2xl font-bold">{title}</h1>
//           ) : (
//             <input
//               className="h-10 w-full rounded-md border bg-background px-3 text-sm"
//               value={draftTitle}
//               onChange={(e) => setDraftTitle(e.target.value)}
//             />
//           )}

//           <div className="flex items-center gap-2">
//             <Button
//               variant="outline"
//               onClick={async () => {
//                 if (!auth.currentUser) return;

//                 const ok = window.confirm(
//                   "حذف هذا البلوك؟ (سيتم أرشفة كل ما تحته)",
//                 );
//                 if (!ok) return;

//                 await archiveSubtree(auth.currentUser.uid, String(id));

//                 if (parentId) {
//                   router.push(`/card/${parentId}`);
//                 } else {
//                   router.push("/explorer");
//                 }
//               }}
//             >
//               حذف البلوك
//             </Button>

//             {!editing ? (
//               <button
//                 className="rounded-md border px-3 py-2 text-sm"
//                 onClick={() => setEditing(true)}
//               >
//                 تعديل الاسم
//               </button>
//             ) : (
//               <>
//                 <button
//                   className="rounded-md border px-3 py-2 text-sm"
//                   onClick={async () => {
//                     await renameNodeTitle({
//                       tenantId,
//                       nodeId: id,
//                       title: draftTitle,
//                     });

//                     setTitle(draftTitle.trim() || title);
//                     setEditing(false);
//                   }}
//                 >
//                   حفظ
//                 </button>

//                 <button
//                   className="rounded-md border px-3 py-2 text-sm"
//                   onClick={() => {
//                     setDraftTitle(title);
//                     setEditing(false);
//                   }}
//                 >
//                   إلغاء
//                 </button>
//               </>
//             )}
//           </div>
//         </div>

//         <p className="text-muted-foreground">
//           {blockType || "block"}
//           {sourceType ? ` • ${sourceType}` : ""}
//         </p>
//       </div>

//       {blockType === "youtube_channel" ? (
//         <YoutubeChannelBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "playlist" && sourceType === "youtube" ? (
//         <YoutubePlaylistBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "pdf_reader" ? (
//         <PdfReaderBlock tenantId={tenantId} blockId={id} block={blockData} />
//       ) : blockType === "link" ? (
//         <LinkBlock tenantId={tenantId} blockId={id} block={blockData} />
//       ) : blockType === "roadmap" ? (
//         <RoadmapBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "playlist" ? (
//         <PlaylistBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "checklist" ? (
//         <ChecklistBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "project" ? (
//         <ProjectBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "counter" ? (
//         <CounterBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "notes" ? (
//         <NotesBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "habit" ? (
//         <HabitBlock tenantId={tenantId} blockId={id} />
//       ) : blockType === "routine" ? (
//         <RoutineBlock tenantId={tenantId} blockId={id} />
//       ) : (
//         <div className="text-muted-foreground">
//           Renderer غير جاهز لهذا النوع بعد.
//         </div>
//       )}
//     </div>
//   );
// }


/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";

import { ChecklistBlock } from "@/components/blocks/checklist-block";
import { PlaylistBlock } from "@/components/blocks/playlist-block";
import { ProjectBlock } from "@/components/blocks/project-block";
import { RoadmapBlock } from "@/components/blocks/roadmap-block";
import { NotesBlock } from "@/components/blocks/notes-block";
import { CounterBlock } from "@/components/blocks/counter-block";
import { HabitBlock } from "@/components/blocks/habit-block";
import { RoutineBlock } from "@/components/blocks/routine-block";
import { YoutubeChannelBlock } from "@/components/blocks/youtube-channel-block";
import { YoutubePlaylistBlock } from "@/components/blocks/youtube-playlist-block";
import { TinyExperimentsBlock } from "@/components/blocks/tiny-experiments-block";

import { renameNodeTitle } from "@/lib/node-actions";
import { archiveSubtree } from "@/lib/archive-subtree";
import { LinkBlock } from "@/components/blocks/link-block";

const PdfReaderBlock = dynamic(
  () =>
    import("@/components/blocks/pdf-reader-block").then(
      (mod) => mod.PdfReaderBlock,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        جارٍ تحميل قارئ PDF...
      </div>
    ),
  },
);

export default function BlockPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [blockType, setBlockType] = useState<string>("");
  const [sourceType, setSourceType] = useState<string>("");
  const [blockData, setBlockData] = useState<any | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const tenantId = u.uid;

      const ref = doc(db, "tenants", tenantId, "nodes", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setTitle("Block غير موجود");
        setBlockType("");
        setSourceType("");
        setBlockData(null);
        setLoading(false);
        return;
      }

      const data = snap.data() as any;

      setBlockData(data);
      setParentId(data.parentId ?? null);
      setTitle(data.title ?? "");
      setDraftTitle((prev) => (prev ? prev : (data.title ?? "")));
      setBlockType(data.blockType ?? "");
      setSourceType(data.sourceType ?? "");
      setLoading(false);
    });
  }, [id]);

  if (!auth.currentUser) {
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  }

  if (loading) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;
  }

  const tenantId = auth.currentUser.uid;

  return (
    <div className="space-y-4">
      <div>
        <Breadcrumbs tenantId={tenantId} nodeId={id} />

        <div className="flex items-center justify-between gap-2">
          {!editing ? (
            <h1 className="text-2xl font-bold">{title}</h1>
          ) : (
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!auth.currentUser) return;

                const ok = window.confirm(
                  "حذف هذا البلوك؟ (سيتم أرشفة كل ما تحته)",
                );
                if (!ok) return;

                await archiveSubtree(auth.currentUser.uid, String(id));

                if (parentId) {
                  router.push(`/card/${parentId}`);
                } else {
                  router.push("/explorer");
                }
              }}
            >
              حذف البلوك
            </Button>

            {!editing ? (
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setEditing(true)}
              >
                تعديل الاسم
              </button>
            ) : (
              <>
                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={async () => {
                    await renameNodeTitle({
                      tenantId,
                      nodeId: id,
                      title: draftTitle,
                    });

                    setTitle(draftTitle.trim() || title);
                    setEditing(false);
                  }}
                >
                  حفظ
                </button>

                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => {
                    setDraftTitle(title);
                    setEditing(false);
                  }}
                >
                  إلغاء
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-muted-foreground">
          {blockType || "block"}
          {sourceType ? ` • ${sourceType}` : ""}
        </p>
      </div>

      {blockType === "youtube_channel" ? (
        <YoutubeChannelBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "playlist" && sourceType === "youtube" ? (
        <YoutubePlaylistBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "pdf_reader" ? (
        <PdfReaderBlock tenantId={tenantId} blockId={id} block={blockData} />
      ) : blockType === "link" ? (
        <LinkBlock tenantId={tenantId} blockId={id} block={blockData} />
      ) : blockType === "tiny_experiments" ? (
        <TinyExperimentsBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "roadmap" ? (
        <RoadmapBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "playlist" ? (
        <PlaylistBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "checklist" ? (
        <ChecklistBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "project" ? (
        <ProjectBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "counter" ? (
        <CounterBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "notes" ? (
        <NotesBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "habit" ? (
        <HabitBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "routine" ? (
        <RoutineBlock tenantId={tenantId} blockId={id} />
      ) : (
        <div className="text-muted-foreground">
          Renderer غير جاهز لهذا النوع بعد.
        </div>
      )}
    </div>
  );
}
