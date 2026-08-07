import Link from "next/link";
import { searchAll, type SearchFilters } from "@/lib/search";
import { listSavedSearches } from "@/lib/savedSearches";
import { getCurrentUser } from "@/lib/auth";
import { filterAccessibleMatterIds } from "@/lib/matterAccess";
import SearchHighlight from "@/components/SearchHighlight";
import SavedSearchesPanel from "@/components/SavedSearchesPanel";

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
  searchParams: Promise<{
    q?: string;
    party?: string;
    matterType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const { q, party, matterType, status, dateFrom, dateTo } = await searchParams;
  const query = (q ?? "").trim();
  const filters: SearchFilters = {
    partyName: party?.trim() || undefined,
    matterType: matterType?.trim() || undefined,
    status: status === "open" || status === "closed" || status === "archived" ? status : undefined,
    dateFrom: dateFrom?.trim() || undefined,
    dateTo: dateTo?.trim() || undefined,
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const rawResults = query.length > 0 ? await searchAll(query, filters) : null;
  const user = await getCurrentUser();
  const savedSearches = user ? await listSavedSearches(user.id) : [];

  // Ethical-wall filtering: a walled matter's title/documents/chat/etc.
  // shouldn't surface here for someone who isn't on its team, even though
  // the underlying SQL search has no notion of matter access.
  const results =
    rawResults && user
      ? (() => {
          const accessibleIds = filterAccessibleMatterIds(user.id, user.role, [
            ...rawResults.matters.map((m) => m.id),
            ...rawResults.documents.map((d) => d.matterId),
            ...rawResults.documentContent.map((d) => d.matterId),
            ...rawResults.chatMessages.map((c) => c.matterId),
            ...rawResults.digests.map((d) => d.matterId),
            ...rawResults.drafts.map((d) => d.matterId),
            ...rawResults.evidenceMatrices.map((e) => e.matterId),
          ]);
          return {
            ...rawResults,
            matters: rawResults.matters.filter((m) => accessibleIds.has(m.id)),
            documents: rawResults.documents.filter((d) => accessibleIds.has(d.matterId)),
            documentContent: rawResults.documentContent.filter((d) => accessibleIds.has(d.matterId)),
            chatMessages: rawResults.chatMessages.filter((c) => accessibleIds.has(c.matterId)),
            digests: rawResults.digests.filter((d) => accessibleIds.has(d.matterId)),
            drafts: rawResults.drafts.filter((d) => accessibleIds.has(d.matterId)),
            evidenceMatrices: rawResults.evidenceMatrices.filter((e) => accessibleIds.has(e.matterId)),
          };
        })()
      : rawResults;
  const terms = results?.terms ?? [];

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
        <p className="mt-2 text-xs text-muted">
          All terms must match by default. Use quotes for an exact phrase (
          <code>&quot;show cause hearing&quot;</code>) and a leading minus to exclude a term (
          <code>-adjourned</code>).
        </p>

        <details className="mt-3" open={hasFilters}>
          <summary className="cursor-pointer text-sm text-muted">
            Filters{hasFilters ? " (active)" : ""}
          </summary>
          <form className="surface-card mt-2 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="q" value={query} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Party name</span>
              <input name="party" defaultValue={party ?? ""} className="surface-input" placeholder="e.g. Neda Assadian" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Matter type</span>
              <input name="matterType" defaultValue={matterType ?? ""} className="surface-input" placeholder="e.g. Criminal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Status</span>
              <select name="status" defaultValue={status ?? ""} className="surface-input">
                <option value="">Any</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Matter created after</span>
              <input type="date" name="dateFrom" defaultValue={dateFrom ?? ""} className="surface-input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Matter created before</span>
              <input type="date" name="dateTo" defaultValue={dateTo ?? ""} className="surface-input" />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-secondary">
                Apply filters
              </button>
              {hasFilters && (
                <a href={`/search?q=${encodeURIComponent(query)}`} className="text-sm text-muted hover:text-foreground">
                  Clear
                </a>
              )}
            </div>
          </form>
        </details>
        <div className="mt-3">
          <SavedSearchesPanel initialSearches={savedSearches} currentQuery={query} />
        </div>
      </div>

      {!results ? (
        <p className="text-sm text-muted">Enter a search term above.</p>
      ) : Object.entries(results).every(([key, group]) => key === "terms" || group.length === 0) ? (
        <p className="text-sm text-muted">No results for &quot;{query}&quot;.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <ResultGroup title="Matters" count={results.matters.length}>
            {results.matters.map((matter) => (
              <li key={matter.id} className="surface-row text-sm">
                <Link href={`/matters/${matter.id}`} className="hover:text-accent">
                  <SearchHighlight text={matter.title} terms={terms} />
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
                  <SearchHighlight text={doc.fileName} terms={terms} />
                </Link>
                <p className="text-xs text-muted">in {doc.matterTitle}</p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Document content" count={results.documentContent.length}>
            {results.documentContent.map((match) => (
              <li key={match.id} className="surface-row text-sm">
                <Link href={`/matters/${match.matterId}`} className="hover:text-accent">
                  {match.fileName}
                  {match.pageNumber ? `, p. ${match.pageNumber}` : ""}
                </Link>
                <p className="text-xs text-muted">in {match.matterTitle}</p>
                <p className="mt-1 text-xs text-muted">
                  <SearchHighlight text={match.snippet} terms={terms} />
                </p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Chat messages" count={results.chatMessages.length}>
            {results.chatMessages.map((message) => (
              <li key={message.id} className="surface-row text-sm">
                <Link href={`/matters/${message.matterId}/chat`} className="hover:text-accent">
                  {message.matterTitle}
                </Link>
                <p className="text-xs text-muted">
                  <SearchHighlight text={message.snippet} terms={terms} />
                </p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Matter digests" count={results.digests.length}>
            {results.digests.map((digest) => (
              <li key={digest.id} className="surface-row text-sm">
                <Link href={`/matters/${digest.matterId}`} className="hover:text-accent">
                  {digest.matterTitle}
                </Link>
                <p className="text-xs text-muted">
                  <SearchHighlight text={digest.snippet} terms={terms} />
                </p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Drafts" count={results.drafts.length}>
            {results.drafts.map((draft) => (
              <li key={draft.id} className="surface-row text-sm">
                <Link href={`/matters/${draft.matterId}`} className="hover:text-accent">
                  {draft.matterTitle} — {draft.draftType}
                </Link>
                <p className="text-xs text-muted">
                  <SearchHighlight text={draft.snippet} terms={terms} />
                </p>
              </li>
            ))}
          </ResultGroup>

          <ResultGroup title="Evidence matrices" count={results.evidenceMatrices.length}>
            {results.evidenceMatrices.map((matrix) => (
              <li key={matrix.id} className="surface-row text-sm">
                <Link href={`/matters/${matrix.matterId}`} className="hover:text-accent">
                  {matrix.matterTitle}
                </Link>
                <p className="text-xs text-muted">
                  <SearchHighlight text={matrix.snippet} terms={terms} />
                </p>
              </li>
            ))}
          </ResultGroup>
        </div>
      )}
    </main>
  );
}
