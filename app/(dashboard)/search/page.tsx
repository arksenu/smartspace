"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, File } from "lucide-react";
import { toast } from "sonner";

interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: any;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ query, topK: 10 }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      toast.error("Failed to perform search");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Semantic Search</h1>
        <p className="text-muted-foreground">
          Search across your documents using AI-powered semantic search
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter your search query..."
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Results ({results.length})</h2>
          {results.map((result, index) => (
            <Card key={result.chunkId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Result {index + 1}</CardTitle>
                    <CardDescription className="mt-1">
                      Document ID: {result.documentId.substring(0, 8)}...
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {(result.similarity * 100).toFixed(0)}% match
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <Card>
          <CardContent className="p-12 text-center">
            <File className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No results found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

