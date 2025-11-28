# SmartSpace Development Roadmap

> **Last Updated:** 2025-11-28
> **Project Status:** Strong foundation with critical gaps in testing and error handling

## Table of Contents
1. [Project Overview](#project-overview)
2. [Current State Assessment](#current-state-assessment)
3. [Development Priorities](#development-priorities)
4. [Tier 1: Critical Tasks](#tier-1-critical-tasks)
5. [Tier 2: High Priority](#tier-2-high-priority)
6. [Tier 3: Medium Priority](#tier-3-medium-priority)
7. [Tier 4: Nice-to-Have](#tier-4-nice-to-have)
8. [Technical Debt](#technical-debt)
9. [Project Maturity Scorecard](#project-maturity-scorecard)

---

## Project Overview

**SmartSpace** is an AI-powered knowledge workspace with RAG (Retrieval-Augmented Generation) capabilities, built as an Electron desktop application.

### Tech Stack
- **Frontend:** Next.js 14 (App Router), React 18, TailwindCSS, shadcn/ui
- **Desktop:** Electron 28 with native integrations
- **Backend:** Next.js Route Handlers + Server Actions
- **Database:** Supabase PostgreSQL with PGVector
- **Auth:** Supabase Auth with Electron OAuth
- **LLM Providers:** OpenAI, Anthropic (Claude), Groq
- **Embeddings:** OpenAI text-embedding-3-small with SHA-256 caching

### Key Features
- Document ingestion (PDF, URL, text)
- Semantic search with vector embeddings
- LLM-verified retrieval filter with 7-step pipeline
- Adaptive chat memory with token-aware management
- Multi-provider LLM support with streaming
- Performance tracking and caching

---

## Current State Assessment

### ✅ What's Working Excellently

#### 1. Advanced RAG Implementation
- **LLM-Verified Retrieval Filter** (`lib/retrieval/llm-verified-filter.ts`)
  - Z-score normalization
  - Statistical outlier removal
  - Maximal Marginal Relevance (MMR) for diversity
  - Near-duplicate detection (cosine similarity > 0.95)
  - LLM-based relevance scoring using Groq
  - Smart query classification

#### 2. Adaptive Chat Memory System
- **Files:** `lib/chat/memory-manager.ts`, `lib/chat/token-counter.ts`
- Model-aware token tracking (supports up to 1M tokens)
- Automatic conversation summarization
- Context window management
- Supports 10+ different model token limits

#### 3. Electron Desktop Integration
- **Files:** `electron/main.js`, `electron/auth-handler.js`
- Native file dialogs for uploads
- Custom protocol handler (`smartspace://`)
- Secure storage using Electron's safeStorage
- System tray integration
- Auto-update system

#### 4. Performance Optimizations
- **Embedding Cache:** `lib/cache/embedding-cache.ts` (SHA-256 based LRU)
- **Performance Tracking:** `lib/performance/metrics-tracker.ts`
- **Retry Mechanisms:** `lib/utils/retry.ts`
- **Query Classification:** Skips expensive LLM verification for simple queries

### ❌ Critical Gaps

1. **Testing:** Only 1 E2E test, no unit/integration tests
2. **Error Handling:** Minimal error boundaries, no standardized format
3. **Security:** CORS allows all origins, no rate limiting
4. **Monitoring:** No error tracking or production analytics
5. **Documentation:** Missing API docs and architecture diagrams

---

## Development Priorities

### Recommended Sequence

```
Week 1: Testing & Reliability
├── Set up Jest + React Testing Library
├── Write tests for critical paths
├── Implement error boundaries
└── Add Zod validation

Week 2: Security & Monitoring
├── Security audit (CORS, rate limiting)
├── Set up Sentry for error tracking
├── Add production analytics
└── Database optimizations

Week 3: Polish & Documentation
├── Complete conversation management UI
├── Add message actions
├── Improve loading states
└── Write API documentation

Week 4: Performance & Advanced Features
├── Implement code splitting
├── Bundle size optimization
├── Add hybrid search (optional)
└── Real-time updates (optional)
```

---

## Tier 1: Critical Tasks

> **Priority:** Must complete before production deployment
> **Estimated Time:** 4-6 days

### 1. Set Up Testing Infrastructure

**Goal:** Establish comprehensive testing framework with 60%+ coverage on critical paths

#### Step 1.1: Install Testing Dependencies

```bash
npm install --save-dev \
  jest \
  @types/jest \
  ts-jest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @testing-library/hooks \
  jest-environment-jsdom
```

#### Step 1.2: Configure Jest

Create `jest.config.js`:
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

Create `jest.setup.js`:
```javascript
import '@testing-library/jest-dom'
```

#### Step 1.3: Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

#### Step 1.4: Write Critical Tests

**A. Test Chat Memory Manager** (`lib/chat/__tests__/memory-manager.test.ts`)

```typescript
import { ChatMemoryManager } from '../memory-manager';

describe('ChatMemoryManager', () => {
  test('should track token usage correctly', () => {
    // Test token counting for different models
  });

  test('should trigger summarization when exceeding limit', () => {
    // Test auto-summarization logic
  });

  test('should prioritize recent messages', () => {
    // Test message prioritization
  });

  test('should handle edge cases (empty messages, very long messages)', () => {
    // Test edge cases
  });
});
```

**B. Test LLM-Verified Retrieval Filter** (`lib/retrieval/__tests__/llm-verified-filter.test.ts`)

```typescript
import { filterWithLLM } from '../llm-verified-filter';

describe('LLM-Verified Retrieval Filter', () => {
  test('should normalize scores using z-score', () => {
    // Test score normalization
  });

  test('should remove outliers correctly', () => {
    // Test outlier detection
  });

  test('should apply MMR for diversity', () => {
    // Test diversity algorithm
  });

  test('should detect near-duplicates', () => {
    // Test duplicate detection (cosine > 0.95)
  });

  test('should skip LLM verification for simple queries', () => {
    // Test query classification
  });
});
```

**C. Test Embedding Cache** (`lib/cache/__tests__/embedding-cache.test.ts`)

```typescript
import { embeddingCache } from '../embedding-cache';

describe('EmbeddingCache', () => {
  test('should cache embeddings with SHA-256 key', () => {
    // Test caching mechanism
  });

  test('should handle cache hits correctly', () => {
    // Test cache retrieval
  });

  test('should detect hash collisions', () => {
    // Test collision detection
  });

  test('should evict old entries (LRU)', () => {
    // Test LRU eviction
  });

  test('should respect TTL (60 minutes)', () => {
    // Test TTL expiration
  });
});
```

**D. Test Document Chunking** (`lib/documents/__tests__/chunking.test.ts`)

```typescript
import { chunkDocument } from '../chunking';

describe('Document Chunking', () => {
  test('should chunk document with correct token size', () => {
    // Test chunk size limits
  });

  test('should handle overlap correctly', () => {
    // Test chunk overlap
  });

  test('should preserve context boundaries', () => {
    // Test semantic boundaries
  });

  test('should handle edge cases (empty docs, very small docs)', () => {
    // Test edge cases
  });
});
```

**E. Test API Routes** (`app/api/__tests__/`)

Create tests for:
- `/api/chat/route.ts` - Test streaming, error handling
- `/api/documents/route.ts` - Test file upload, validation
- `/api/search/route.ts` - Test query parsing, results

**Files to Create:**
- [ ] `jest.config.js`
- [ ] `jest.setup.js`
- [ ] `lib/chat/__tests__/memory-manager.test.ts`
- [ ] `lib/chat/__tests__/token-counter.test.ts`
- [ ] `lib/retrieval/__tests__/llm-verified-filter.test.ts`
- [ ] `lib/cache/__tests__/embedding-cache.test.ts`
- [ ] `lib/cache/__tests__/relevance-cache.test.ts`
- [ ] `lib/documents/__tests__/chunking.test.ts`
- [ ] `lib/utils/__tests__/retry.test.ts`
- [ ] `app/api/chat/__tests__/route.test.ts`
- [ ] `app/api/documents/__tests__/route.test.ts`
- [ ] `app/api/search/__tests__/route.test.ts`

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ Coverage >= 60% for critical paths
- ✅ CI/CD pipeline runs tests automatically

---

### 2. Implement Error Handling

**Goal:** Standardize error handling across the application

#### Step 2.1: Create Error Types

Create `lib/errors/types.ts`:
```typescript
export enum ErrorCode {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Validation
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Resources
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // External Services
  LLM_ERROR = 'LLM_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

#### Step 2.2: Create Error Handler Utility

Create `lib/errors/handler.ts`:
```typescript
import { NextResponse } from 'next/server';
import { ApiError, ErrorCode } from './types';
import { ZodError } from 'zod';

export function handleApiError(error: unknown) {
  // Log error (use structured logging)
  console.error('API Error:', error);

  // Handle known errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error.errors,
        },
      },
      { status: 400 }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    },
    { status: 500 }
  );
}
```

#### Step 2.3: Create Error Boundary Component

Create `components/error-boundary.tsx`:
```typescript
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error tracking service (Sentry)
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Step 2.4: Add Zod Validation Schemas

Create `lib/validation/schemas.ts`:
```typescript
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
```

#### Step 2.5: Update API Routes with Error Handling

Example for `app/api/chat/route.ts`:
```typescript
import { handleApiError } from '@/lib/errors/handler';
import { ApiError, ErrorCode } from '@/lib/errors/types';
import { chatMessageSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = chatMessageSchema.parse(body);

    // Your existing logic...

    // Throw specific errors
    if (!user) {
      throw new ApiError(
        ErrorCode.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }

    // ...

  } catch (error) {
    return handleApiError(error);
  }
}
```

#### Step 2.6: Replace console.log with Structured Logging

Create `lib/logging/logger.ts`:
```typescript
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

class Logger {
  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to logging service (Datadog, CloudWatch, etc.)
    }

    // Console output for development
    console[level](JSON.stringify(logEntry));
  }

  debug(message: string, meta?: any) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: any) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: any) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: Error, meta?: any) {
    this.log(LogLevel.ERROR, message, {
      ...meta,
      error: error?.message,
      stack: error?.stack,
    });
  }
}

export const logger = new Logger();
```

**Action Items:**
- [ ] Create `lib/errors/types.ts`
- [ ] Create `lib/errors/handler.ts`
- [ ] Create `components/error-boundary.tsx`
- [ ] Create `lib/validation/schemas.ts`
- [ ] Create `lib/logging/logger.ts`
- [ ] Update all API routes to use error handling
- [ ] Replace all console.log with structured logging
- [ ] Wrap app with ErrorBoundary in `app/layout.tsx`

**Acceptance Criteria:**
- ✅ All API routes return standardized error format
- ✅ All inputs validated with Zod schemas
- ✅ Error boundary catches React errors
- ✅ Structured logging in place

---

### 3. Security Audit & Improvements

**Goal:** Secure the application for production deployment

#### Step 3.1: Fix CORS Configuration

Update `next.config.js`:
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};
```

Add to `.env`:
```
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
```

#### Step 3.2: Add Rate Limiting

Install dependencies:
```bash
npm install @upstash/ratelimit @upstash/redis
```

Create `lib/security/rate-limit.ts`:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create different rate limiters
export const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

export const chatRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 chat messages per minute
  analytics: true,
});

export const uploadRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 uploads per hour
  analytics: true,
});
```

Create middleware `middleware.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { apiRateLimiter } from '@/lib/security/rate-limit';

export async function middleware(request: NextRequest) {
  // Get user identifier (IP or user ID)
  const identifier = request.ip ?? '127.0.0.1';

  // Check rate limit
  const { success, limit, remaining, reset } = await apiRateLimiter.limit(
    identifier
  );

  if (!success) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: { limit, reset },
        },
      },
      { status: 429 }
    );
  }

  // Add rate limit headers
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', reset.toString());

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

#### Step 3.3: Improve File Upload Security

Update `app/api/documents/route.ts`:
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'text/html',
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'File size exceeds 10MB limit',
        400
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid file type. Only PDF, TXT, and HTML files are allowed',
        400
      );
    }

    // Validate file content (check magic bytes for PDF)
    if (file.type === 'application/pdf') {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

      if (!isPDF) {
        throw new ApiError(
          ErrorCode.VALIDATION_ERROR,
          'File does not appear to be a valid PDF',
          400
        );
      }
    }

    // Continue with upload...
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### Step 3.4: Add CSRF Protection

Create `lib/security/csrf.ts`:
```typescript
import { randomBytes } from 'crypto';

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateCSRFToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) return false;
  return token === storedToken;
}
```

#### Step 3.5: Review RLS Policies

Check Supabase RLS policies in:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`

Ensure policies are strict:
```sql
-- Example: Users can only access their own documents
CREATE POLICY "Users can only view their own documents"
  ON documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Example: Users can only insert their own documents
CREATE POLICY "Users can only insert their own documents"
  ON documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### Step 3.6: Sanitize Markdown Output

Install sanitization library:
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

Update markdown rendering to sanitize:
```typescript
import DOMPurify from 'dompurify';

// When rendering markdown
const sanitizedHTML = DOMPurify.sanitize(markdownHTML, {
  ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'code', 'pre'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
});
```

**Action Items:**
- [ ] Fix CORS configuration in `next.config.js`
- [ ] Set up Upstash Redis for rate limiting
- [ ] Create `lib/security/rate-limit.ts`
- [ ] Create `middleware.ts` for rate limiting
- [ ] Improve file upload validation in `app/api/documents/route.ts`
- [ ] Create `lib/security/csrf.ts` for CSRF protection
- [ ] Review and tighten all RLS policies in Supabase
- [ ] Add DOMPurify for markdown sanitization
- [ ] Add security headers (CSP, X-Frame-Options, etc.)

**Acceptance Criteria:**
- ✅ CORS restricted to allowed origins
- ✅ Rate limiting active on all API routes
- ✅ File uploads validated (size, type, magic bytes)
- ✅ CSRF protection implemented
- ✅ RLS policies reviewed and tightened
- ✅ XSS prevention in markdown rendering
- ✅ Security headers configured

---

## Tier 2: High Priority

> **Priority:** Important for production quality
> **Estimated Time:** 4-5 days

### 4. Complete Conversation Management

**Goal:** Provide full conversation CRUD operations in the UI

#### Step 4.1: Add Conversation List to Chat Page

Create `components/chat/conversation-sidebar.tsx`:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Trash2, MessageSquare } from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
  messageCount: number;
}

export function ConversationSidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // TODO: Fetch conversations from API
  useEffect(() => {
    // fetch('/api/conversations')
  }, []);

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <Button onClick={() => {/* Create new conversation */}} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => setSelectedId(conv.id)}
            className={`p-4 cursor-pointer hover:bg-gray-100 border-b ${
              selectedId === conv.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{conv.title}</h3>
                <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                <div className="flex items-center gap-2 mt-1">
                  <MessageSquare className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{conv.messageCount} messages</span>
                  <span className="text-xs text-gray-400">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Delete conversation
                }}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Step 4.2: Create Conversations API Routes

Create `app/api/conversations/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleApiError } from '@/lib/errors/handler';

// GET /api/conversations - List all conversations
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(ErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        messages (count)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(ErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { title } = await request.json();

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: title || 'New Conversation',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ conversation });
  } catch (error) {
    return handleApiError(error);
  }
}
```

Create `app/api/conversations/[id]/route.ts`:
```typescript
// DELETE /api/conversations/[id] - Delete conversation
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(ErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    // Delete conversation (cascades to messages)
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### Step 4.3: Add Database Migration for Conversations Table

Create `supabase/migrations/007_conversations.sql`:
```sql
-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only create their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Add conversation_id to messages table
ALTER TABLE messages ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- Update trigger to update conversations.updated_at when messages are added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_timestamp_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();
```

#### Step 4.4: Update Chat Page Layout

Update `app/chat/page.tsx`:
```typescript
import { ConversationSidebar } from '@/components/chat/conversation-sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';

export default function ChatPage() {
  return (
    <div className="flex h-screen">
      <ConversationSidebar />
      <div className="flex-1">
        <ChatInterface />
      </div>
    </div>
  );
}
```

**Action Items:**
- [ ] Create `components/chat/conversation-sidebar.tsx`
- [ ] Create `app/api/conversations/route.ts`
- [ ] Create `app/api/conversations/[id]/route.ts`
- [ ] Create migration `supabase/migrations/007_conversations.sql`
- [ ] Update `app/chat/page.tsx` with sidebar
- [ ] Add conversation context provider
- [ ] Test conversation CRUD operations

**Acceptance Criteria:**
- ✅ Sidebar shows list of conversations
- ✅ Can create new conversation
- ✅ Can search conversations
- ✅ Can delete conversation
- ✅ Can switch between conversations
- ✅ Last message preview shown
- ✅ Message count and date shown

---

### 5. Database Optimization

**Goal:** Improve query performance and add missing indexes

#### Step 5.1: Add Missing Indexes

Create `supabase/migrations/008_performance_indexes.sql`:
```sql
-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_user_id_status ON documents(user_id, status);

-- Document chunks indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON document_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id_chunk_index ON document_chunks(document_id, chunk_index);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation ON performance_metrics(operation);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation_created_at ON performance_metrics(operation, created_at DESC);

-- Eval logs indexes (if exists)
-- CREATE INDEX IF NOT EXISTS idx_eval_logs_provider ON eval_logs(provider);
-- CREATE INDEX IF NOT EXISTS idx_eval_logs_created_at ON eval_logs(created_at DESC);
```

#### Step 5.2: Implement Cursor-Based Pagination

Create `lib/database/pagination.ts`:
```typescript
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function paginateQuery<T>(
  query: PostgrestFilterBuilder<any, any, T[]>,
  params: PaginationParams = {}
): Promise<PaginatedResponse<T>> {
  const limit = params.limit || 20;

  // Apply cursor if provided
  if (params.cursor) {
    query = query.gt('created_at', params.cursor);
  }

  // Fetch one extra to check if there are more results
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (error) throw error;

  const hasMore = data.length > limit;
  const results = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? results[results.length - 1].created_at : null;

  return {
    data: results,
    nextCursor,
    hasMore,
  };
}
```

Update API routes to use pagination:
```typescript
// app/api/documents/route.ts
import { paginateQuery } from '@/lib/database/pagination';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') || undefined;
  const limit = parseInt(searchParams.get('limit') || '20');

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const query = supabase
    .from('documents')
    .select('*')
    .eq('user_id', user!.id);

  const result = await paginateQuery(query, { cursor, limit });

  return NextResponse.json(result);
}
```

#### Step 5.3: Analyze Slow Queries

Create script `scripts/analyze-queries.sql`:
```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
  mean_exec_time,
  calls,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze specific query
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE user_id = 'xxx'
ORDER BY created_at DESC
LIMIT 20;
```

Run analysis and optimize as needed.

#### Step 5.4: Add Database Connection Pooling

Update `lib/supabase/server.ts`:
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create client with connection pooling
export const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-connection-pool': 'true',
    },
  },
});
```

