import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  // Get analytics data
  const { data: logs } = await supabase
    .from("eval_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const totalMessages = logs?.length || 0;
  const totalTokens = logs?.reduce((sum, log) => sum + (log.tokens_input || 0) + (log.tokens_output || 0), 0) || 0;
  const avgLatency = logs?.length
    ? logs.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / logs.length
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          View your usage statistics and performance metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Messages</CardTitle>
            <CardDescription>All time message count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Tokens</CardTitle>
            <CardDescription>Input + output tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTokens.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg Latency</CardTitle>
            <CardDescription>Average response time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgLatency.toFixed(0)}ms</div>
          </CardContent>
        </Card>
      </div>

      {logs && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="text-sm font-medium">{log.provider} / {log.model}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {log.tokens_input || 0} + {log.tokens_output || 0} tokens
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.latency_ms || 0}ms
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

