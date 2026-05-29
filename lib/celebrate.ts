export type CelebrationKind = "soft" | "normal" | "big";

function shouldCelebrate() {
  if (typeof window === "undefined") return false;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  return !reducedMotion;
}

export async function celebrateDone(kind: CelebrationKind = "soft") {
  if (!shouldCelebrate()) return;

  const { default: confetti } = await import("canvas-confetti");

  if (kind === "soft") {
    confetti({
      particleCount: 35,
      spread: 55,
      startVelocity: 28,
      origin: { y: 0.75 },
    });
    return;
  }

  if (kind === "normal") {
    confetti({
      particleCount: 70,
      spread: 70,
      startVelocity: 35,
      origin: { y: 0.72 },
    });
    return;
  }

  confetti({
    particleCount: 120,
    spread: 90,
    startVelocity: 42,
    origin: { y: 0.7 },
  });
}
