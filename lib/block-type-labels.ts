export const BLOCK_TYPE_LABELS: Record<string, string> = {
  roadmap: "خارطة طريق (هدف)",
  playlist: "قائمة تشغيل يوتيوب",
  youtube_channel: "قناة يوتيوب",
  pdf_reader: "كتاب PDF",
  checklist: "قائمة مهام",
  // counter: "عداد",
  project: "مشروع",
  notes: "ملاحظات",
  habit: "عادة",
  routine: "روتين",
  link: "رابط موقع خارجي",
};

export function getBlockTypeLabel(blockType?: string | null) {
  if (!blockType) return "بلوك";
  return BLOCK_TYPE_LABELS[blockType] ?? blockType;
}
