import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/transcription";

// Backs the DictateButton component — a generic "record a voice note,
// transcribe it, insert the text" endpoint, not tied to any one matter or
// document. Reuses the same OpenAI Whisper call already used for uploaded
// audio/video files.
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await transcribeAudio(buffer, file.name || "dictation.webm");
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 400 },
    );
  }
}
