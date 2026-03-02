/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = {
  id: string;
  title: string;
  type: string;
  parentId: string | null;
};

function hrefFor(n: Crumb) {
  if (n.type === "stage") return `/stage/${n.id}`;
  if (n.type === "block") return `/block/${n.id}`;
  if (n.type === "card") return `/card/${n.id}`;

  if (n.type === "section") {
    if (n.id === "asp_sec_main") return `/aspects`;
    return `/ibadah`;
  }

  if (n.type === "space") {
    if (n.id === "space_aspects") return `/aspects`;
    if (n.id === "space_ibadah") return `/ibadah`;
    return `/`;
  }

  return `/explorer`;
}

export function Breadcrumbs({
  tenantId,
  nodeId,
}: {
  tenantId: string;
  nodeId: string;
}) {
  const [chain, setChain] = useState<Crumb[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const out: Crumb[] = [];
        let cur: string | null = nodeId;
        let guard = 0;

        while (cur && guard++ < 30) {
          const snap = await getDoc(doc(db, "tenants", tenantId, "nodes", cur));
          if (!snap.exists()) break;

          const d = snap.data() as any;
          out.push({
            id: cur,
            title: d.title ?? cur,
            type: d.type ?? "node",
            parentId: d.parentId ?? null,
          });

          cur = d.parentId ?? null;
        }

        if (!cancelled) setChain(out.reverse());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId, nodeId]);

  const parent = useMemo(
    () => (chain.length >= 2 ? chain[chain.length - 2] : null),
    [chain],
  );

  if (loading) return <div className="text-sm text-muted-foreground">...</div>;
  if (!chain.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {parent && (
        <Button variant="outline" size="sm" asChild>
          <Link href={hrefFor(parent)}>رجوع</Link>
        </Button>
      )}

      <Breadcrumb>
        <BreadcrumbList>
          {chain.map((c, idx) => {
            const last = idx === chain.length - 1;
            return (
              <Fragment key={c.id}>
                <BreadcrumbItem>
                  {!last ? (
                    <BreadcrumbLink asChild>
                      <Link href={hrefFor(c)}>{c.title}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{c.title}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {!last && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
