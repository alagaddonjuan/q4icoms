const { knex } = require('./database');

async function viewLogs() {
    try {
        console.log('Fetching all SMS logs...');
        const logs = await knex('sms_logs').select('*');

        if (logs.length === 0) {
            console.log('No logs found.');
        } else {
            console.table(logs); // Display logs in a neat table
        }

    } catch (error) {
        console.error('Error fetching logs:', error);
    } finally {
        await knex.destroy();
    }
}

viewLogs();