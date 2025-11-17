"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { saveSettings, getSettings } from "@/app/actions/settings/update";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_SETTINGS = {
  provider: "openai",
  model: "gpt-5.1",
  temperature: 1.0,
  systemPrompt: "",
  webSearchEnabled: false,
};

export default function SettingsPage() {
  const [provider, setProvider] = useState(DEFAULT_SETTINGS.provider);
  const [model, setModel] = useState(DEFAULT_SETTINGS.model);
  const [temperature, setTemperature] = useState([DEFAULT_SETTINGS.temperature]);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SETTINGS.systemPrompt);
  const [webSearchEnabled, setWebSearchEnabled] = useState(DEFAULT_SETTINGS.webSearchEnabled);
  const [llmVerifiedRetrieval, setLlmVerifiedRetrieval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // Reset webSearchEnabled when provider changes away from OpenAI
  // Keep current state when switching back to OpenAI (preserve unsaved changes)
  useEffect(() => {
    // Skip on initial load (handled by loadSettings)
    if (loading) return;

    // Only reset to false when switching away from OpenAI
    // When switching back to OpenAI, preserve the current toggle state
    if (provider !== "openai") {
      setWebSearchEnabled(false);
    }
    // Note: We don't restore saved settings when switching back to OpenAI
    // This preserves any unsaved changes the user has made
  }, [provider, loading]);

  const loadSettings = async () => {
    try {
      const settings = await getSettings();
      if (settings) {
        const loadedProvider = settings.provider || DEFAULT_SETTINGS.provider;
        setProvider(loadedProvider);
        setModel(settings.model || DEFAULT_SETTINGS.model);
        setTemperature([settings.temperature ?? DEFAULT_SETTINGS.temperature]);
        setSystemPrompt(settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt);
        // Only load webSearchEnabled if provider is OpenAI, otherwise default to false
        setWebSearchEnabled(
          loadedProvider === "openai"
            ? settings.webSearchEnabled ?? DEFAULT_SETTINGS.webSearchEnabled
            : false
        );
        setLlmVerifiedRetrieval(settings.llmVerifiedRetrieval ?? false);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToSave: {
        provider: string;
        model: string;
        temperature: number;
        systemPrompt?: string;
        webSearchEnabled?: boolean;
        llmVerifiedRetrieval?: boolean;
      } = {
        provider,
        model,
        temperature: temperature[0],
        systemPrompt,
        llmVerifiedRetrieval,
      };

      // Only include webSearchEnabled when provider is OpenAI
      if (provider === "openai") {
        settingsToSave.webSearchEnabled = webSearchEnabled;
      }

      await saveSettings(settingsToSave);
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your AI model preferences and system behavior
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Settings</CardTitle>
          <CardDescription>Choose your preferred AI model and provider</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model name"
            />
          </div>

          <div className="space-y-2">
            <Label>Temperature: {temperature[0]}</Label>
            <Slider
              value={temperature}
              onValueChange={setTemperature}
              min={0}
              max={1}
              step={0.1}
            />
          </div>

          {provider === "openai" && (
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="web-search" className="text-base">
                  Web Search
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable OpenAI's built-in web search tool for real-time information
                </p>
              </div>
              <Switch
                id="web-search"
                checked={webSearchEnabled}
                onCheckedChange={setWebSearchEnabled}
              />
            </div>
          )}

          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="llm-verified-retrieval" className="text-base">
                LLM-Verified Retrieval Filtering
              </Label>
              <p className="text-sm text-muted-foreground">
                Use advanced LLM-based filtering to improve retrieval quality. When ON, uses Groq to verify chunk relevance before retrieval.
              </p>
            </div>
            <Switch
              id="llm-verified-retrieval"
              checked={llmVerifiedRetrieval}
              onCheckedChange={setLlmVerifiedRetrieval}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>Customize the system prompt for AI responses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter custom system prompt..."
              rows={6}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
