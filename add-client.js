// Import knex from our database setup
const { knex } = require('./database');
// Import the crypto library to generate a random API key
const crypto = require('crypto');

// Function to add a new client
async function addClient() {
    try {
        // Generate a random 32-character API key
        const apiKey = crypto.randomBytes(16).toString('hex');

        // The new client's details
        const newClient = {
            name: 'Test Client',
            api_key: apiKey,
        };

        // Insert the new client into the 'clients' table
        const [insertedClient] = await knex('clients').insert(newClient).returning('*');

        console.log('✅ Client added successfully!');
        console.log('Client Name:', insertedClient.name);
        console.log('API Key:', insertedClient.api_key); // <-- IMPORTANT!

    } catch (error) {
        console.error('Error adding client:', error);
    } finally {
        // Always destroy the connection pool after the script is done
        await knex.destroy();
    }
}

// Run the function
addClient();