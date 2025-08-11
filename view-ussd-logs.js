const { knex } = require('./database');

async function viewLogs() {
    try {
        console.log('Fetching all USSD logs...');
        const logs = await knex('ussd_logs').select('*');
        console.table(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
    } finally {
        await knex.destroy();
    }
}

viewLogs();