document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    let globalData = {};

    // --- Template-specific elements ---
    const mainContentContainer = document.querySelector('#content .container-fluid');
    const userNameSpan = document.getElementById('user-name-display');
    const logoutButton = document.getElementById('logout-link');
    
    // --- Navigation Links ---
    const navDashboard = document.getElementById('nav-dashboard-link');
    const navServices = document.getElementById('nav-services-link');
    const navUssd = document.getElementById('nav-ussd-link');
    const navBilling = document.getElementById('nav-billing-link');
    const navProfile = document.getElementById('top-bar-profile-link');


    // --- Core Data Fetching ---
    async function fetchAllData() {
        try {
            const response = await fetch('/api/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Session expired');
            globalData = await response.json();
            
            if (userNameSpan && globalData.client) {
                userNameSpan.textContent = globalData.client.name;
            }
            renderDashboardView(); 
        } catch (error) {
            localStorage.removeItem('authToken');
            window.location.href = '/login.html';
        }
    }

    // --- RENDER FUNCTIONS FOR EACH VIEW ---

    function renderDashboardView() {
        if (!globalData.client || !globalData.stats) return;
        const balance = globalData.client.token_balance;
        const stats = globalData.stats;
        mainContentContainer.innerHTML = `
            <div class="d-sm-flex align-items-center justify-content-between mb-4"><h1 class="h3 mb-0 text-gray-800">Dashboard</h1></div>
            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4"><div class="card border-left-primary shadow h-100 py-2"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Token Balance</div><div class="h5 mb-0 font-weight-bold text-gray-800">${balance} Tokens</div></div><div class="col-auto"><i class="fas fa-coins fa-2x text-gray-300"></i></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card border-left-success shadow h-100 py-2"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs font-weight-bold text-success text-uppercase mb-1">Total SMS Sent</div><div class="h5 mb-0 font-weight-bold text-gray-800">${stats.totalSmsSent}</div></div><div class="col-auto"><i class="fas fa-comments fa-2x text-gray-300"></i></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card border-left-info shadow h-100 py-2"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs font-weight-bold text-info text-uppercase mb-1">Total Airtime Sent</div><div class="h5 mb-0 font-weight-bold text-gray-800">${stats.totalAirtimeSent}</div></div><div class="col-auto"><i class="fas fa-mobile-alt fa-2x text-gray-300"></i></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card border-left-warning shadow h-100 py-2"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs font-weight-bold text-warning text-uppercase mb-1">USSD Tokens Used</div><div class="h5 mb-0 font-weight-bold text-gray-800">${stats.totalUssdTokensSpent}</div></div><div class="col-auto"><i class="fas fa-hashtag fa-2x text-gray-300"></i></div></div></div></div></div>
            </div>`;
    }

    function renderServicesView() {
        mainContentContainer.innerHTML = `
            <h1 class="h3 mb-2 text-gray-800">Services</h1>
            <div class="row">
                <div class="col-lg-6">
                    <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Send SMS</h6></div><div class="card-body">
                        <form id="sms-form"><div class="form-group"><label>Recipient Numbers (one per line)</label><textarea id="smsTo" class="form-control" rows="5" required></textarea></div><div class="form-group"><label>Message</label><textarea id="smsMessage" class="form-control" rows="3" required></textarea></div><button type="submit" class="btn btn-primary">Send SMS</button></form>
                    </div></div>
                </div>
                <div class="col-lg-6">
                     <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Send Airtime</h6></div><div class="card-body">
                        <form id="airtime-form"><div class="form-group"><label>Phone Number</label><input type="text" id="airtimeTo" class="form-control" required></div><div class="form-group"><label>Amount (NGN)</label><input type="number" id="airtimeAmount" class="form-control" required></div><button type="submit" class="btn btn-primary">Send Airtime</button></form>
                     </div></div>
                </div>
            </div>
            <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Usage Logs</h6></div><div class="card-body">
                <h5>SMS Logs</h5><div class="table-responsive"><table class="table table-bordered" id="sms-usage-table"><thead><tr><th>Date</th><th>Status</th><th>Cost</th></tr></thead><tbody></tbody></table></div>
                <h5 class="mt-4">Airtime Logs</h5><div class="table-responsive"><table class="table table-bordered" id="airtime-usage-table"><thead><tr><th>Date</th><th>Phone Number</th><th>Amount</th><th>Status</th></tr></thead><tbody></tbody></table></div>
            </div></div>`;
        document.getElementById('sms-form').addEventListener('submit', handleSmsSubmit);
        document.getElementById('airtime-form').addEventListener('submit', handleAirtimeSubmit);
        populateSmsLogs();
        populateAirtimeLogs();
    }

    function renderUssdView() {
        const ussdCode = globalData.client?.ussd_code || "None Assigned";
        mainContentContainer.innerHTML = `
            <h1 class="h3 mb-2 text-gray-800">USSD Service</h1>
            <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Your Assigned USSD Code</h6></div><div class="card-body"><p>Your active USSD code is: <strong>${ussdCode}</strong></p></div></div>
            <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">USSD Usage Logs</h6></div><div class="card-body"><div class="table-responsive"><table class="table table-bordered" id="ussd-usage-table">
                <thead><tr><th>Date</th><th>Phone Number</th><th>Final Input</th><th>Status</th><th>Cost (Tokens)</th></tr></thead><tbody></tbody>
            </table></div></div></div>`;
        populateUssdLogs();
    }

    function renderBillingView() {
        mainContentContainer.innerHTML = `
            <h1 class="h3 mb-2 text-gray-800">Billing & Top-Up</h1>
            <div class="row">
                <div class="col-lg-6"><div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Buy Tokens</h6></div><div class="card-body">
                    <form id="payment-form"><div class="form-group"><label>Amount (NGN)</label><input type="number" id="amount" class="form-control" placeholder="1000" required min="100"></div><button type="submit" class="btn btn-primary">Pay Now</button></form>
                </div></div></div>
                <div class="col-lg-6"><div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Conversion Rate</h6></div><div class="card-body"><p>Your price is currently <strong>1 Token</strong> for every <strong>₦1.00</strong>.</p><p><em>Example: ₦1000 = 1000 Tokens</em></p></div></div></div>
            </div>
            <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Your Transaction History</h6></div><div class="card-body"><div class="table-responsive"><table class="table table-bordered" id="transactions-table">
                <thead><tr><th>Date</th><th>Reference</th><th>Amount (NGN)</th><th>Tokens</th><th>Status</th></tr></thead><tbody></tbody>
            </table></div></div></div>`;
        document.getElementById('payment-form').addEventListener('submit', handlePaymentInit);
        populateTransactionsTable();
    }

    function renderProfileView() {
        mainContentContainer.innerHTML = `
            <h1 class="h3 mb-2 text-gray-800">Your Profile</h1>
            <div class="row">
                <div class="col-lg-6"><div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Update Information</h6></div><div class="card-body">
                    <form id="profile-form">
                        <div class="form-group"><label>Company Name</label><input type="text" id="profile-name" class="form-control" required></div>
                        <button type="submit" class="btn btn-primary">Update Name</button>
                    </form>
                </div></div></div>
                <div class="col-lg-6"><div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Change Password</h6></div><div class="card-body">
                    <form id="password-form">
                       <div class="form-group"><label>New Password</label><input type="password" id="profile-password" class="form-control" required></div>
                       <div class="form-group"><label>Confirm New Password</label><input type="password" id="profile-confirm-password" class="form-control" required></div>
                       <button type="submit" class="btn btn-primary">Change Password</button>
                    </form>
                </div></div></div>
            </div>`;
        document.getElementById('profile-name').value = globalData.client.name;
        document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
        document.getElementById('password-form').addEventListener('submit', handlePasswordUpdate);
    }
    
    // --- Handlers & Populators ---
    async function handleSmsSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const to = document.getElementById('smsTo').value;
        const message = document.getElementById('smsMessage').value;
        try {
            const response = await fetch('/api/sendsms', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ to, message }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to send SMS');
            alert('SMS sent successfully!');
            form.reset();
            fetchAllData().then(populateSmsLogs);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function handleAirtimeSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const phoneNumber = document.getElementById('airtimeTo').value;
        const amount = document.getElementById('airtimeAmount').value;
        try {
            const response = await fetch('/api/sendairtime', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ phoneNumber, amount }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to send Airtime');
            alert('Airtime sent successfully!');
            form.reset();
            fetchAllData().then(populateAirtimeLogs);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function handlePaymentInit(event) {
        event.preventDefault();
        const amount = document.getElementById('amount').value;
        try {
            const response = await fetch('/api/billing/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ amount }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            window.location.href = result.authorization_url;
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function handleProfileUpdate(event) {
        event.preventDefault();
        const name = document.getElementById('profile-name').value;
        try {
            const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert('Name updated successfully!');
            fetchAllData();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function handlePasswordUpdate(event) {
        event.preventDefault();
        const password = document.getElementById('profile-password').value;
        const confirmPassword = document.getElementById('profile-confirm-password').value;
        if (password !== confirmPassword) { return alert('Passwords do not match.'); }
        try {
            const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ password }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert('Password changed successfully!');
            event.target.reset();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    function populateSmsLogs() {
        const tableBody = document.querySelector('#sms-usage-table tbody');
        tableBody.innerHTML = '';
        if (!globalData.sms_logs || globalData.sms_logs.length === 0) { tableBody.innerHTML = '<tr><td colspan="3">No SMS usage found.</td></tr>'; return; }
        globalData.sms_logs.forEach(log => { tableBody.innerHTML += `<tr><td>${new Date(log.logged_at).toLocaleString()}</td><td>${log.status}</td><td>${log.cost}</td></tr>`; });
    }

    function populateAirtimeLogs() {
        const tableBody = document.querySelector('#airtime-usage-table tbody');
        tableBody.innerHTML = '';
        if (!globalData.airtime_logs || globalData.airtime_logs.length === 0) { tableBody.innerHTML = '<tr><td colspan="4">No Airtime usage found.</td></tr>'; return; }
        globalData.airtime_logs.forEach(log => { tableBody.innerHTML += `<tr><td>${new Date(log.logged_at).toLocaleString()}</td><td>${log.phone_number}</td><td>${log.amount}</td><td>${log.status}</td></tr>`; });
    }

    function populateUssdLogs() {
        const tableBody = document.querySelector('#ussd-usage-table tbody');
        tableBody.innerHTML = '';
        if (!globalData.ussd_logs || globalData.ussd_logs.length === 0) { tableBody.innerHTML = '<tr><td colspan="5">No USSD usage found.</td></tr>'; return; }
        globalData.ussd_logs.forEach(log => { tableBody.innerHTML += `<tr><td>${new Date(log.logged_at).toLocaleString()}</td><td>${log.phone_number}</td><td>${log.final_user_string || '-'}</td><td>${log.status}</td><td>${log.client_price || 0} Tokens</td></tr>`; });
    }

    function populateTransactionsTable() {
        const tableBody = document.querySelector('#transactions-table tbody');
        tableBody.innerHTML = '';
        if (!globalData.transactions || globalData.transactions.length === 0) { tableBody.innerHTML = '<tr><td colspan="5">No transactions found.</td></tr>'; return; }
        globalData.transactions.forEach(tx => { tableBody.innerHTML += `<tr><td>${new Date(tx.created_at).toLocaleString()}</td><td>${tx.reference}</td><td>₦${parseFloat(tx.amount).toFixed(2)}</td><td>${tx.tokens_purchased}</td><td>${tx.status}</td></tr>`; });
    }

    // --- EVENT LISTENERS for navigation ---
    logoutButton.addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem('authToken'); window.location.href = '/login.html'; });
    navDashboard.addEventListener('click', (e) => { e.preventDefault(); renderDashboardView(); });
    navServices.addEventListener('click', (e) => { e.preventDefault(); renderServicesView(); });
    navUssd.addEventListener('click', (e) => { e.preventDefault(); renderUssdView(); });
    navBilling.addEventListener('click', (e) => { e.preventDefault(); renderBillingView(); });
    navProfile.addEventListener('click', (e) => { e.preventDefault(); renderProfileView(); });
    
    // --- Initial Load ---
    fetchAllData();
});