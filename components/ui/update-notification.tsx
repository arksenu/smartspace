"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Download, RefreshCw, X } from "lucide-react";

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).electronAPI) {
      return;
    }

    const electronAPI = (window as any).electronAPI;

    const handleUpdateAvailable = (info: UpdateInfo) => {
      setUpdateAvailable(info);
      toast.info("Update available", {
        description: `Version ${info.version} is available. Downloading...`,
        duration: 5000,
      });
    };

    const handleUpdateDownloaded = (info: UpdateInfo) => {
      setUpdateDownloaded(info);
      setDownloadProgress(null);
      toast.success("Update ready", {
        description: `Version ${info.version} has been downloaded. Restart to install.`,
        action: {
          label: "Restart Now",
          onClick: () => {
            electronAPI.quitAndInstall();
          },
        },
        duration: 10000,
      });
    };

    const handleDownloadProgress = (progress: { percent: number }) => {
      setDownloadProgress(progress.percent);
    };

    const handleError = (errorMessage: string) => {
      setError(errorMessage);
      toast.error("Update error", {
        description: errorMessage,
      });
    };

    electronAPI.onUpdateAvailable(handleUpdateAvailable);
    electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
    electronAPI.onUpdateProgress(handleDownloadProgress);
    electronAPI.onUpdateError(handleError);

    // Check for updates on mount
    electronAPI.checkForUpdates();

    return () => {
      // Remove all event listeners to prevent memory leaks
      electronAPI.removeUpdateAvailable?.();
      electronAPI.removeUpdateDownloaded?.();
      electronAPI.removeUpdateProgress?.();
      electronAPI.removeUpdateError?.();
    };
  }, []);

  if (!updateAvailable && !updateDownloaded && !error) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {updateDownloaded ? "Update Ready" : "Update Available"}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUpdateAvailable(null);
              setUpdateDownloaded(null);
              setError(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          {updateDownloaded
            ? "Restart the app to install the update"
            : "Downloading update..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {updateDownloaded && (
          <div className="space-y-2">
            <p className="text-sm">
              Version {updateDownloaded.version} is ready to install.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).electronAPI) {
                  (window as any).electronAPI.quitAndInstall();
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Restart & Install
            </Button>
          </div>
        )}
        {updateAvailable && !updateDownloaded && (
          <div className="space-y-2">
            <p className="text-sm">
              Version {updateAvailable.version} is being downloaded...
            </p>
            {downloadProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Downloading</span>
                  <span>{Math.round(downloadProgress)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).electronAPI) {
                  (window as any).electronAPI.checkForUpdates();
                  setError(null);
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
