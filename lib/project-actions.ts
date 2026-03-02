import { db } from "@/lib/firebase";
import { doc, increment, updateDoc } from "firebase/firestore";

export type ProjectLink = { label: string; url: string };

export async function saveProjectBlock(params: {
  tenantId: string;
  blockId: string;
  status: string;
  description: string;
  scope: string;
  links: ProjectLink[];
}) {
  await updateDoc(doc(db, "tenants", params.tenantId, "nodes", params.blockId), {
    projectStatus: params.status,
    projectDescription: params.description,
    projectScope: params.scope,
    projectLinks: params.links,
    updatedAt: Date.now(),
    version: increment(1),
  });
}