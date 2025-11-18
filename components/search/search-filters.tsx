"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SearchFiltersProps {
  topK: number;
  onTopKChange: (value: number) => void;
  documentId?: string;
  onDocumentIdChange?: (value: string) => void;
  availableDocuments?: Array<{ id: string; title: string }>;
}

export function SearchFilters({
  topK,
  onTopKChange,
  documentId,
  onDocumentIdChange,
  availableDocuments = [],
}: SearchFiltersProps) {
  return (
    <Card>
      <div className="p-4">
        <CardTitle className="text-sm font-medium mb-3">Filters</CardTitle>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#8C8C92]">Number of Results</Label>
            <Select value={topK.toString()} onValueChange={(value) => onTopKChange(parseInt(value))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {availableDocuments.length > 0 && onDocumentIdChange && (
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8C8C92]">Filter by Document</Label>
              <Select value={documentId || "all"} onValueChange={(value) => onDocumentIdChange(value === "all" ? "" : value)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  {availableDocuments.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}


