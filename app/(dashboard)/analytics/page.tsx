import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { performanceTracker, OperationType, type PerformanceStats } from "@/lib/analytics/performance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Get performance metrics for the last 24 hours
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  let perfStats: PerformanceStats[] = [];
  try {
    perfStats = await performanceTracker.getStats(startTime, endTime);
  } catch (error) {
    console.error('Failed to get performance stats:', error);
    perfStats = [];
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          View your usage statistics and real-time performance metrics
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

      {/* Performance Metrics Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Performance Metrics (Last 24 Hours)</h2>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="breakdown">Operation Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {perfStats.map((stat) => {
                const operationName = stat.operation
                  .split('_')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');

                // Cache events are instant (0ms) - show only counts
                const isCacheEvent = stat.operation === OperationType.CACHE_HIT ||
                  stat.operation === OperationType.CACHE_MISS;

                return (
                  <Card key={stat.operation}>
                    <CardHeader>
                      <CardTitle className="text-lg">{operationName}</CardTitle>
                      <CardDescription>{stat.count} operations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isCacheEvent ? (
                        <div className="text-center py-4">
                          <div className="text-3xl font-bold">
                            {stat.count}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Total Events
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Average:</span>
                            <span className="font-mono">{stat.avg_ms}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span>P50:</span>
                            <span className="font-mono">{stat.p50_ms}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span>P95:</span>
                            <span className="font-mono text-yellow-600">{stat.p95_ms}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span>P99:</span>
                            <span className="font-mono text-red-600">{stat.p99_ms}ms</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{stat.min_ms}ms - {stat.max_ms}ms</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {perfStats.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No performance data available yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Performance metrics will appear here once you start using the chat.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Comparison</CardTitle>
                <CardDescription>Compare with and without optimizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold mb-2">Vector Search</h4>
                      {perfStats.find(s => s.operation === OperationType.VECTOR_SEARCH) ? (
                        <div className="space-y-1 text-sm">
                          <div>P95: {perfStats.find(s => s.operation === OperationType.VECTOR_SEARCH)?.p95_ms}ms</div>
                          <div className="text-xs text-muted-foreground">Standard retrieval</div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No data</div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">LLM-Verified Retrieval</h4>
                      {perfStats.find(s => s.operation === OperationType.RELEVANCE_SCORING) ? (
                        <div className="space-y-1 text-sm">
                          <div>P95: {perfStats.find(s => s.operation === OperationType.RELEVANCE_SCORING)?.p95_ms}ms</div>
                          <div className="text-xs text-muted-foreground">With relevance scoring</div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No data</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Cache Performance</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm">Cache Hits</div>
                        <div className="text-2xl font-bold text-green-600">
                          {perfStats.find(s => s.operation === OperationType.CACHE_HIT)?.count || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm">Cache Misses</div>
                        <div className="text-2xl font-bold text-yellow-600">
                          {perfStats.find(s => s.operation === OperationType.CACHE_MISS)?.count || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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

