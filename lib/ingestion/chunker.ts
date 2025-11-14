import { get_encoding, TiktokenEncoding } from "tiktoken";

export interface Chunk {
  content: string;
  metadata: {
    chunkIndex: number;
    tokenCount: number;
    pageNumber?: number;
    [key: string]: any;
  };
}

export interface ChunkingOptions {
  chunkSize?: number; // in tokens
  overlap?: number; // in tokens
  encoding?: TiktokenEncoding; // tiktoken encoding name
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  chunkSize: 500,
  overlap: 50,
  encoding: "cl100k_base" as TiktokenEncoding, // GPT-4 encoding
};

export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const encoding = get_encoding(opts.encoding);

  try {
    // Split text into sentences first
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

    const chunks: Chunk[] = [];
    let currentChunk: string[] = [];
    let currentTokenCount = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const sentenceTokens = encoding.encode(sentence);
      const sentenceTokenCount = sentenceTokens.length;

      // If adding this sentence would exceed chunk size, finalize current chunk
      if (currentTokenCount + sentenceTokenCount > opts.chunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join(" "),
          metadata: {
            chunkIndex: chunkIndex++,
            tokenCount: currentTokenCount,
          },
        });

        // Start new chunk with overlap
        // Save the previous chunk before clearing it
        const previousChunk = [...currentChunk];
        
        // Simple overlap: keep last sentence(s) that fit in overlap size
        currentChunk = [];
        currentTokenCount = 0;
        
        // Add overlap from previous chunk
        let overlapAccumulated = 0;
        for (let i = previousChunk.length - 1; i >= 0 && overlapAccumulated < opts.overlap; i--) {
          const sentTokens = encoding.encode(previousChunk[i]);
          if (overlapAccumulated + sentTokens.length <= opts.overlap) {
            currentChunk.unshift(previousChunk[i]);
            overlapAccumulated += sentTokens.length;
            currentTokenCount += sentTokens.length;
          }
        }
      }

      currentChunk.push(sentence);
      currentTokenCount += sentenceTokenCount;
    }

    // Add final chunk if there's content
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join(" "),
        metadata: {
          chunkIndex: chunkIndex,
          tokenCount: currentTokenCount,
        },
      });
    }

    return chunks;
  } finally {
    // Free encoding to prevent memory leak
    encoding.free();
  }
}

