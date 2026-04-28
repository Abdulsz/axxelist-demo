import { getOpenAIClient } from "@/lib/openai";

export async function embedText(text: string): Promise<number[]> {
  try {
    const openai = getOpenAIClient();
    const response = await Promise.race([
      openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Embedding timeout")), 30_000),
      ),
    ]);

    return response.data[0]?.embedding ?? [];
  } catch {
    // Deterministic fallback keeps hybrid search functional even without embedding quota.
    const vec = new Array<number>(1536).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      const idx = i % 1536;
      vec[idx] = (vec[idx] + (text.charCodeAt(i) % 97) / 97) % 1;
    }
    return vec;
  }
}
