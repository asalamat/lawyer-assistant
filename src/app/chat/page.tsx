import ChatMessages from "@/components/ChatMessages";

export default function ChatPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Chat</h1>
      <ChatMessages />
      <form className="flex gap-2">
        <input
          disabled
          placeholder="AI answers are coming soon"
          className="flex-1 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"
        />
        <button
          type="submit"
          disabled
          className="rounded bg-foreground px-4 py-2 text-sm text-background opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
