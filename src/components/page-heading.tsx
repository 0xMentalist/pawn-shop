export function PageHeading({ title, description }: { title: string; description?: string }) {
  return <div className="max-w-2xl space-y-2">
    <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
    {description ? <p className="text-sm leading-6 text-muted-foreground md:text-base">{description}</p> : null}
  </div>;
}
