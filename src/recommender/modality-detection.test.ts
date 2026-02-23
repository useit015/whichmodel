import { describe, expect, it } from "vitest";
import { detectTaskModality } from "./fallback.js";
import type { Modality } from "../types.js";

const MODALITY_CASES: Array<{ task: string; expected: Modality }> = [
  { task: "write video scripts for YouTube", expected: "text" },
  { task: "generate product photos", expected: "image" },
  { task: "create 15-second ad clips", expected: "video" },
  { task: "transcribe my podcast", expected: "audio_stt" },
  { task: "add voiceover to blog posts", expected: "audio_tts" },
  { task: "analyze screenshots", expected: "vision" },
  { task: "build semantic search", expected: "embedding" },
  { task: "generate background music", expected: "audio_generation" },
  { task: "write marketing emails", expected: "text" },
  { task: "summarize legal contracts", expected: "text" },
  { task: "create pixel art sprites", expected: "image" },
  { task: "convert images to video", expected: "video" },
  { task: "clone a voice from samples", expected: "audio_tts" },
  { task: "extract text from PDFs", expected: "vision" },
  { task: "build a chatbot", expected: "text" },
  { task: "generate logo designs", expected: "image" },
  { task: "analyze competitor websites", expected: "vision" },
  { task: "create vector embeddings", expected: "embedding" },
  { task: "make anime-style avatars", expected: "image" },
  { task: "caption videos with subtitles", expected: "audio_stt" },
  { task: "build a RAG assistant", expected: "embedding" },
  { task: "write ad copy for landing pages", expected: "text" },
];

describe("detectTaskModality coverage", () => {
  it.each(MODALITY_CASES)(
    "classifies '$task' as $expected",
    ({ task, expected }) => {
      expect(detectTaskModality(task)).toBe(expected);
    }
  );
});
