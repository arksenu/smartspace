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

/**
 * Extracts content from HTML using cheerio
 */
function extractContentFromHtml(html: string, url: string): { title: string; content: string } {
  const $ = cheerio.load(html);

  // Try to extract JSON-LD structured data (common in documentation sites)
  // Do this BEFORE removing script tags
  let structuredContent = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonData = JSON.parse($(el).html() || "{}");
      if (jsonData.text || jsonData.description || jsonData.articleBody) {
        structuredContent += (jsonData.text || jsonData.description || jsonData.articleBody) + " ";
      }
    } catch {
      // Ignore invalid JSON
    }
  });

  // Remove script and style elements (after extracting JSON-LD)
  $("script, style").remove();

  // Extract title with more fallbacks
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content") ||
    $("title").text() ||
    $("h1").first().text() ||
    $("h2").first().text() ||
    url;

  // Extract main content with multiple strategies
  // Try common documentation site selectors
  let content = "";
  
  // Strategy 1: Try specific content selectors (common in docs sites)
  const contentSelectors = [
    "article",
    "main",
    '[role="main"]',
    ".content",
    ".documentation",
    ".docs-content",
    ".markdown-body",
    ".prose",
    "#content",
    "#main-content",
    "[data-content]",
  ];

  for (const selector of contentSelectors) {
    const selected = $(selector);
    if (selected.length > 0) {
      const text = selected.text();
      if (text.trim().length > 100) {
        // Only use if we have substantial content
        content = text;
        break;
      }
    }
  }

  // Strategy 2: If no specific content found, try body but exclude common non-content elements
  if (!content || content.trim().length < 100) {
    const body = $("body");
    // Remove common navigation and footer elements
    body.find("nav, header, footer, aside, .nav, .navbar, .sidebar, .menu, .footer, .header").remove();
    content = body.text();
  }

  // Strategy 3: Add structured content if available
  if (structuredContent) {
    content = structuredContent + " " + content;
  }

  // Clean up whitespace
  const cleanedContent = content
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title.trim(),
    content: cleanedContent,
  };
}

/**
 * Extracts content using Playwright (for JavaScript-rendered pages)
 * Uses dynamic import to avoid bundling issues in Next.js
 */
