document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    let globalAdminData = {};

    const mainContentContainer = document.getElementById('main-admin-content');
    const adminNameSpan = document.getElementById('admin-name-display');
    const logoutButton = document.getElementById('logout-link');
    const editModal = document.getElementById('edit-client-modal');
    const editForm = document.getElementById('edit-client-form');
    const sessionModal = document.getElementById('session-details-modal');
    
    logoutButton.addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem('authToken'); window.location.href = '/login.html'; });
    editModal.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); editModal.close(); });
    sessionModal.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); sessionModal.close(); });
    editForm.addEventListener('submit', handleClientUpdate);

    mainContentContainer.addEventListener('click', (event) => {
        if (event.target.matches('.edit-client-btn')) {
            const clientId = event.target.dataset.clientId;
            openEditModal(parseInt(clientId));
        }
        if (event.target.matches('.view-session-details-link')) {
            event.preventDefault();
            const sessionId = event.target.dataset.sessionId;
            showSessionDetails(sessionId);
        }
    });

    async function fetchAllAdminData() {
        try {
            const [clientsResponse, logsResponse] = await Promise.all([
                fetch('/api/admin/clients', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/admin/logs', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!clientsResponse.ok || !logsResponse.ok) throw new Error('Could not fetch admin data.');
            
            globalAdminData.clients = await clientsResponse.json();
            const logsData = await logsResponse.json();
            
            adminNameSpan.textContent = "Admin"; 
            renderAdminDashboard(logsData);
        } catch (error) {
            console.error('Admin dashboard error:', error);
            alert(error.message);
        }
    }

    function renderAdminDashboard(logsData) {
        mainContentContainer.innerHTML = `
            <div class="d-sm-flex align-items-center justify-content-between mb-4"><h1 class="h3 mb-0 text-gray-800">Admin Dashboard</h1></div>
            <div class="row">
                <div class="col-lg-6">
                    <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Top-Up Client Wallet</h6></div>
                        <div class="card-body">
                            <form id="topup-form">
                                <div class="form-group"><label>Client ID</label><input type="number" id="clientId" class="form-control" required></div>
                                <div class="form-group"><label>Number of Tokens</label><input type="number" id="amount" class="form-control" required></div>
                                <button type="submit" class="btn btn-primary">Add Credit</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Registered Clients</h6></div>
                <div class="card-body"><div class="table-responsive"><table class="table table-bordered" id="clients-table">
                    <thead><tr><th>ID</th><th>Name</th><th>Token Balance</th><th>Admin</th><th>Registered</th><th>Actions</th></tr></thead>
                    <tbody></tbody>
                </table></div></div>
            </div>
            <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">All Payment Transactions</h6></div>
                <div class="card-body"><div class="table-responsive"><table class="table table-bordered" id="all-transactions-table">
                    <thead><tr><th>Client Name</th><th>Amount (NGN)</th><th>Tokens</th><th>Status</th><th>Reference</th><th>Date</th></tr></thead>
                    <tbody></tbody>
                </table></div></div>
            </div>
            <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">All Usage Logs</h6></div>
                <div class="card-body">
                    <h5>SMS Logs</h5><div class="table-responsive"><table class="table table-bordered" id="all-sms-table"><thead><tr><th>Client Name</th><th>Status</th><th>Cost</th><th>Date</th></tr></thead><tbody></tbody></table></div>
                    <h5 class="mt-4">Airtime Logs</h5><div class="table-responsive"><table class="table table-bordered" id="all-airtime-table"><thead><tr><th>Client Name</th><th>Phone Number</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody></tbody></table></div>
                    <h5 class="mt-4">USSD Session Logs</h5><div class="table-responsive"><table class="table table-bordered" id="all-ussd-table"><thead><tr><th>Client Name</th><th>Phone Number</th><th>Final Input</th><th>Cost (Tokens)</th><th>Session ID</th><th>Date</th></tr></thead><tbody></tbody></table></div>
                </div>
            </div>
        `;
        document.getElementById('topup-form').addEventListener('submit', handleTopupSubmit);
        populateClientsTable(globalAdminData.clients);
        populateTransactionsTable(logsData.transactions);
        populateSmsLogsTable(logsData.smsLogs);
        populateAirtimeLogsTable(logsData.airtimeLogs);
        populateUssdLogsTable(logsData.ussdLogs);
    }

    function openEditModal(clientId) {
        const client = globalAdminData.clients.find(c => c.id === clientId);
        if (client) {
            document.getElementById('edit-clientId').value = client.id;
            document.getElementById('edit-name').value = client.name;
            document.getElementById('edit-ussd_code').value = client.ussd_code || '';
            document.getElementById('edit-sender_id').value = client.sender_id || '';
            editModal.showModal();
        }
    }
    
    async function showSessionDetails(sessionId) {
        const modal = document.getElementById('session-details-modal');
        const contentDiv = document.getElementById('session-details-content');
        contentDiv.innerHTML = '<p aria-busy="true">Loading session details...</p>';
        modal.showModal();
        try {
            const response = await fetch(`/api/admin/ussd-session/${sessionId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch session details.');
            const details = await response.json();
            let hopsHtml = '<h4>Session Hops</h4>';
            if (details.hops && details.hops.length > 0) {
                details.hops.forEach((hop, index) => {
                    hopsHtml += `<details><summary>Hop ${index + 1}</summary><ul><li><strong>Time:</strong> ${new Date(hop.timestamp).toLocaleString()}</li><li><strong>User Input:</strong> ${hop.text || 'N/A'}</li><li><strong>App Response:</strong> <pre>${hop.response}</pre></li></ul></details>`;
                });
            } else {
                hopsHtml += '<p>No hops information available.</p>';
            }
            contentDiv.innerHTML = hopsHtml;
        } catch (error) {
            contentDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    }

    async function handleClientUpdate(event) {
        event.preventDefault();
        const clientId = document.getElementById('edit-clientId').value;
        const name = document.getElementById('edit-name').value;
        const ussd_code = document.getElementById('edit-ussd_code').value;
        const sender_id = document.getElementById('edit-sender_id').value;
        try {
            const response = await fetch(`/api/admin/clients/${clientId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({ name, ussd_code, sender_id }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert(result.message);
            editModal.close();
            fetchAllAdminData();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function handleTopupSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const clientId = form.querySelector('#clientId').value;
        const amount = form.querySelector('#amount').value;
        try {
            const response = await fetch('/api/admin/topup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ clientId, amount }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert(result.message);
            form.reset();
            fetchAllAdminData();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    function populateClientsTable() {
        const tableBody = document.querySelector('#clients-table tbody');
        tableBody.innerHTML = '';
        if (!globalAdminData.clients) return;
        globalAdminData.clients.forEach(client => {
            tableBody.innerHTML += `
                <tr>
                    <td>${client.id}</td><td>${client.name}</td><td>${client.token_balance}</td>
                    <td>${client.is_admin ? 'Yes' : 'No'}</td><td>${new Date(client.created_at).toLocaleString()}</td>
                    <td><button class="btn btn-sm btn-primary edit-client-btn" data-client-id="${client.id}">Edit</button></td>
                </tr>
            `;
        });
    }

    function populateSmsLogsTable() {
        const tableBody = document.querySelector('#all-sms-table tbody');
        tableBody.innerHTML = '';
        if (!globalAdminData.smsLogs || globalAdminData.smsLogs.length === 0) { tableBody.innerHTML = '<tr><td colspan="4">No SMS logs found.</td></tr>'; return; }
        globalAdminData.smsLogs.forEach(log => {
            tableBody.innerHTML += `<tr><td>${log.client_name}</td><td>${log.status}</td><td>${log.cost}</td><td>${new Date(log.logged_at).toLocaleString()}</td></tr>`;
        });
    }

    function populateAirtimeLogsTable() {
        const tableBody = document.querySelector('#all-airtime-table tbody');
        tableBody.innerHTML = '';
        if (!globalAdminData.airtimeLogs || globalAdminData.airtimeLogs.length === 0) { tableBody.innerHTML = '<tr><td colspan="5">No Airtime logs found.</td></tr>'; return; }
        globalAdminData.airtimeLogs.forEach(log => {
            tableBody.innerHTML += `<tr><td>${log.client_name}</td><td>${log.phone_number}</td><td>${log.amount}</td><td>${log.status}</td><td>${new Date(log.logged_at).toLocaleString()}</td></tr>`;
        });
    }

    function populateUssdLogsTable() {
        const tableBody = document.querySelector('#all-ussd-table tbody');
        tableBody.innerHTML = '';
        if (!globalAdminData.ussdLogs || globalAdminData.ussdLogs.length === 0) { tableBody.innerHTML = '<tr><td colspan="6">No USSD logs found.</td></tr>'; return; }
        globalAdminData.ussdLogs.forEach(log => {
            const clientPrice = log.client_price ? parseFloat(log.client_price).toFixed(0) : '0';
            tableBody.innerHTML += `
                <tr>
                    <td>${log.client_name}</td>
                    <td>${log.phone_number}</td>
                    <td>${log.final_user_string || ''}</td>
                    <td>${clientPrice} Tokens</td>
                    <td><a href="#" class="view-session-details-link" data-session-id="${log.session_id}">${log.session_id}</a></td>
                    <td>${log.logged_at ? new Date(log.logged_at).toLocaleString() : 'N/A'}</td>
                </tr>
            `;
        });
    }

    function populateTransactionsTable(transactions) {
    const tableBody = document.querySelector('#all-transactions-table tbody');
    tableBody.innerHTML = '';
    if (!transactions || transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No payment transactions found.</td></tr>';
        return;
    }
    transactions.forEach(tx => {
        tableBody.innerHTML += `
            <tr>
                <td>${tx.client_name}</td>
                <td>₦${parseFloat(tx.amount).toFixed(2)}</td>
                <td>${tx.tokens_purchased}</td>
                <td>${tx.status}</td>
                <td>${tx.reference}</td>
                <td>${new Date(tx.created_at).toLocaleString()}</td>
            </tr>
        `;
    });
}
    
    // --- Initial Load ---
    fetchAllAdminData();
});