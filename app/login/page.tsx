/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // لو هو أصلاً مسجل دخول، رجّعه فورًا
  useEffect(() => {
    if (auth.currentUser) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loginGoogle() {
    setErr(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "تعذر تسجيل الدخول بـ Google");
    } finally {
      setLoading(false);
    }
  }

  async function loginEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-right">تسجيل الدخول</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button className="w-full" onClick={loginGoogle} disabled={loading}>
            دخول Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">
                أو بالبريد
              </span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={loginEmail}>
            <div className="space-y-2">
              <Label className="block text-right" htmlFor="email">
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="block text-right" htmlFor="password">
                كلمة المرور
              </Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {err ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                {err}
              </div>
            ) : null}

            <Button className="w-full" disabled={loading}>
              {loading ? "جاري الدخول..." : "دخول"}
            </Button>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Link className="underline" href="/reset-password">
                نسيت كلمة المرور؟
              </Link>
              <Link className="underline" href="/signup">
                حساب جديد
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