async function extractContentWithPlaywright(url: string): Promise<{ title: string; content: string }> {
  // Dynamically import Playwright to avoid bundling issues
  const { chromium } = await import("playwright");
  
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled", // Avoid detection
        "--disable-features=IsolateOrigins,site-per-process", // Avoid detection
        "--disable-dev-shm-usage", // Overcome limited resource problems
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // For Docker/serverless environments
        "--disable-gpu",
      ],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
      // Add real browser-like properties
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    
    const page = await context.newPage();
    
    // Remove automated browser indicators
    await page.addInitScript(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Add Chrome runtime object
      (window as any).chrome = {
        runtime: {},
      };
      
      // Add permissions API
      if (!navigator.permissions) {
        (navigator as any).permissions = {
          query: () => Promise.resolve({ state: 'granted' }),
        };
      }
    });
    
    // Use "load" instead of "networkidle" - many sites never reach networkidle due to analytics/websockets
    // Set a longer timeout for slow-loading pages
    let navigationSuccess = false;
    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: 60000, // 60 seconds
      });
      navigationSuccess = true;
    } catch (timeoutError) {
      // If load times out, try domcontentloaded (faster, less reliable)
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        navigationSuccess = true;
      } catch (domError) {
        // If that also fails, just wait a bit and proceed
        console.warn(`Page navigation timeout, proceeding anyway: ${domError instanceof Error ? domError.message : "Unknown error"}`);
        // Still try to proceed - the page might have loaded partially
      }
    }
    
    // Check for Cloudflare challenge
    let pageContent = await page.content();
    const isCloudflareChallenge = 
      pageContent.includes("Just a moment") ||
      pageContent.includes("Checking your browser") ||
      pageContent.includes("cf-browser-verification") ||
      pageContent.includes("Enable JavaScript and cookies");
    
    if (isCloudflareChallenge) {
      console.log("Cloudflare challenge detected, waiting for it to resolve...");
      
      // Wait for challenge to resolve - check periodically
      let challengeResolved = false;
      const maxAttempts = 20; // 20 attempts * 2 seconds = 40 seconds max
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await page.waitForTimeout(2000);
        
        pageContent = await page.content();
        const stillChallenge = 
          pageContent.includes("Just a moment") ||
          pageContent.includes("Checking your browser") ||
          pageContent.includes("cf-browser-verification") ||
          pageContent.includes("Enable JavaScript and cookies");
        
        if (!stillChallenge) {
          console.log("Cloudflare challenge resolved!");
          challengeResolved = true;
          break;
        }
        
        console.log(`Still waiting for Cloudflare challenge to resolve... (attempt ${attempt + 1}/${maxAttempts})`);
      }
      
      if (!challengeResolved) {
        throw new Error(
          "Failed to bypass Cloudflare protection. The site requires manual browser access or a different scraping approach. " +
          "Consider using a web scraping API service that handles Cloudflare challenges."
        );
      }
    }

    // Wait for content to render - try waiting for common content selectors
    const contentSelectors = [
      "article",
      "main",
      '[role="main"]',
      ".content",
      ".documentation",
      ".docs-content",
      ".markdown-body",
      ".prose",
      "#content",
      "#main-content",
      "body",
    ];

    let contentFound = false;
    for (const selector of contentSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        contentFound = true;
        break;
      } catch {
        // Try next selector
        continue;
      }
    }

    // Wait additional time for dynamic content to load
    // Even if no selector matched, wait a bit for JS to render
    await page.waitForTimeout(contentFound ? 2000 : 5000);

    // Get the rendered HTML
    const html = await page.content();
    
    // Extract content using cheerio
    const result = extractContentFromHtml(html, url);

    // Validate content
    if (result.content.length < 50) {
      throw new Error(
        `Playwright extracted insufficient content (${result.content.length} characters). The page may require authentication or have no readable content.`
      );
    }

    await browser.close();
    return result;
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {
        // Ignore errors when closing browser
      });
    }
    
    // Provide helpful error message
    if (error instanceof Error) {
      if (error.message.includes("Executable doesn't exist") || error.message.includes("Browser not found") || error.message.includes("Cannot find module")) {
        throw new Error(
          `Playwright browser not installed or not available. Run 'npx playwright install chromium' to install it. Original error: ${error.message}`
        );
      }
      throw error;
    }
    throw new Error(`Playwright extraction failed: ${String(error)}`);
  }
}

export async function ingestUrl(url: string): Promise<{ title: string; content: string }> {
  // Validate URL before fetching
  validateUrl(url);
  
  try {
    // First, try regular fetch (faster and lighter)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const result = extractContentFromHtml(html, url);

    // If we got sufficient content, return it
    if (result.content.length >= 50) {
      return result;
    }

    // Otherwise, fall back to Playwright for JavaScript-rendered content
    console.log(`Insufficient content from fetch (${result.content.length} chars), trying Playwright...`);
    return await extractContentWithPlaywright(url);
  } catch (error) {
    // If fetch fails, try Playwright as fallback
    if (error instanceof Error && error.message.includes("Insufficient content")) {
      console.log("Trying Playwright as fallback...");
      try {
        return await extractContentWithPlaywright(url);
      } catch (playwrightError) {
        throw new Error(
          `Failed to ingest URL with both methods. Fetch error: ${error.message}. Playwright error: ${playwrightError instanceof Error ? playwrightError.message : "Unknown error"}`
        );
      }
    }
    
    // For other errors, try Playwright as fallback
    console.log(`Fetch failed (${error instanceof Error ? error.message : "Unknown error"}), trying Playwright...`);
    try {
      return await extractContentWithPlaywright(url);
    } catch (playwrightError) {
      throw new Error(
        `Failed to ingest URL: ${error instanceof Error ? error.message : "Unknown error"}. Playwright fallback also failed: ${playwrightError instanceof Error ? playwrightError.message : "Unknown error"}`
      );
    }
  }
}

