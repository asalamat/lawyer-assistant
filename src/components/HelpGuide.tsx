"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HELP_SECTIONS } from "@/lib/helpContent";
import type { AppVersion } from "@/lib/systemInfo";
import FeatureRequestsPanel from "@/components/FeatureRequestsPanel";
import MarkdownContent from "@/components/MarkdownContent";
import UploadProcessDiagram from "@/components/UploadProcessDiagram";

// Renders extra, non-text content inline after a specific help item's
// paragraph — currently just the upload step-flow diagram. Keyed by slug
// rather than baked into helpContent.ts, since that file is plain data.
const EXTRAS: Record<string, React.ReactNode> = {
  "document-upload": <UploadProcessDiagram />,
};

export default function HelpGuide({ version, isAdmin }: { version: AppVersion; isAdmin: boolean }) {
  const [filter, setFilter] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const articleRefs = useRef<Map<string, HTMLElement>>(new Map());

  const groups = useMemo(
    () =>
      HELP_SECTIONS.map((section, groupIndex) => ({
        ...section,
        num: groupIndex + 1,
        items: section.items.map((item, itemIndex) => ({
          ...item,
          num: `${groupIndex + 1}.${itemIndex + 1}`,
        })),
      })),
    [],
  );

  const query = filter.trim().toLowerCase();
  const isMatch = (name: string, detail: string) =>
    !query || `${name} ${detail}`.toLowerCase().includes(query);

  const visibleCount = groups.reduce(
    (total, group) => total + group.items.filter((item) => isMatch(item.name, item.detail)).length,
    0,
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-10% 0px -75% 0px", threshold: 0 },
    );
    for (const el of articleRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="shrink-0 lg:sticky lg:top-6 lg:h-fit lg:w-64">
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter sections…"
            className="surface-input w-full text-sm"
          />
          <span className="min-h-[1em] font-mono text-xs text-muted">
            {query ? `${visibleCount} match${visibleCount === 1 ? "" : "es"}` : ""}
          </span>
        </div>

        <nav className="mt-4 flex flex-col gap-4">
          {groups.map((group) => {
            const visibleItems = group.items.filter((item) => isMatch(item.name, item.detail));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="mb-1 border-b border-border pb-1 font-mono text-[0.68rem] uppercase tracking-wide text-muted">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => (
                    <li key={item.slug}>
                      <a
                        href={`#${item.slug}`}
                        className={
                          activeSlug === item.slug
                            ? "flex items-baseline gap-2 rounded-lg bg-accent/10 px-2 py-1 text-sm font-medium text-accent"
                            : "flex items-baseline gap-2 rounded-lg px-2 py-1 text-sm text-foreground/80 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                        }
                      >
                        <span className="shrink-0 font-mono text-[0.72rem] text-accent/70">
                          §{item.num}
                        </span>
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <FeatureRequestsPanel isAdmin={isAdmin} />
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => isMatch(item.name, item.detail));
          if (visibleItems.length === 0) return null;
          return (
            <section key={group.title} className="mb-10">
              <div className="mb-4 flex items-baseline gap-3 border-b-2 border-foreground/80 pb-2">
                <span className="font-mono text-lg text-accent">§{group.num}</span>
                <h2 className="font-display text-xl">{group.title}</h2>
              </div>
              <div className="flex flex-col">
                {visibleItems.map((item) => (
                  <article
                    key={item.slug}
                    id={item.slug}
                    ref={(el) => {
                      if (el) articleRefs.current.set(item.slug, el);
                      else articleRefs.current.delete(item.slug);
                    }}
                    className="scroll-mt-6 border-b border-border py-4 last:border-b-0"
                  >
                    <div className="flex gap-3">
                      <span className="shrink-0 pt-0.5 font-mono text-sm text-accent/70">
                        §{item.num}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg">{item.name}</h3>
                        <div className="mt-1 max-w-3xl text-muted">
                          <MarkdownContent content={item.detail} />
                        </div>
                        {EXTRAS[item.slug]}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {visibleCount === 0 && (
          <p className="text-sm text-muted">No sections match &ldquo;{filter}&rdquo;.</p>
        )}

        <p className="mt-8 border-t border-border pt-4 text-xs text-muted">
          Version {version.appVersion}
          {version.gitCommit && ` (${version.gitCommit.shortSha})`}
        </p>
        <p className="mt-2 text-xs text-muted">
          Developer contact: Ali Salamat —{" "}
          <a href="mailto:ali.salamat@cortexhq.ai" className="text-accent hover:underline">
            ali.salamat@cortexhq.ai
          </a>{" "}
          · (416) 984-9845
        </p>
      </div>
    </div>
  );
}
