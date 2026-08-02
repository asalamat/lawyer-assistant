import { notFound } from "next/navigation";
import { findHelpItem } from "@/lib/helpContent";

export default async function HelpItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = findHelpItem(slug);
  if (!item) notFound();

  return (
    <div className="surface-card text-sm">
      <h2 className="font-display text-lg">{item.name}</h2>
      <p className="mt-2 text-muted">{item.detail}</p>
    </div>
  );
}
