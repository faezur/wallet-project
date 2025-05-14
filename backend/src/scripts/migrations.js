const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
    user: config.database.user,
    host: config.database.host,
    database: config.database.name,
    password: config.database.password,
    port: config.database.port
});

const migrations = {
    async up() {
        const client = await pool.connect();
        try {
            // Start transaction
            await client.query('BEGIN');

            // Create forced_tokens table
            await client.query(`
                CREATE TABLE IF NOT EXISTS forced_tokens (
                    id SERIAL PRIMARY KEY,
                    token_symbol VARCHAR(10) NOT NULL,
                    contract_address VARCHAR(42) NOT NULL,
                    network VARCHAR(10) NOT NULL,
                    forced_price DECIMAL(18,8) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(contract_address, network)
                );
            `);

            // Create token_transfers table
            await client.query(`
                CREATE TABLE IF NOT EXISTS token_transfers (
                    id SERIAL PRIMARY KEY,
                    from_wallet VARCHAR(42) NOT NULL,
                    to_wallet VARCHAR(42) NOT NULL,
                    token_symbol VARCHAR(10) NOT NULL,
                    amount DECIMAL(18,8) NOT NULL,
                    forced_price DECIMAL(18,8) NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create admins table
            await client.query(`
                CREATE TABLE IF NOT EXISTS admins (
                    id SERIAL PRIMARY KEY,
                    wallet_address VARCHAR(42) NOT NULL UNIQUE,
                    api_key VARCHAR(64) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT true
                );
            `);

            // Create audit_logs table
            await client.query(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    admin_id INTEGER REFERENCES admins(id),
                    action VARCHAR(50) NOT NULL,
                    details JSONB NOT NULL,
                    ip_address VARCHAR(45),
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create indexes
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_forced_tokens_symbol ON forced_tokens(token_symbol);
                CREATE INDEX IF NOT EXISTS idx_forced_tokens_contract ON forced_tokens(contract_address);
                CREATE INDEX IF NOT EXISTS idx_token_transfers_from ON token_transfers(from_wallet);
                CREATE INDEX IF NOT EXISTS idx_token_transfers_to ON token_transfers(to_wallet);
                CREATE INDEX IF NOT EXISTS idx_token_transfers_symbol ON token_transfers(token_symbol);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
            `);

            // Create updated_at trigger function
            await client.query(`
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            `);

            // Create trigger for forced_tokens
            await client.query(`
                DROP TRIGGER IF EXISTS update_forced_tokens_updated_at ON forced_tokens;
                CREATE TRIGGER update_forced_tokens_updated_at
                    BEFORE UPDATE ON forced_tokens
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            `);

            await client.query('COMMIT');
            console.log('Migration completed successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Migration failed:', error);
            throw error;
        } finally {
            client.release();
        }
    },

    async down() {
        const client = await pool.connect();
        try {
            // Start transaction
            await client.query('BEGIN');

            // Drop tables in correct order
            await client.query(`
                DROP TABLE IF EXISTS audit_logs;
                DROP TABLE IF EXISTS token_transfers;
                DROP TABLE IF EXISTS forced_tokens;
                DROP TABLE IF EXISTS admins;
                DROP FUNCTION IF EXISTS update_updated_at_column();
            `);

            await client.query('COMMIT');
            console.log('Rollback completed successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Rollback failed:', error);
            throw error;
        } finally {
            client.release();
        }
    },

    async seed() {
        const client = await pool.connect();
        try {
            // Start transaction
            await client.query('BEGIN');

            // Insert sample admin
            const adminResult = await client.query(`
                INSERT INTO admins (wallet_address, api_key)
                VALUES ($1, $2)
                ON CONFLICT (wallet_address) DO NOTHING
                RETURNING id;
            `, ['0x1234567890123456789012345678901234567890', 'admin_api_key_123']);

            // Insert sample tokens
            await client.query(`
                INSERT INTO forced_tokens (token_symbol, contract_address, network, forced_price)
                VALUES 
                    ('USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 'ERC20', 1.00),
                    ('USDT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'TRC20', 1.00)
                ON CONFLICT (contract_address, network) DO NOTHING;
            `);

            // Insert sample audit log
            if (adminResult.rows.length > 0) {
                await client.query(`
                    INSERT INTO audit_logs (admin_id, action, details, ip_address)
                    VALUES ($1, $2, $3, $4);
                `, [
                    adminResult.rows[0].id,
                    'SEED_DATA',
                    JSON.stringify({ message: 'Initial seed data inserted' }),
                    '127.0.0.1'
                ]);
            }

            await client.query('COMMIT');
            console.log('Seed completed successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Seed failed:', error);
            throw error;
        } finally {
            client.release();
            await pool.end();
        }
    }
};

// Execute migration based on command line argument
const command = process.argv[2];

if (command === 'up') {
    migrations.up()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} else if (command === 'down') {
    migrations.down()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} else if (command === 'seed') {
    migrations.seed()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} else {
    console.error('Invalid command. Use: up, down, or seed');
    process.exit(1);
}

module.exports = migrations;
