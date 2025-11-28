import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  includeWebSearch: z.boolean().optional(),
});

export const documentUploadSchema = z.object({
  file: z.instanceof(File),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

export const searchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).optional(),
  threshold: z.number().min(0).max(1).optional(),
});