**Action Items:**
- [ ] Create `supabase/migrations/008_performance_indexes.sql`
- [ ] Run migration to add indexes
- [ ] Create `lib/database/pagination.ts`
- [ ] Update API routes to use pagination
- [ ] Run query analysis script
- [ ] Optimize slow queries identified
- [ ] Configure connection pooling
- [ ] Test performance improvements

**Acceptance Criteria:**
- ✅ All missing indexes added
- ✅ Pagination implemented for large result sets
- ✅ Slow queries identified and optimized
- ✅ Connection pooling configured
- ✅ Query performance improved by >= 30%

---

### 6. Production Monitoring

**Goal:** Set up error tracking and analytics for production

#### Step 6.1: Set Up Sentry

Install Sentry:
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Configure `sentry.client.config.ts`:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

Configure `sentry.server.config.ts`:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
```

Update error handler to report to Sentry:
```typescript
// lib/errors/handler.ts
import * as Sentry from '@sentry/nextjs';

export function handleApiError(error: unknown) {
  // Report to Sentry
  Sentry.captureException(error);

  // ... rest of error handling
}
```

#### Step 6.2: Add Analytics

Install analytics library:
```bash
npm install @vercel/analytics
```

Add to `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

#### Step 6.3: Create Performance Dashboard

Create `app/dashboard/performance/page.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface Metrics {
  operation: string;
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<Metrics[]>([]);

  useEffect(() => {
    // Fetch from /api/performance/metrics
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Performance Metrics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <Card key={metric.operation} className="p-6">
            <h3 className="font-semibold mb-4">{metric.operation}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">P50:</span>
                <span className="font-medium">{metric.p50}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">P95:</span>
                <span className="font-medium">{metric.p95}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">P99:</span>
                <span className="font-medium">{metric.p99}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Count:</span>
                <span className="font-medium">{metric.count}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

Create API route `app/api/performance/metrics/route.ts`:
```typescript
export async function GET(request: Request) {
  const supabase = createClient();

  // Get metrics from last 24 hours
  const { data: metrics } = await supabase
    .from('performance_metrics')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Calculate percentiles per operation
  const operationMetrics = calculatePercentiles(metrics);

  return NextResponse.json({ metrics: operationMetrics });
}
```

#### Step 6.4: Set Up Alerts

Configure alerts in Sentry dashboard:
- Error rate > 1% in 5 minutes
- Response time > 1000ms for 5 minutes
- Failed API calls > 10 in 1 minute

**Action Items:**
- [ ] Install and configure Sentry
- [ ] Update error handler to report to Sentry
- [ ] Install and configure Vercel Analytics
- [ ] Create performance dashboard page
- [ ] Create performance metrics API route
- [ ] Set up alerts in Sentry dashboard
- [ ] Test error reporting
- [ ] Test analytics tracking

**Acceptance Criteria:**
- ✅ Sentry captures and reports errors
- ✅ Analytics tracks page views and events
- ✅ Performance dashboard shows real-time metrics
- ✅ Alerts configured and tested
- ✅ Error reports include context and stack traces

---

## Tier 3: Medium Priority

> **Priority:** Polish and improve user experience
> **Estimated Time:** 5-6 days

### 7. UI/UX Improvements

**Goal:** Polish the user interface and improve user experience

#### Step 7.1: Add Message Actions

Update `components/chat/message.tsx`:
```typescript
import { Copy, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MessageProps {
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
  };
  onRegenerate?: () => void;
  onFeedback?: (positive: boolean) => void;
}

