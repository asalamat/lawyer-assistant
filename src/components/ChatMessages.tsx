const SEED_MESSAGES = [
  { role: "assistant" as const, text: "Ask a question about a matter and I'll cite the source documents." },
  { role: "user" as const, text: "What deadlines are coming up for the Smith matter?" },
];

export default function ChatMessages() {
  return (
    <div className="flex flex-col gap-3">
      {SEED_MESSAGES.map((message, i) => (
        <div
          key={i}
          className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
            message.role === "assistant"
              ? "self-start bg-black/5 dark:bg-white/10"
              : "self-end bg-foreground text-background"
          }`}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
}
