import { getFeedbackForMatter, listChatMessages, listDocuments } from "@/lib/matters";
import ChatMessages from "@/components/ChatMessages";

export default async function MatterChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const messages = await listChatMessages(id);
  const documents = await listDocuments(id);
  const knownFilenames = documents.map((doc) => doc.fileName);
  const feedback = await getFeedbackForMatter(id);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Answers are grounded only in this matter&apos;s uploaded documents
        (text, PDF, Word, spreadsheets, scanned images, and audio/video
        recordings with an OpenAI key configured).
      </p>
      <ChatMessages
        matterId={id}
        initialMessages={messages}
        knownFilenames={knownFilenames}
        initialFeedback={feedback}
      />
    </div>
  );
}
