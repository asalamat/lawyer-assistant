import Link from "next/link";
import { HELP_SECTIONS } from "@/lib/helpContent";

export default function HelpIndexPage() {
  return (
    <div className="flex flex-col gap-8">
      {HELP_SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="mb-3 font-display text-lg">{section.title}</h2>
          <div className="flex flex-col gap-3">
            {section.items.map((item) => (
              <Link
                key={item.slug}
                href={`/help/${item.slug}`}
                className="surface-card block text-sm transition-colors hover:border-accent/40"
              >
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 line-clamp-2 text-muted">{item.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
