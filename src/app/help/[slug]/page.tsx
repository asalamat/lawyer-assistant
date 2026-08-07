import { notFound } from "next/navigation";
import { findHelpItem } from "@/lib/helpContent";
import UploadProcessDiagram from "@/components/UploadProcessDiagram";

export default async function HelpItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = findHelpItem(slug);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="surface-card text-sm">
        <h2 className="font-display text-lg">{item.name}</h2>
        <p className="mt-2 text-muted">{item.detail}</p>
      </div>
      {slug === "document-upload" && <UploadProcessDiagram />}
    </div>
  );
}