export function Message({ message, onRegenerate, onFeedback }: MessageProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    // TODO: Show toast notification
  };

  return (
    <div className="group relative p-4 hover:bg-gray-50">
      {/* Message content */}
      <div className="prose max-w-none">
        {message.content}
      </div>

      {/* Timestamp */}
      <div className="text-xs text-gray-400 mt-2">
        {new Date(message.timestamp).toLocaleString()}
      </div>

      {/* Action buttons (show on hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy message</TooltipContent>
        </Tooltip>

        {message.role === 'assistant' && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerate}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate response</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFeedback?.(true)}
                >
                  <ThumbsUp className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Good response</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFeedback?.(false)}
                >
                  <ThumbsDown className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Poor response</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
```

#### Step 7.2: Add Skeleton Loaders

Create `components/ui/skeleton.tsx`:
```typescript
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

export function MessageSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
```

Use in loading states:
```typescript
// app/chat/loading.tsx
import { MessageSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <MessageSkeleton />
      <MessageSkeleton />
      <MessageSkeleton />
    </div>
  );
}
```

#### Step 7.3: Improve Empty States

Create `components/empty-state.tsx`:
```typescript
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-gray-100 p-6 mb-4">
        <Icon className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

Use in pages:
```typescript
// app/documents/page.tsx
import { EmptyState } from '@/components/empty-state';
import { FileText } from 'lucide-react';

export default function DocumentsPage() {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Upload your first document to get started with AI-powered search and chat."
        action={{
          label: "Upload Document",
          onClick: () => router.push('/documents/upload')
        }}
      />
    );
  }

  // ... render documents
}
```

#### Step 7.4: Add Keyboard Shortcuts

Create `lib/hooks/use-keyboard-shortcuts.ts`:
```typescript
import { useEffect } from 'react';

export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        shortcuts['search']?.();
      }

      // Cmd/Ctrl + N for new chat
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault();
        shortcuts['newChat']?.();
      }

      // Cmd/Ctrl + U for upload
      if ((event.metaKey || event.ctrlKey) && event.key === 'u') {
        event.preventDefault();
        shortcuts['upload']?.();
      }

      // Escape to close modals
      if (event.key === 'Escape') {
        shortcuts['escape']?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
```

Use in app:
```typescript
// app/layout.tsx
'use client';

import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { useRouter } from 'next/navigation';

export default function RootLayout({ children }) {
  const router = useRouter();

  useKeyboardShortcuts({
    search: () => {
      // Open search modal
    },
    newChat: () => {
      router.push('/chat?new=true');
    },
    upload: () => {
      router.push('/documents/upload');
    },
  });

  return <>{children}</>;
}
```

#### Step 7.5: Accessibility Improvements

Add ARIA labels and keyboard navigation:
```typescript
// Example: Update button components
<Button
  aria-label="Delete conversation"
  onClick={handleDelete}
>
  <Trash2 className="w-4 h-4" />
</Button>

// Add focus management
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  {/* Content */}
</div>
```

Install and run accessibility audit:
```bash
npm install --save-dev @axe-core/react
```

Add to development:
```typescript
// app/layout.tsx (development only)
if (process.env.NODE_ENV !== 'production') {
  import('@axe-core/react').then(axe => {
    axe.default(React, ReactDOM, 1000);
  });
}
```

**Action Items:**
- [ ] Add message actions (copy, regenerate, feedback) to `components/chat/message.tsx`
- [ ] Create skeleton loader components in `components/ui/skeleton.tsx`
- [ ] Add loading states to all pages
- [ ] Create `components/empty-state.tsx`
- [ ] Add empty states to all list pages
- [ ] Create `lib/hooks/use-keyboard-shortcuts.ts`
- [ ] Implement keyboard shortcuts app-wide
- [ ] Add ARIA labels to all interactive elements
- [ ] Add keyboard navigation support
- [ ] Install and run axe accessibility audit
- [ ] Fix accessibility issues found
- [ ] Add focus indicators for keyboard navigation

**Acceptance Criteria:**
- ✅ Message actions visible on hover
- ✅ Copy to clipboard works
- ✅ Regenerate response works
- ✅ Skeleton loaders on all loading states
- ✅ Empty states with clear CTAs
- ✅ Keyboard shortcuts work (Cmd+K, Cmd+N, Cmd+U)
- ✅ All interactive elements keyboard accessible
- ✅ ARIA labels present
- ✅ No critical accessibility issues

---

### 8. Documentation

**Goal:** Comprehensive documentation for developers and users

#### Step 8.1: API Documentation

Create `docs/API.md`:
```markdown
# SmartSpace API Documentation

## Authentication

All API routes require authentication via Supabase Auth.

## Endpoints

### Chat

#### POST /api/chat
Send a chat message and receive a streaming response.

**Request:**
```json
{
  "message": "What is the capital of France?",
  "conversationId": "uuid",
  "model": "gpt-4",
  "temperature": 0.7,
  "includeWebSearch": false
}
```

**Response:** Server-Sent Events (SSE) stream
```
data: {"type": "chunk", "content": "The"}
data: {"type": "chunk", "content": " capital"}
data: {"type": "done"}
```

**Error Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {}
  }
}
```

---

### Documents

#### GET /api/documents
List all documents for the authenticated user.

**Query Parameters:**
- `cursor` (optional): Pagination cursor
- `limit` (optional): Number of results (default: 20, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My Document",
      "status": "completed",
      "created_at": "2025-11-28T12:00:00Z"
    }
  ],
  "nextCursor": "2025-11-28T11:00:00Z",
  "hasMore": true
}
```

