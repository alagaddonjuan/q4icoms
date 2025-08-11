const { knex } = require('./database');

// --- IMPORTANT: Change this to the name you just registered ---
const clientNameToMakeAdmin = 'Q4I';

async function makeAdmin() {
    try {
        const updatedCount = await knex('clients')
            .where({ name: clientNameToMakeAdmin })
            .update({ is_admin: true });

        if (updatedCount > 0) {
            console.log(`✅ Successfully made "${clientNameToMakeAdmin}" an admin.`);
        } else {
            console.log(`❌ Could not find a client named "${clientNameToMakeAdmin}".`);
        }
    } catch (error) {
        console.error('Error making admin:', error);
    } finally {
        await knex.destroy();
    }
}

makeAdmin();