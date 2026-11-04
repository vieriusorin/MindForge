import type { SourcesProps } from "../types";

export function Sources({ urls }: SourcesProps) {
  return (
    <ul className="mt-4 grid gap-1 text-xs text-muted-foreground">
      {urls.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-mono break-all text-primary underline-offset-4 hover:underline"
          >
            {url}
          </a>
        </li>
      ))}
    </ul>
  );
}
