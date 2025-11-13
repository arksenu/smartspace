"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export default function SettingsPage() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4-turbo-preview");
  const [temperature, setTemperature] = useState([0.7]);
  const [systemPrompt, setSystemPrompt] = useState("");

  const handleSave = () => {
    // TODO: Save settings to database
    toast.success("Settings saved");
  };

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
            <Input
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter custom system prompt..."
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  );
}