#### POST /api/documents
Upload a new document.

**Request:** multipart/form-data
- `file`: File (PDF, TXT, HTML)
- `title` (optional): Document title
- `description` (optional): Document description

**Response:**
```json
{
  "document": {
    "id": "uuid",
    "title": "My Document",
    "status": "processing"
  }
}
```

---

### Search

#### POST /api/search
Search documents using semantic search.

**Request:**
```json
{
  "query": "machine learning algorithms",
  "limit": 10,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "content": "Machine learning is...",
      "documentId": "uuid",
      "documentTitle": "ML Guide",
      "score": 0.92
    }
  ]
}
```

---

## Error Codes

| Code | Description | Status Code |
|------|-------------|-------------|
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Invalid input | 400 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

## Rate Limits

- API routes: 100 requests/minute
- Chat: 20 messages/minute
- Document upload: 10 uploads/hour
```

#### Step 8.2: Architecture Documentation

Create `docs/ARCHITECTURE.md`:
```markdown
# SmartSpace Architecture

## Overview

SmartSpace is built as an Electron desktop application with a Next.js frontend and Supabase backend.

## System Architecture

```
┌─────────────────────────────────────────────┐
│           Electron Main Process             │
│  ┌────────────┐  ┌────────────────────────┐ │
│  │   System   │  │     Auth Handler        │ │
│  │    Tray    │  │  (OAuth Callbacks)      │ │
│  └────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│        Electron Renderer (Next.js)          │
│  ┌────────────────────────────────────────┐ │
│  │          React Frontend                 │ │
│  │  ┌──────────┐  ┌──────────────────┐   │ │
│  │  │   Chat   │  │    Documents      │   │ │
│  │  └──────────┘  └──────────────────┘   │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │       Next.js API Routes                │ │
│  │  ┌──────────┐  ┌──────────────────┐   │ │
│  │  │ /api/chat│  │ /api/documents    │   │ │
│  │  └──────────┘  └──────────────────┘   │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│              External Services               │
│  ┌───────────┐  ┌─────────┐  ┌──────────┐  │
│  │ Supabase  │  │ OpenAI  │  │   Groq   │  │
│  │(Postgres) │  │   API   │  │   API    │  │
│  └───────────┘  └─────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

## Key Components

### Frontend Architecture
- **Framework:** Next.js 14 with App Router
- **UI Library:** shadcn/ui (Radix UI + TailwindCSS)
- **State Management:** React Context + Server State
- **Styling:** TailwindCSS

### Backend Architecture
- **API Layer:** Next.js Route Handlers + Server Actions
- **Database:** PostgreSQL (via Supabase)
- **Vector Store:** PGVector extension
- **Auth:** Supabase Auth with JWT

### Data Flow: Chat

```
User Input → Chat Interface → POST /api/chat
                                    ↓
                        Validate & Auth Check
                                    ↓
                        Retrieve Relevant Context
                        (Vector Search + LLM Filter)
                                    ↓
                          LLM Provider (Streaming)
                                    ↓
                    Stream Response to Client (SSE)
                                    ↓
                         Update UI + Save Message
