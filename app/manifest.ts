import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مزرعة الآخرة",
    short_name: "مزرعة الآخرة",
    description:
      "منصة شخصية لإدارة الحياة، العبادات، الجوانب، العادات، والروتينات.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "natural",
    dir: "rtl",
    lang: "ar",
    background_color: "#020617",
    theme_color: "#020617",
    categories: ["productivity", "education", "lifestyle"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
