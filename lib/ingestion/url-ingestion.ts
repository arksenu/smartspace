import * as cheerio from "cheerio";

export async function ingestUrl(url: string): Promise<{ title: string; content: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SmartSpace/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements
    $("script, style").remove();

    // Extract title
    const title =
      $("title").text() ||
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text() ||
      url;

    // Extract main content
    const content =
      $("article").text() ||
      $("main").text() ||
      $("body").text() ||
      "";

    // Clean up whitespace
    const cleanedContent = content
      .replace(/\s+/g, " ")
      .trim();

    return {
      title: title.trim(),
      content: cleanedContent,
    };
  } catch (error) {
    throw new Error(`Failed to ingest URL: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