```

### Data Flow: Document Ingestion

```
File Upload → POST /api/documents
                      ↓
              Save to Database (pending)
                      ↓
            Background Processing Job
                      ↓
        ┌─────────────┴─────────────┐
        ↓                           ↓
   Parse Content              Extract Text
        ↓                           ↓
   Chunk Document             Token Counting
        ↓                           ↓
   Generate Embeddings       Cache Embeddings
        ↓                           ↓
   Store in Vector DB        Update Status
```

## Database Schema

### Core Tables

**documents**
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key)
- `title`: TEXT
- `content`: TEXT
- `status`: ENUM (pending, processing, completed, failed)
- `created_at`: TIMESTAMPTZ

**document_chunks**
- `id`: UUID (primary key)
- `document_id`: UUID (foreign key)
- `content`: TEXT
- `embedding`: VECTOR(1536)
- `chunk_index`: INTEGER
- `token_count`: INTEGER

**conversations**
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key)
- `title`: TEXT
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

**messages**
- `id`: UUID (primary key)
- `conversation_id`: UUID (foreign key)
- `role`: ENUM (user, assistant)
- `content`: TEXT
- `created_at`: TIMESTAMPTZ

## Security

### Authentication
- JWT-based auth via Supabase
- OAuth flow handled by Electron protocol handler
- Tokens stored securely using Electron's safeStorage

### Authorization
- Row-Level Security (RLS) on all tables
- Users can only access their own data
- RLS policies enforced at database level

### Data Protection
- All API routes require authentication
- Rate limiting on all endpoints
- Input validation with Zod schemas
- CORS restricted to allowed origins

## Performance Optimizations

### Caching
- **Embedding Cache:** LRU cache (1000 entries, 60min TTL)
- **Relevance Score Cache:** In-memory cache for LLM scores

### Database
- Indexes on frequently queried columns
- Cursor-based pagination for large result sets
- Connection pooling

### Frontend
- React Server Components for server-side rendering
- Streaming for chat responses
- Code splitting (planned)

## Deployment

### Development
```bash
npm run dev        # Start Next.js dev server
npm run electron   # Start Electron in dev mode
```

### Production
```bash
npm run build          # Build Next.js app
npm run electron:build # Build Electron app
```

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GROQ_API_KEY`

