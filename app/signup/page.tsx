/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (auth.currentUser) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signupEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password.length < 6) {
      setErr("كلمة المرور يجب ألا تقل عن 6 أحرف.");
      return;
    }
    if (password !== password2) {
      setErr("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "تعذر إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  }

  async function signupGoogle() {
    setErr(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "تعذر إنشاء الحساب عبر Google");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-right">إنشاء حساب</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button className="w-full" onClick={signupGoogle} disabled={loading}>
            إنشاء حساب عبر Google
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

          <form className="space-y-4" onSubmit={signupEmail}>
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
                autoComplete="new-password"
                required
              />
              <div className="text-xs text-muted-foreground">
                6 أحرف على الأقل.
              </div>
            </div>

            <div className="space-y-2">
              <Label className="block text-right" htmlFor="password2">
                تأكيد كلمة المرور
              </Label>
              <Input
                id="password2"
                type="password"
                dir="ltr"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {err ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                {err}
              </div>
            ) : null}

            <Button className="w-full" disabled={loading}>
              {loading ? "جاري الإنشاء..." : "إنشاء حساب"}
            </Button>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Link
                className="underline"
                href={`/login?next=${encodeURIComponent(next)}`}
              >
                لدي حساب بالفعل
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
