function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Wraps any of `terms` found in `text` in <mark>, case-insensitively.
// Splits into plain-text pieces rather than using dangerouslySetInnerHTML,
// so there's no HTML-injection risk from a search term or document content.
export default function SearchHighlight({ text, terms }: { text: string; terms: string[] }) {
  const cleanTerms = terms.filter(Boolean);
  if (cleanTerms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${cleanTerms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        cleanTerms.some((term) => term.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-accent/25 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