Optional:
- `UPSTASH_REDIS_REST_URL` (for rate limiting)
- `SENTRY_DSN` (for error tracking)
```

#### Step 8.3: User Guide

Create `docs/USER_GUIDE.md`:
```markdown
# SmartSpace User Guide

## Getting Started

### Installation

1. Download SmartSpace for your platform (macOS, Windows, Linux)
2. Install the application
3. Launch SmartSpace
4. Create an account or sign in

### First Steps

1. **Upload Documents**
   - Click "Documents" in the sidebar
   - Click "Upload Document"
   - Select a PDF, TXT, or HTML file
   - Wait for processing to complete

2. **Start Chatting**
   - Click "Chat" in the sidebar
   - Type your question
   - SmartSpace will search your documents and provide an answer

3. **Search Documents**
   - Click "Search" in the sidebar
   - Enter your search query
   - View relevant results from your documents

## Features

### Chat

Chat with AI using your documents as context.

**Tips:**
- Ask specific questions for better results
- Reference document titles for targeted search
- Use follow-up questions to drill deeper

**Example queries:**
- "What are the key findings in the Q4 report?"
- "Summarize the machine learning section"
- "Compare the recommendations from both papers"

### Document Management

Upload and organize your documents.

**Supported formats:**
- PDF (`.pdf`)
- Plain text (`.txt`)
- HTML (`.html`)

