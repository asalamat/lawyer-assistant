import {
  getFeedbackForMatter,
  listChatMessages,
  listDocuments,
  listIndependentReviews,
} from "@/lib/matters";
import ChatMessages from "@/components/ChatMessages";

export default async function MatterChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [messages, documents, feedback, reviews] = await Promise.all([
    listChatMessages(id),
    listDocuments(id),
    getFeedbackForMatter(id),
    listIndependentReviews(id),
  ]);
  const knownFilenames = documents.map((doc) => doc.fileName);
  const chatReviews = reviews.filter((r) => r.sourceType === "chat_message");

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
        documents={documents.map((d) => ({ id: d.id, fileName: d.fileName }))}
        initialFeedback={feedback}
        initialReviews={chatReviews}
      />
    </div>
  );
}
