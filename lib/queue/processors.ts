/**
 * Job processors for the background job queue
 */

import { Job, JobType, jobQueue } from "./index";
import { saveMessage, SaveMessageParams } from "@/lib/chat/save-message";
import { logEval, LogEvalParams } from "@/lib/analytics/logger";
import { updateConversationSummary } from "@/lib/chat/memory";
import { LLMProvider } from "@/lib/llm";

interface UpdateSummaryJobData {
  conversationId: string;
  userId: string;
  provider: LLMProvider;
  model: string;
}

/**
 * Initialize all job processors
 */
let processorsInitialized = false;

export function initializeJobProcessors(): void {
  // Only initialize once
  if (processorsInitialized) return;
  processorsInitialized = true;

  // Processor for saving messages
  jobQueue.registerProcessor(JobType.SAVE_MESSAGE, async (job: Job<SaveMessageParams>) => {
    console.log(`Processing job ${job.id}: Save message for conversation ${job.data.conversationId}`);
    await saveMessage(job.data);
  });

  // Processor for logging evaluations
  jobQueue.registerProcessor(JobType.LOG_EVAL, async (job: Job<LogEvalParams>) => {
    console.log(`Processing job ${job.id}: Log evaluation for conversation ${job.data.conversationId}`);
    await logEval(job.data);
  });

  // Processor for updating conversation summaries
  jobQueue.registerProcessor(JobType.UPDATE_SUMMARY, async (job: Job<UpdateSummaryJobData>) => {
    console.log(`Processing job ${job.id}: Update summary for conversation ${job.data.conversationId}`);
    await updateConversationSummary(job.data);
  });

  console.log('Job processors initialized');
}
