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
import { Sparkles, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-32 bg-white/5" />
          <Skeleton className="h-3 w-64 bg-white/5" />
        </div>
        <Card>
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-24 bg-white/5" />
            <Skeleton className="h-8 w-full bg-white/5" />
            <Skeleton className="h-8 w-full bg-white/5" />
            <Skeleton className="h-8 w-full bg-white/5" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-white/80">Settings</h1>
          <p className="text-xs text-[#8C8C92]">
            Configure your AI model preferences and system behavior
          </p>
        </div>

        {/* Model Settings */}
        <Card>
          <div className="p-4">
            <div className="mb-4">
              <CardTitle className="text-sm font-medium mb-1">Model Settings</CardTitle>
              <CardDescription className="text-xs">Choose your preferred AI model and provider</CardDescription>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8C8C92]">Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8C8C92]">Model</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model name"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-[#8C8C92]">Temperature</Label>
                  <span className="text-xs text-[#CFCFD3] font-medium">{temperature[0]}</span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={setTemperature}
                  min={0}
                  max={1}
                  step={0.1}
                  className="py-2"
                />
              </div>

              {provider === "openai" && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 p-3 bg-white/5">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="web-search" className="text-xs font-medium text-[#CFCFD3]">
                      Web Search
                    </Label>
                    <p className="text-xs text-[#8C8C92] leading-relaxed">
                      Enable OpenAI&apos;s built-in web search tool for real-time information
                    </p>
                  </div>
                  <Switch
                    id="web-search"
                    checked={webSearchEnabled}
                    onCheckedChange={setWebSearchEnabled}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 p-3 bg-white/5">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="llm-verified-retrieval" className="text-xs font-medium text-[#CFCFD3] flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    AI-Powered Retrieval Filtering
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center">
                          <Info className="h-3 w-3 text-[#8C8C92] hover:text-[#CFCFD3] transition-colors" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px]">
                          Uses AI to verify chunk relevance before retrieval, improving answer quality by filtering out irrelevant content.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <p className="text-xs text-[#8C8C92] leading-relaxed">
                    Use advanced LLM-based filtering to improve retrieval quality. When ON, uses Groq to verify chunk relevance before retrieval.
                  </p>
                </div>
                <Switch
                  id="llm-verified-retrieval"
                  checked={llmVerifiedRetrieval}
                  onCheckedChange={setLlmVerifiedRetrieval}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* System Prompt */}
        <Card>
          <div className="p-4">
            <div className="mb-4">
              <CardTitle className="text-sm font-medium mb-1">System Prompt</CardTitle>
              <CardDescription className="text-xs">Customize the system prompt for AI responses</CardDescription>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8C8C92]">Prompt</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter custom system prompt..."
                rows={4}
                className="resize-none text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="h-8 text-xs">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </TooltipProvider>
  );
}