**Limits:**
- Max file size: 10MB
- Max uploads: 10 per hour

### Search

Semantic search across all your documents.

**How it works:**
- Searches using AI embeddings (not just keywords)
- Finds conceptually similar content
- Ranks results by relevance

### Settings

Customize your experience.

**Available settings:**
- Default LLM model
- Temperature (creativity)
- Search settings
- Theme (coming soon)

## Keyboard Shortcuts

- `Cmd/Ctrl + K`: Open search
- `Cmd/Ctrl + N`: New chat
- `Cmd/Ctrl + U`: Upload document
- `Esc`: Close modals

## Troubleshooting

### Document processing failed

**Possible causes:**
- File is corrupted
- File is too large (> 10MB)
- Unsupported file format

**Solution:**
- Try re-uploading
- Check file format
- Reduce file size

### Chat not finding relevant documents

**Possible causes:**
- Documents not fully processed
- Query too vague
- No relevant documents

**Solution:**
- Wait for processing to complete
- Be more specific in your query
- Upload more relevant documents

### Authentication issues

**Solution:**
- Check internet connection
- Try logging out and back in
- Contact support

## Privacy & Data

- All data stored securely in Supabase
- Documents are private to your account
- Data encrypted in transit and at rest
- You can delete your data anytime

## Support

- Email: support@smartspace.app
- GitHub: github.com/yourusername/smartspace
- Documentation: docs.smartspace.app
```

#### Step 8.4: Contributing Guide

Create `CONTRIBUTING.md`:
```markdown
# Contributing to SmartSpace

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/smartspace.git
cd smartspace
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

4. Run development server:
```bash
npm run dev
```

## Project Structure

```
smartspace/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── chat/           # Chat page
│   └── documents/      # Documents page
├── components/         # React components
│   ├── ui/            # UI components (shadcn)
│   └── chat/          # Chat-specific components
├── lib/               # Utility functions
│   ├── chat/          # Chat logic
│   ├── retrieval/     # RAG pipeline
│   ├── cache/         # Caching
│   └── supabase/      # Database client
├── electron/          # Electron main process
└── supabase/          # Database migrations
```

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Define interfaces for props and data

### React
- Use functional components
- Use hooks for state management
- Keep components small and focused

### Naming Conventions
- Components: PascalCase (`ChatInterface.tsx`)
- Files: kebab-case (`chat-interface.tsx`)
- Functions: camelCase (`generateEmbedding`)
- Constants: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)

### Code Style
- Use Prettier for formatting
- Use ESLint for linting
- Follow existing code patterns

## Testing

- Write tests for new features
- Run tests before committing:
```bash
npm test
```

- Aim for >= 60% code coverage

## Commit Messages

Use conventional commits:
```
feat: Add conversation management
fix: Fix embedding cache collision detection
docs: Update API documentation
test: Add tests for chat memory
refactor: Simplify retry logic
```

## Pull Request Process

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes
3. Write tests
4. Run linter and tests:
```bash
npm run lint
npm test
```

5. Commit your changes
6. Push to your fork
7. Open a pull request

### PR Guidelines
- Reference related issues
- Describe your changes
- Include screenshots for UI changes
- Ensure CI passes

## Code Review

