import { listMatterNotes } from "@/lib/matters";
import NotesPanel from "@/components/NotesPanel";

export default async function MatterNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notes = await listMatterNotes(id);

  return <NotesPanel matterId={id} initialNotes={notes} />;
}
