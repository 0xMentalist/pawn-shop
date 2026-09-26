export function PageHeading({ title, description }: { title: string; description?: string }) {
  return <div className="max-w-2xl space-y-3">
    <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
    {description ? <p className="text-base leading-7 text-muted-foreground">{description}</p> : null}
  </div>;
}
