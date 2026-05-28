import { db } from "@/lib/firebase";
import { doc, getDoc, increment, writeBatch } from "firebase/firestore";

type NodeType =
  | "space"
  | "section"
  | "card"
  | "folder"
  | "block"
  | "item"
  | "stage";

export async function ensureAspectsTemplate(tenantId: string) {
  const now = Date.now();
  const batch = writeBatch(db);
  const nref = (id: string) => doc(db, "tenants", tenantId, "nodes", id);

  const cards = [
    {
      id: "asp_card_professional",
      title: "المهني",
      orderKey: "a",
      description:
        "كل ما يتعلق بعملك ومهاراتك ومشاريعك وتطورك المهني ومكانتك العملية.",
    },
    {
      id: "asp_card_financial",
      title: "المالي",
      orderKey: "b",
      description:
        "كل ما يتعلق بالدخل والمصروفات والادخار والاستثمار وسداد الديون وتحسين الوضع المالي.",
    },
    {
      id: "asp_card_health",
      title: "الصحي",
      orderKey: "c",
      description:
        "كل ما يتعلق بصحتك الجسدية: النوم، التغذية، الرياضة، العلاج، الفحوصات والطاقة اليومية.",
    },
    {
      id: "asp_card_human",
      title: "البشري",
      orderKey: "d",
      description:
        "كل ما يتعلق ببنائك كإنسان: الأخلاق، النضج، تحمل المسؤولية، الرحمة، والاتزان في التعامل.",
    },
    {
      id: "asp_card_psych",
      title: "النفسي",
      orderKey: "e",
      description:
        "كل ما يتعلق براحتك النفسية، مشاعرك، الضغوط، القلق، التعافي، والسلام الداخلي.",
    },
    {
      id: "asp_card_mental",
      title: "العقلي",
      orderKey: "f",
      description:
        "كل ما يتعلق بالتعلم والتفكير والقراءة والتركيز وتطوير الفهم والقدرات الذهنية.",
    },
    {
      id: "asp_card_personal",
      title: "الشخصي",
      orderKey: "g",
      description:
        "كل ما يتعلق بعاداتك الخاصة، ترتيب حياتك، مظهرك، وقتك، وانضباطك الشخصي.",
    },
    {
      id: "asp_card_family",
      title: "الأسري",
      orderKey: "h",
      description:
        "كل ما يتعلق ببيتك وأسرتك القريبة: الزوجة، الأبناء، التربية، الوقت الأسري، والاستقرار المنزلي.",
    },
    {
      id: "asp_card_relatives",
      title: "العائلي",
      orderKey: "i",
      description:
        "كل ما يتعلق بالأهل والأقارب وصلة الرحم والواجبات العائلية والعلاقات الممتدة.",
    },
    {
      id: "asp_card_social",
      title: "الاجتماعي",
      orderKey: "j",
      description:
        "كل ما يتعلق بالأصدقاء والمعارف والمجتمع والصداقات النافعة وحسن التواصل مع الناس.",
    },
  ];

  const markerId = "asp_card_professional";
  const markerRef = nref(markerId);
  const markerSnap = await getDoc(markerRef);

  // لو القالب موجود قديمًا بدون أوصاف: حدّث الأوصاف مرة واحدة
  if (markerSnap.exists()) {
    const markerData = markerSnap.data();
    const hasDescription =
      typeof markerData.description === "string" &&
      markerData.description.trim().length > 0;

    if (hasDescription) return;

    cards.forEach((card) => {
      batch.set(
        nref(card.id),
        {
          description: card.description,
          updatedAt: now,
          version: increment(1),
        },
        { merge: true },
      );
    });

    await batch.commit();
    return;
  }

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

  // Space + Section
  batch.set(
    nref("space_aspects"),
    base("space_aspects", null, "space", "بقية الجوانب", "b"),
  );

  batch.set(
    nref("asp_sec_main"),
    base("asp_sec_main", "space_aspects", "section", "الجوانب", "a"),
  );

  // Cards
  cards.forEach((card) => {
    batch.set(nref(card.id), {
      ...base(card.id, "asp_sec_main", "card", card.title, card.orderKey),
      description: card.description,
    });
  });

  await batch.commit();
}
