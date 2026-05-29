import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch } from "firebase/firestore";

type NodeType =
  | "space"
  | "section"
  | "card"
  | "folder"
  | "block"
  | "item"
  | "stage";

export async function ensureIbadahTemplate(tenantId: string) {
  const markerId = "ib_sec_inner";
  const markerRef = doc(db, "tenants", tenantId, "nodes", markerId);
  const markerSnap = await getDoc(markerRef);
  if (markerSnap.exists()) return;

  const now = Date.now();
  const batch = writeBatch(db);
  const nref = (id: string) => doc(db, "tenants", tenantId, "nodes", id);

  const base = (
    id: string,
    parentId: string | null,
    type: NodeType,
    title: string,
    orderKey: string,
  ) => ({
    id,
    tenantId,
    parentId,
    type,
    title,
    orderKey,
    archived: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  // Sections (تحت space_ibadah)
  batch.set(
    nref("ib_sec_inner"),
    base("ib_sec_inner", "space_ibadah", "section", "العبادات الباطنة", "a"),
  );
  batch.set(
    nref("ib_sec_mind"),
    base("ib_sec_mind", "space_ibadah", "section", "العبادات العقلية", "b"),
  );
  batch.set(
    nref("ib_sec_outer"),
    base("ib_sec_outer", "space_ibadah", "section", "العبادات البدنية", "c"),
  );
  batch.set(
    nref("ib_sec_plan"),
    base("ib_sec_plan", "space_ibadah", "section", "خطة الإصلاح", "d"),
  );

  // Cards: الباطنة
  batch.set(
    nref("ib_card_inner_allah"),
    base("ib_card_inner_allah", "ib_sec_inner", "card", "العلاقة مع الله", "a"),
  );
  batch.set(
    nref("ib_card_inner_rasul"),
    base("ib_card_inner_rasul", "ib_sec_inner", "card", "الرسول", "b"),
  );
  batch.set(
    nref("ib_card_inner_nafs"),
    base("ib_card_inner_nafs", "ib_sec_inner", "card", "النفس", "c"),
  );
  batch.set(
    nref("ib_card_inner_akhlaq"),
    base("ib_card_inner_akhlaq", "ib_sec_inner", "card", "الأخلاق", "d"),
  );

  // Cards: العقلية
  batch.set(
    nref("ib_card_mind_fiqh"),
    base("ib_card_mind_fiqh", "ib_sec_mind", "card", "العلم الشرعي", "a"),
  );
  batch.set(
    nref("ib_card_mind_tadabbur"),
    base("ib_card_mind_tadabbur", "ib_sec_mind", "card", "التدبر", "b"),
  );
  batch.set(
    nref("ib_card_mind_reading"),
    base("ib_card_mind_reading", "ib_sec_mind", "card", "القراءة", "c"),
  );

  // Cards: الظاهرة
  batch.set(
    nref("ib_card_outer_salah"),
    base("ib_card_outer_salah", "ib_sec_outer", "card", "الصلاة", "b"),
  );
  batch.set(
    nref("ib_card_outer_quran"),
    base(
      "ib_card_outer_quran",
      "ib_sec_outer",
      "card",
      "قيام الليل بالقرآن",
      "a",
    ),
  );

  batch.set(
    nref("ib_card_outer_sawm"),
    base("ib_card_outer_sawm", "ib_sec_outer", "card", "الصيام", "c"),
  );
  batch.set(
    nref("ib_card_outer_sadaqa"),
    base("ib_card_outer_sadaqa", "ib_sec_outer", "card", "الصدقة", "d"),
  );

  // Cards: الإصلاح
  batch.set(
    nref("ib_card_plan_roadmaps"),
    base("ib_card_plan_roadmaps", "ib_sec_plan", "card", "خرائط الطريق", "a"),
  );
  batch.set(
    nref("ib_card_plan_projects"),
    base("ib_card_plan_projects", "ib_sec_plan", "card", "المشاريع", "b"),
  );
  batch.set(
    nref("ib_card_plan_followup"),
    base("ib_card_plan_followup", "ib_sec_plan", "card", "متابعة", "c"),
  );

  await batch.commit();
}
