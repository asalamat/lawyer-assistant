import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Every AI-generated document in this app (digests, evidence matrices,
// drafts, chat answers, independent reviews) writes in the same markdown
// subset — headings, bold, bullet/numbered lists, paragraphs, and
// occasionally a GFM table (e.g. the redline feature's summary table) —
// remark-gfm is what makes `| col | col |` syntax parse as a real table at
// all, not just a styling choice. This renders that properly instead of
// showing literal "##"/"-"/"|" characters, styled to match the app's
// existing design tokens rather than pulling in the Tailwind typography
// plugin for a handful of element types.
export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed [&>*:first-child]:mt-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 font-display text-xl">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 font-display text-lg">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 font-display text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-outside list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-outside list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} className="text-accent underline decoration-accent/40">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent/40 pl-3 text-muted">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/[0.05] px-1 py-0.5 font-mono text-xs dark:bg-white/[0.08]">
              {children}
            </code>
          ),
          hr: () => <hr className="border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
          tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
          th: ({ children }) => <th className="px-2 py-1.5 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1.5 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
