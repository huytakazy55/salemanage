const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'salemanage',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- ── Stores ──────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- ── Users ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('super_admin','admin','employee')),
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- ── Categories ──────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(store_id, name)
      );

      -- ── Products ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sku TEXT,
        category_id INTEGER REFERENCES categories(id),
        cost_price NUMERIC(15,0) NOT NULL DEFAULT 0,
        sell_price NUMERIC(15,0) NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 5,
        unit TEXT DEFAULT 'cái',
        image_url TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(store_id, sku)
      );

      -- ── Inventory logs ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        type TEXT NOT NULL CHECK(type IN ('import','export','adjust')),
        quantity INTEGER NOT NULL,
        cost_price NUMERIC(15,0),
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- ── Orders ──────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        order_code TEXT UNIQUE,
        customer_name TEXT,
        customer_phone TEXT,
        total_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
        total_cost NUMERIC(15,0) NOT NULL DEFAULT 0,
        discount NUMERIC(15,0) DEFAULT 0,
        final_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
        profit NUMERIC(15,0) NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'completed',
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- ── Order items ─────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        cost_price NUMERIC(15,0) NOT NULL,
        sell_price NUMERIC(15,0) NOT NULL,
        subtotal NUMERIC(15,0) NOT NULL,
        profit NUMERIC(15,0) NOT NULL
      );

      -- ── Trigger: products.updated_at ────────────────────────────
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS set_product_updated_at ON products;
      CREATE TRIGGER set_product_updated_at
        BEFORE UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

      -- ── Migrations: add store_id to existing tables if missing ──
      ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE;

      -- Fix role check constraint to allow super_admin
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('super_admin','admin','employee'));
    `);
    console.log('✅ Schema initialized');
  } finally {
    client.release();
  }
}

// Helper: run a query with optional params
pool.q = (text, params) => pool.query(text, params);

module.exports = { pool, initSchema };
