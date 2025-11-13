# SmartSpace - AI Knowledge Workspace

A production-grade, AI-powered web application for document ingestion, semantic search, and LLM-powered reasoning.

## Features

- **Document Management**: Upload PDFs, text files, or ingest content from URLs
- **AI-Powered Chat**: Chat with your documents using RAG (Retrieval-Augmented Generation)
- **Semantic Search**: Search across your documents using vector similarity
- **Multi-Provider LLM Support**: OpenAI, Anthropic, and Groq
- **Analytics Dashboard**: Track usage, tokens, and performance metrics
- **Real-time Streaming**: Get AI responses streamed in real-time

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
- `OPENAI_API_KEY`: Your OpenAI API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key (optional)
- `GROQ_API_KEY`: Your Groq API key (optional)

4. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL migration from `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor
   - Enable PGVector extension
   - Create a storage bucket named `documents` with public access

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
│   ├── vector/           # Vector search
│   ├── llm/              # LLM providers
│   ├── rag/              # RAG utilities
│   └── chat/             # Chat utilities
├── db/                    # Database schema (Drizzle ORM)
└── supabase/             # Supabase migrations
```

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Upload Documents**: Go to Documents page and upload PDFs or text files
3. **Wait for Processing**: Documents are automatically processed and indexed
4. **Chat**: Go to Chat page and ask questions about your documents
5. **Search**: Use Semantic Search to find specific information
6. **Analytics**: View your usage statistics in Analytics

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

## License

MIT
