/**
 * Default configuration values for optimal performance
 */

export const DEFAULT_CONFIG = {
  // LLM Settings
  llm: {
    defaultProvider: "openai",
    defaultModel: "gpt-5.1",
    defaultTemperature: 1.0,
    maxTokens: undefined, // Use model defaults
    streamingEnabled: true,
  },

  // Vector Search Settings
  vectorSearch: {
    // Disable LLM-verified retrieval by default for better performance
    // This can add 5-10 seconds to response time when enabled
    llmVerifiedRetrieval: false,
    
    // Standard top-k retrieval count
    topK: 5,
    
    // Minimum similarity threshold (0.5%)
    minSimilarityThreshold: 0.005,
  },

  // Embedding Settings
  embeddings: {
    provider: "openai",
    model: "text-embedding-3-small",
    
    // Cache settings
    cacheEnabled: true,
    cacheMaxSize: 1000,
    cacheTTLMinutes: 60,
  },

  // Performance Settings
  performance: {
    // Batch sizes for parallel operations
    embeddingBatchSize: 10,
    relevanceScoringBatchSize: 5,
    
    // Rate limiting delays (ms)
    groqBatchDelay: 200,
    embeddingBatchDelay: 100,
    
    // Timeouts (ms)
    llmTimeout: 30000,
    embeddingTimeout: 5000,
  },

  // Memory Settings
  memory: {
    useMemory: true,
    summaryTriggerTokens: 2500,
    summaryTriggerMinMessages: 12,
    recentMessagesToKeep: 6,
    maxSummaryTokens: 400,
  },
};

/**
 * Performance recommendations based on configuration
 */
export const PERFORMANCE_RECOMMENDATIONS = {
  llmVerifiedRetrieval: {
    impact: "HIGH",
    latencyIncrease: "5-10 seconds",
    recommendation: "Disable unless you need very precise relevance filtering. Standard vector search is usually sufficient.",
  },
  webSearch: {
    impact: "MEDIUM",
    latencyIncrease: "1-3 seconds",
    recommendation: "Enable only when you need real-time information from the web.",
  },
  memoryEnabled: {
    impact: "LOW",
    latencyIncrease: "100-500ms",
    recommendation: "Keep enabled for better conversation continuity. Impact is minimal.",
  },
};
