import * as cheerio from "cheerio";

/**
 * Validates URL to prevent SSRF attacks
 * Blocks private IP ranges, localhost, and non-HTTP(S) protocols
 */
function validateUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new Error("Invalid URL format");
  }

  // Only allow http and https protocols
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  const hostname = url.hostname;

  // Block localhost and loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  ) {
    throw new Error("Localhost URLs are not allowed");
  }

  // Block private IP ranges
  const privateIpPatterns = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // 169.254.0.0/16 (link-local)
    /^fc00:/i, // IPv6 private range
    /^fe80:/i, // IPv6 link-local
  ];

  // Check if hostname is an IP address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        throw new Error("Private IP addresses are not allowed");
      }
    }
  }

  // Check for IPv6 addresses
  if (hostname.includes(":")) {
    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        throw new Error("Private IP addresses are not allowed");
      }
    }
  }
}

export async function ingestUrl(url: string): Promise<{ title: string; content: string }> {
  // Validate URL before fetching
  validateUrl(url);
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

