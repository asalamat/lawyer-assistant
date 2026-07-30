import { notFound } from "next/navigation";
import { getMatter, listChatMessages } from "@/lib/matters";
import ChatMessages from "@/components/ChatMessages";

export default async function MatterChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) notFound();

  const messages = await listChatMessages(id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Chat — {matter.title}</h1>
        <p className="text-sm text-zinc-500">
          Answers are grounded only in this matter&apos;s uploaded documents
          (text, PDF, Word, and scanned images — audio/video not yet supported).
        </p>
      </div>
      <ChatMessages matterId={matter.id} initialMessages={messages} />
    </main>
  );
}
