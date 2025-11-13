import pdf from "pdf-parse";

export interface ParsedPDF {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    pages: number;
    info?: any;
  };
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  try {
    const data = await pdf(buffer);

    return {
      text: data.text,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        pages: data.numpages,
        info: data.info,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

