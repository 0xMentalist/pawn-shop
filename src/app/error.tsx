"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-4 py-12"><Card><CardContent className="space-y-4 pt-6"><h1 className="text-xl font-semibold">Couldn’t load the dashboard</h1><p className="text-sm text-muted-foreground">Check the local database setup or try again.</p><Button type="button" onClick={reset}>Try again</Button></CardContent></Card></main>;
}