All submissions require review. We aim to review PRs within 48 hours.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
```

**Action Items:**
- [ ] Create `docs/API.md` with all endpoints
- [ ] Create `docs/ARCHITECTURE.md` with diagrams
- [ ] Create `docs/USER_GUIDE.md` for end users
- [ ] Create `CONTRIBUTING.md` for developers
- [ ] Add JSDoc comments to complex functions
- [ ] Create architecture diagram (use Excalidraw or similar)
- [ ] Set up documentation site (optional: Docusaurus, MkDocs)

**Acceptance Criteria:**
- ✅ All API endpoints documented with examples
- ✅ Architecture documented with diagrams
- ✅ User guide covers all features
- ✅ Contributing guide explains setup and workflow
- ✅ Complex functions have JSDoc comments

---

## Tier 4: Nice-to-Have

> **Priority:** Advanced features for future enhancement
> **Estimated Time:** 5-8 days

### 9. Performance Optimization

#### Code Splitting
- Implement React.lazy() for route-based code splitting
- Lazy load heavy components (PDF viewer, markdown renderer)
- Analyze bundle size with `@next/bundle-analyzer`

#### Caching Strategy
- Add React Server Component caching
- Implement stale-while-revalidate for documents
- Cache expensive computations

#### Service Worker
- Add offline support
- Cache static assets
- Background sync for failed requests

### 10. Advanced Features

#### Hybrid Search
- Implement BM25 full-text search
- Combine with vector search
- Weight and merge results

#### Real-time Updates
- Use Supabase Realtime for live updates
- Update UI when documents finish processing
- Show typing indicators in chat

#### User Profile Management
- Add `/settings/profile` page
- Allow updating name, email, password
- Show usage statistics

#### Export Conversations
- Add "Export as Markdown" button
- Add "Export as PDF" option
- Support conversation templates

---

## Technical Debt

### Console Logging
- **Issue:** 98 console.log calls throughout codebase
- **Action:** Replace with structured logger
- **Priority:** Medium
- **Files:** All files with console.log

### Large Components
- **Issue:** Some components > 300 lines
- **Action:** Extract hooks and sub-components
- **Priority:** Low
- **Files:** `components/chat/chat-interface.tsx`

### Code Organization
- **Issue:** Some utilities could be better organized
- **Action:** Group related functions
- **Priority:** Low

---

## Project Maturity Scorecard

Track progress toward production readiness:

| Category | Current | Target | Status |
|----------|---------|--------|--------|
| **Core Features** | 9/10 | 9/10 | ✅ Complete |
| **Architecture** | 8/10 | 8/10 | ✅ Complete |
| **Code Quality** | 7/10 | 8/10 | 🟡 In Progress |
| **Testing** | 2/10 | 8/10 | 🔴 Critical |
| **Error Handling** | 5/10 | 8/10 | 🔴 Critical |
| **Documentation** | 7/10 | 9/10 | 🟡 In Progress |
| **Security** | 6/10 | 9/10 | 🔴 Critical |
| **Performance** | 8/10 | 9/10 | 🟡 In Progress |
| **UI/UX** | 7/10 | 9/10 | 🟡 In Progress |
| **Production Ready** | 6/10 | 9/10 | 🔴 Blocked |

**Overall Maturity: 6.5/10 → Target: 8.5/10**

---

## Quick Start Checklist

Use this checklist to get started immediately:

### Week 1: Foundation
- [ ] Install Jest and testing dependencies
- [ ] Configure Jest for Next.js
- [ ] Write tests for chat memory manager
- [ ] Write tests for LLM-verified filter
- [ ] Write tests for embedding cache
- [ ] Create error types and handler
- [ ] Add Zod validation to API routes
- [ ] Create error boundary component
- [ ] Replace console.log with structured logger

### Week 2: Security & Data
- [ ] Fix CORS configuration
- [ ] Set up Upstash Redis
- [ ] Implement rate limiting
- [ ] Improve file upload security
- [ ] Review RLS policies
- [ ] Install and configure Sentry
- [ ] Install Vercel Analytics
- [ ] Add database indexes
- [ ] Implement pagination

### Week 3: Features & Polish
- [ ] Create conversation sidebar component
- [ ] Build conversation API routes
- [ ] Add database migration for conversations
- [ ] Add message actions (copy, regenerate)
- [ ] Create skeleton loaders
- [ ] Improve empty states
- [ ] Implement keyboard shortcuts
- [ ] Accessibility audit

### Week 4: Documentation & Launch
- [ ] Write API documentation
- [ ] Create architecture diagram
- [ ] Write user guide
- [ ] Write contributing guide
- [ ] Create performance dashboard
- [ ] Set up monitoring alerts
- [ ] Final testing and QA
- [ ] Deploy to production

---

## Maintenance & Updates

### Daily
- Monitor error rates in Sentry
- Check performance metrics
- Respond to user issues

### Weekly
- Review and merge pull requests
- Update dependencies
- Check database performance
- Review security logs

### Monthly
- Analyze usage patterns
- Plan new features
- Refactor technical debt
- Update documentation

---

## Resources

### Internal Docs
- [README.md](../README.md) - Setup and installation
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md) - Original roadmap
- [ELECTRON_README.md](../ELECTRON_README.md) - Electron features
- [LOGGING.md](../LOGGING.md) - Development logging

### External Resources
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Electron Docs](https://www.electronjs.org/docs)

---

## Questions?

If you have questions about this roadmap or need clarification on any tasks:
1. Open an issue on GitHub
2. Review the existing documentation
3. Check the code comments
4. Ask in the team chat

**Last Updated:** 2025-11-28
**Version:** 1.0
 