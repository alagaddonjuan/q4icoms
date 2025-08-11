const knex = require('knex');

const dbConfig = {
    client: 'mysql2',
    connection: {
        host: 'localhost',
        user: 'qgloball_app',      // Your actual DB user
        password: 'P@ssw0rds2479',  // Your actual DB password
        database: 'qgloball_app'  // Your actual DB name
    }
};

const db = knex(dbConfig);

async function setupDatabase() {
    // --- Clients Table ---
    if (!(await db.schema.hasTable('clients'))) {
        await db.schema.createTable('clients', (table) => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.string('email').notNullable().unique();
            table.string('password').notNullable();
            table.string('api_key').notNullable().unique();
            table.string('ussd_code').nullable().unique();
            table.integer('token_balance').defaultTo(0);
            table.string('sender_id').nullable();
            table.boolean('is_admin').defaultTo(false);
            table.timestamp('created_at').defaultTo(db.fn.now());
        });
        console.log("Table 'clients' created successfully.");
    }

    // --- Transactions Table ---
    if (!(await db.schema.hasTable('transactions'))) {
        await db.schema.createTable('transactions', (table) => {
            table.increments('id').primary();
            table.integer('client_id').unsigned().references('id').inTable('clients');
            table.string('reference').notNullable().unique();
            table.decimal('amount', 14, 2).notNullable();
            table.integer('tokens_purchased').notNullable();
            table.string('status').defaultTo('Pending');
            table.timestamp('created_at').defaultTo(db.fn.now());
        });
        console.log("Table 'transactions' created successfully.");
    }

    // --- SMS Logs Table ---
    if (!(await db.schema.hasTable('sms_logs'))) {
        await db.schema.createTable('sms_logs', (table) => {
            table.increments('id').primary();
            table.integer('client_id').unsigned().references('id').inTable('clients');
            table.string('message_id');
            table.string('cost');
            table.string('status');
            table.timestamp('logged_at').defaultTo(db.fn.now());
        });
        console.log("Table 'sms_logs' created successfully.");
    }
    
    // --- Airtime Logs Table ---
    if (!(await db.schema.hasTable('airtime_logs'))) {
        await db.schema.createTable('airtime_logs', (table) => {
            table.increments('id').primary();
            table.integer('client_id').unsigned().references('id').inTable('clients');
            table.string('phone_number').notNullable();
            table.string('amount').notNullable();
            table.string('request_id').notNullable();
            table.string('status');
            table.timestamp('logged_at').defaultTo(db.fn.now());
        });
        console.log("Table 'airtime_logs' created successfully.");
    }

    // --- USSD Logs Table ---
    if (!(await db.schema.hasTable('ussd_logs'))) {
        await db.schema.createTable('ussd_logs', (table) => {
            table.increments('id').primary();
            table.integer('client_id').unsigned().references('id').inTable('clients');
            table.string('session_id').notNullable().unique();
            table.string('phone_number').notNullable();
            table.string('network_code').nullable();
            table.string('final_user_string').nullable();
            table.integer('duration_seconds').nullable();
            table.string('session_cost').nullable();
            table.decimal('client_price', 14, 4).nullable();
            table.string('status').nullable();
            table.timestamp('logged_at').defaultTo(db.fn.now());
        });
        console.log("Table 'ussd_logs' created successfully.");
    }

    // --- USSD Pricing Table ---
    if (!(await db.schema.hasTable('ussd_pricing'))) {
        await db.schema.createTable('ussd_pricing', (table) => {
            table.increments('id').primary();
            table.string('network_code').notNullable().unique();
            table.string('network_name').notNullable();
            table.integer('tokens_per_interval').notNullable();
        });
        console.log("Table 'ussd_pricing' created successfully.");
    }
}

module.exports = {
    knex: db,
    setupDatabase,
};