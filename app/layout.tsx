// import "./globals.css";
// import { Tajawal } from "next/font/google";
// import { ThemeProvider } from "@/components/theme-provider";
// import { AppShell } from "@/components/app-shell";

// const tajawal = Tajawal({
//   subsets: ["arabic"],
//   weight: ["200", "300", "400", "500", "700", "800", "900"],
// });

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="ar" dir="rtl" suppressHydrationWarning>
//       <body className={tajawal.className}>
//         <ThemeProvider>
//           <AppShell>{children}</AppShell>
//         </ThemeProvider>
//       </body>
//     </html>
//   );
// }

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Tajawal } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "مزرعة الآخرة",
    template: "%s | مزرعة الآخرة",
  },
  description:
    "منصة شخصية لإدارة الحياة، العبادات، الجوانب، العادات، والروتينات.",
  applicationName: "مزرعة الآخرة",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "مزرعة الآخرة",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={tajawal.className}>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
