-- PostgreSQL Migration Script for RAG Search Engine
-- Includes pgvector extension and uuid-ossp for vector embeddings search

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

INSERT INTO documents (id, title, content)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Zerops Architecture', 'Zerops is a developer-first PaaS supporting automatic scaling and private networking.'),
    ('00000000-0000-0000-0000-000000000002', 'ZeroOps Autonomous Engine', 'ZeroOps Engine transforms natural language prompts into spec-compliant Zerops stack topologies.')
ON CONFLICT (id) DO NOTHING;
