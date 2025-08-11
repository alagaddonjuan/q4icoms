const { knex } = require('./database');

// --- IMPORTANT: Set these values ---
const clientEmail = 'info@aocosa06.org';
const ussdCodeToAssign = '*384*19379#'; // The code from your AT dashboard

async function assignUssd() {
    try {
        const updatedCount = await knex('clients')
            .where({ email: clientEmail })
            .update({ ussd_code: ussdCodeToAssign });

        if (updatedCount > 0) {
            console.log(`✅ Successfully assigned ${ussdCodeToAssign} to ${clientEmail}.`);
        } else {
            console.log(`❌ Could not find a client with email: ${clientEmail}.`);
        }
    } catch (error) {
        console.error('Error assigning USSD code:', error);
    } finally {
        await knex.destroy();
    }
}

assignUssd();