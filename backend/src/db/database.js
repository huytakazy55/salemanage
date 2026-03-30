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
      -- ── Branches ──────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- ── Stores ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
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
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(branch_id, name)
      );

      -- ── Products (branch-level, shared across stores) ──────────
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sku TEXT,
        category_id INTEGER REFERENCES categories(id),
        cost_price NUMERIC(15,0) NOT NULL DEFAULT 0,
        sell_price NUMERIC(15,0) NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 5,
        unit TEXT DEFAULT 'cái',
        image_url TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(branch_id, sku)
      );

      -- ── Store stock (per-store quantity) ──────────────────────
      CREATE TABLE IF NOT EXISTS store_stock (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        UNIQUE(product_id, store_id)
      );

      -- ── Inventory logs ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK(type IN ('import','export','adjust','transfer_in','transfer_out')),
        quantity INTEGER NOT NULL,
        cost_price NUMERIC(15,0),
        note TEXT,
        related_store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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

      -- ── Migrations ──────────────────────────────────────────────
      ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE;

      -- Fix role check constraint
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('super_admin','admin','employee'));

      -- Migrate products: add branch_id column (keep store_id for migration reference)
      ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 5;

      -- Populate products.branch_id from stores.branch_id where store_id matches
      UPDATE products p SET branch_id = s.branch_id
        FROM stores s WHERE p.store_id = s.id AND p.branch_id IS NULL AND s.branch_id IS NOT NULL;

      -- Create store_stock table
      CREATE TABLE IF NOT EXISTS store_stock (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        UNIQUE(product_id, store_id)
      );

      -- Migrate existing stock into store_stock (only where store_id is set)
      INSERT INTO store_stock (product_id, store_id, quantity)
        SELECT id, store_id, COALESCE(stock, 0)
        FROM products
        WHERE store_id IS NOT NULL
        ON CONFLICT (product_id, store_id) DO NOTHING;

      -- Add store_id to inventory_logs if missing
      ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL;
      ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS related_store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL;
      ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

      -- Extend inventory_logs type check
      ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_type_check;
      ALTER TABLE inventory_logs ADD CONSTRAINT inventory_logs_type_check
        CHECK(type IN ('import','export','adjust','transfer_in','transfer_out'));

      -- Categories: add branch_id (keep store_id for backward compat)
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
      UPDATE categories c SET branch_id = s.branch_id
        FROM stores s WHERE c.store_id = s.id AND c.branch_id IS NULL AND s.branch_id IS NOT NULL;
    `);
    console.log('✅ Schema initialized');
  } finally {
    client.release();
  }
}

pool.q = (text, params) => pool.query(text, params);

module.exports = { pool, initSchema };
