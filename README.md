# SmartSpace - AI Knowledge Workspace

A production-grade, AI-powered web application for document ingestion, semantic search, and LLM-powered reasoning.

## Features

### Core Features
- **Document Management**: Upload PDFs, text files, or ingest content from URLs
- **AI-Powered Chat**: Chat with your documents using RAG (Retrieval-Augmented Generation)
- **Adaptive Chat Memory**: Automatically summarizes long conversations and optimizes context windows to stay within model limits
- **Semantic Search**: Search across your documents using vector similarity
- **Multi-Provider LLM Support**: OpenAI, Anthropic, and Groq
- **Analytics Dashboard**: Track usage, tokens, and performance metrics
- **Real-time Streaming**: Get AI responses streamed in real-time

### Advanced Features
- **LLM-Verified Retrieval Filter**: Advanced retrieval pipeline that uses AI to verify chunk relevance before retrieval
  - Score normalization (z-score)
  - Statistical outlier removal
  - Maximal Marginal Relevance (MMR) for diversity
  - Near-duplicate detection and removal
  - LLM-based relevance scoring using Groq
- **Web Search Integration**: Enable OpenAI's built-in web search tool for real-time information (OpenAI provider only)
- **Customizable Settings**: 
  - Custom system prompts
  - Model and provider selection
  - Temperature control
  - Web search toggle
  - LLM-verified retrieval toggle
- **Advanced Vector Search**: 
  - MMR (Maximal Marginal Relevance) for diverse results
  - Near-duplicate detection
  - Score normalization and outlier filtering

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS, shadcn/ui
- **Backend**: Next.js Route Handlers + Server Actions
- **Database**: Supabase PostgreSQL with PGVector
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Vector Search**: PGVector (Supabase)
- **Embeddings**: OpenAI text-embedding-3-small
- **LLM Providers**: OpenAI, Anthropic, Groq

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- API keys for OpenAI, Anthropic, and/or Groq

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd smartspace
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Fill in your environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `OPENAI_API_KEY`: Your OpenAI API key (required for embeddings, optional for chat)
- `ANTHROPIC_API_KEY`: Your Anthropic API key (optional, for chat)
- `GROQ_API_KEY`: Your Groq API key (optional, for chat and LLM-verified retrieval)

**Note**: At minimum, you need `OPENAI_API_KEY` for embeddings. For chat functionality, you need at least one of: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GROQ_API_KEY`. The LLM-verified retrieval feature requires `GROQ_API_KEY`.

4. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL migrations from `supabase/migrations/` in the Supabase SQL editor
   - Enable PGVector extension
   - Create a storage bucket named `documents` with public access
   - Set up the RLS policies for the storage bucket:

     1. Navigate to Storage → Click on the `documents` bucket → Go to "Policies" tab
     2. Click "New Policy" and create the following 4 policies:

     **Policy 1 - Upload:**
     - Policy name: `Users can upload own documents`
     - Allowed operation: `INSERT`
     - Target roles: `authenticated`
     - Policy definition:
       ```sql
       (bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
       ```

     **Policy 2 - Read:**
     - Policy name: `Users can read own documents`
     - Allowed operation: `SELECT`
     - Target roles: `authenticated`
     - Policy definition:
       ```sql
       (bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
       ```

     **Policy 3 - Update:**
     - Policy name: `Users can update own documents`
     - Allowed operation: `UPDATE`
     - Target roles: `authenticated`
     - Policy definition:
       ```sql
       (bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
       ```

     **Policy 4 - Delete:**
     - Policy name: `Users can delete own documents`
     - Allowed operation: `DELETE`
     - Target roles: `authenticated`
     - Policy definition:
       ```sql
       (bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
       ```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3004](http://localhost:3004) in your browser.

## Project Structure

```
smartspace/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/      # Protected dashboard pages
│   └── api/              # API route handlers
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Auth components
│   ├── chat/             # Chat interface components
│   ├── documents/        # Document management components
│   └── layout/           # Layout components
├── lib/                   # Utility libraries
│   ├── supabase/         # Supabase clients
│   ├── auth/             # Auth utilities
│   ├── ingestion/        # Document ingestion pipeline
│   ├── embeddings/       # Embedding generation
│   ├── vector/           # Vector search and retrieval
│   │   ├── search.ts     # Basic vector search
│   │   ├── scoring.ts    # MMR, normalization, deduplication
│   │   ├── filter.ts     # LLM-verified retrieval pipeline
│   │   ├── interceptor.ts # LLM-based relevance scoring
│   │   └── retrieval.ts  # Top-k chunk retrieval
│   ├── llm/              # LLM providers (OpenAI, Anthropic, Groq)
│   ├── rag/              # RAG utilities
│   └── chat/             # Chat utilities (memory management)
├── db/                    # Database schema (Drizzle ORM)
└── supabase/             # Supabase migrations
```

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Upload Documents**: Go to Documents page and upload PDFs, text files, or ingest content from URLs
3. **Wait for Processing**: Documents are automatically processed, chunked, and indexed with vector embeddings
4. **Configure Settings** (optional): Go to Settings page to customize:
   - Your preferred AI model and provider
   - Temperature settings
   - Custom system prompts
   - Enable web search (OpenAI only)
   - Enable LLM-verified retrieval filtering
5. **Chat**: Go to Chat page and ask questions about your documents. The system will:
   - Retrieve relevant document chunks using vector similarity
   - Optionally filter results using LLM-verified retrieval
   - Maintain conversation context with automatic summarization
   - Stream responses in real-time
6. **Search**: Use Semantic Search to find specific information across your documents
7. **Analytics**: View your usage statistics, token consumption, and performance metrics in Analytics

## Deployment

### Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Supabase Production Setup

1. Create a production Supabase project
2. Run migrations
3. Configure storage buckets
4. Set up production auth settings

## Advanced Configuration

### LLM-Verified Retrieval Filter

The LLM-Verified Retrieval Filter is an advanced feature that improves retrieval quality by using AI to verify chunk relevance. When enabled, it:

1. Retrieves top-k chunks (k_max = 10)
2. Normalizes similarity scores using z-score normalization
3. Removes statistical outliers (bottom 15%)
4. Applies Maximal Marginal Relevance (MMR) for diversity
5. Removes near-duplicates (cosine similarity > 0.95)
6. Scores relevance using Groq LLM (0-3 scale)
7. Keeps chunks with relevance score >= 2

Enable this feature in Settings → AI-Powered Retrieval Filtering. Requires `GROQ_API_KEY`.

### Chat Memory System

The adaptive memory system automatically:
- Tracks token usage per model (supports GPT-4, Claude Opus, Sonnet, Haiku, and more)
- Summarizes conversations when they exceed token limits
- Preserves recent messages (last 6 by default)
- Manages context windows dynamically based on model capabilities
- Handles model-specific token limits (up to 1M tokens for Claude Opus)

### Web Search (OpenAI Only)

When using OpenAI as your provider, you can enable web search in Settings. This allows the model to search the web for real-time information beyond your documents. Requires OpenAI provider and is only available with OpenAI's Responses API.

## License

MIT
