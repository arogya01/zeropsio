-- PostgreSQL Migration Script for AI Video Clipper
-- Stores clip metadata and Whisper transcription records

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS video_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL,
    start_time INT NOT NULL,
    end_time INT NOT NULL,
    status VARCHAR(64) DEFAULT 'pending' NOT NULL,
    transcript TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_clips_created_at ON video_clips(created_at DESC);

INSERT INTO video_clips (id, title, source_url, start_time, end_time, status, transcript)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Keynote Product Reveal Highlight', 'https://example.com/demo.mp4', 12, 45, 'completed', '[00:12] Welcome to ZeroOps Cloud.')
ON CONFLICT (id) DO NOTHING;
