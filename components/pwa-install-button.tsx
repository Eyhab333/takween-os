"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isAppAlreadyInstalled() {
  if (typeof window === "undefined") return false;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;

  return isStandalone || Boolean(isIosStandalone);
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isAppAlreadyInstalled()) {
      setVisible(false);
      return;
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();

      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setVisible(false);
      setDismissed(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;

    setInstalling(true);

    try {
      await installPrompt.prompt();

      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setVisible(false);
        setInstallPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  }

  if (!visible || dismissed || !installPrompt) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md lg:bottom-5 lg:left-5 lg:right-auto">
      <div className="rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Download className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">ثبّت التطبيق</div>
            <div className="text-xs text-muted-foreground">
              افتح المنصة كتطبيق مستقل من الشاشة الرئيسية.
            </div>
          </div>

          <Button size="sm" onClick={handleInstall} disabled={installing}>
            {installing ? "..." : "تثبيت"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="إخفاء زر التثبيت"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
