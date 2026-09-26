export function PageHeading({ title, description }: { title: string; description?: string }) {
  return <div className="max-w-2xl space-y-2">
    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
    {description ? <p className="text-sm leading-6 text-muted-foreground md:text-base">{description}</p> : null}
  </div>;
}
