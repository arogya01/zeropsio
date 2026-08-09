-- PostgreSQL Migration Script for E-Commerce Platform
-- Manages product catalog, inventory, and order history

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

INSERT INTO products (id, name, price, description)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Developer Workstation', 1999.99, 'High performance cloud developer setup'),
    ('00000000-0000-0000-0000-000000000002', 'ZeroOps Cloud License', 49.00, 'Autonomous PaaS stack deployment subscription')
ON CONFLICT (id) DO NOTHING;
