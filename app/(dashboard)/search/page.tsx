"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SearchBar } from "@/components/search/search-bar";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchResults } from "@/components/search/search-results";

interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata?: any;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(10);
  const [documentId, setDocumentId] = useState<string>("");
  const [documentTitles, setDocumentTitles] = useState<Record<string, string>>({});
  const [availableDocuments, setAvailableDocuments] = useState<Array<{ id: string; title: string }>>([]);

  // Fetch available documents for filtering
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch("/api/documents");
        if (response.ok) {
          const data = await response.json();
          setAvailableDocuments(data.documents || []);
          // Build document titles map
          const titles: Record<string, string> = {};
          (data.documents || []).forEach((doc: { id: string; title: string }) => {
            titles[doc.id] = doc.title;
          });
          setDocumentTitles(titles);
        }
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      }
    };

    fetchDocuments();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          topK,
          documentId: documentId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);

      if (data.results && data.results.length === 0) {
        toast.info("No results found for your query");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to perform search");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="space-y-1 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white/80">Semantic Search</h1>
        </div>
        <p className="text-xs text-[#8C8C92] max-w-2xl">
          Search across your documents using AI-powered semantic search
        </p>
      </div>

      {/* Search Interface */}
      <div className="grid gap-3 md:grid-cols-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="md:col-span-3">
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            loading={loading}
          />
        </div>
        <div className="md:col-span-1">
          <SearchFilters
            topK={topK}
            onTopKChange={setTopK}
            documentId={documentId}
            onDocumentIdChange={setDocumentId}
            availableDocuments={availableDocuments}
          />
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <SearchResults results={results} query={query} documentTitles={documentTitles} />
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <SearchResults results={[]} query={query} />
        </div>
      )}
    </div>
  );
}
