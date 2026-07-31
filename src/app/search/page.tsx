import Link from "next/link";
import { searchAll } from "@/lib/search";

export const dynamic = "force-dynamic";

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <h2 className="mb-2 font-display text-lg">
        {title} <span className="text-sm font-normal text-muted">({count})</span>
      </h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length > 0 ? await searchAll(query) : null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl italic">Search</h1>
        <form className="mt-4 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Search matters, documents, chat, digests, drafts, evidence matrices…"
            className="surface-input flex-1"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </div>

      {!results ? (
        <p className="text-sm text-muted">Enter a search term above.</p>
      ) : Object.values(results).every((group) => group.length === 0) ? (
        <p className="text-sm text-muted">No results for &quot;{query}&quot;.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <ResultGroup title="Matters" count={results.matters.length}>
            {results.matters.map((matter) => (
              <li key={matter.id} className="surface-row text-sm">
                <Link href={`/matters/${matter.id}`} className="hover:text-accent">
                  {matter.title}
                </Link>
                <p className="text-xs text-muted">
                  {matter.clientName} &middot; {matter.matterType} &middot; {matter.status}
                </p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Documents" count={results.documents.length}>
            {results.documents.map((doc) => (
              <li key={doc.id} className="surface-row text-sm">
                <Link href={`/matters/${doc.matterId}`} className="hover:text-accent">
                  {doc.fileName}
                </Link>
                <p className="text-xs text-muted">in {doc.matterTitle}</p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Chat messages" count={results.chatMessages.length}>
            {results.chatMessages.map((message) => (
              <li key={message.id} className="surface-row text-sm">
                <Link href={`/matters/${message.matterId}/chat`} className="hover:text-accent">
                  {message.matterTitle}
                </Link>
                <p className="text-xs text-muted">{message.snippet}</p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Matter digests" count={results.digests.length}>
            {results.digests.map((digest) => (
              <li key={digest.id} className="surface-row text-sm">
                <Link href={`/matters/${digest.matterId}`} className="hover:text-accent">
                  {digest.matterTitle}
                </Link>
                <p className="text-xs text-muted">{digest.snippet}</p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Drafts" count={results.drafts.length}>
            {results.drafts.map((draft) => (
              <li key={draft.id} className="surface-row text-sm">
                <Link href={`/matters/${draft.matterId}`} className="hover:text-accent">
                  {draft.matterTitle} — {draft.draftType}
                </Link>
                <p className="text-xs text-muted">{draft.snippet}</p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Evidence matrices" count={results.evidenceMatrices.length}>
            {results.evidenceMatrices.map((matrix) => (
              <li key={matrix.id} className="surface-row text-sm">
                <Link href={`/matters/${matrix.matterId}`} className="hover:text-accent">
                  {matrix.matterTitle}
                </Link>
                <p className="text-xs text-muted">{matrix.snippet}</p>
              </li>
            ))}
          </ResultGroup>
        </div>
      )}
    </main>
  );
}
