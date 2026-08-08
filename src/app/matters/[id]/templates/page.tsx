import { extractTemplateFields, listAssembledDocuments, listDocumentTemplates } from "@/lib/documentTemplates";
import TemplateGeneratorPanel from "@/components/TemplateGeneratorPanel";

export default async function MatterTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [documents, templates] = await Promise.all([listAssembledDocuments(id), listDocumentTemplates()]);
  const templatesWithFields = templates.map((template) => ({
    ...template,
    fields: extractTemplateFields(template.content),
  }));

  return <TemplateGeneratorPanel matterId={id} initialDocuments={documents} templates={templatesWithFields} />;
}
