require('dotenv').config();
const express = require('express');
const { knex, setupDatabase } = require('./database');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const menuHandlers = require('./ussd-menus.js');

// --- Define Token Costs ---
const NGN_TO_TOKEN_RATE = 1;         // 1 NGN = 1 Token
const SMS_TOKEN_COST = 10;           // Your price per SMS in tokens
const USSD_INTERVAL_TOKEN_COST = 20; // Your default USSD price in tokens

// --- Initialize Africa's Talking SDK ---
const options = {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
};

// --- ADD THIS BLOCK FOR DEBUGGING ---
// console.log("===================================");
// console.log("INITIALIZING AFRICA'S TALKING SDK");
// console.log("Using Username:", options.username);
// console.log("Using API Key:", options.apiKey);
// console.log("===================================");
// ------------------------------------
const africastalking = require('africastalking')(options);
// console.log("Available AT Services:", africastalking);

setupDatabase();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// --- THIS IS THE MISSING ROUTE ---
// It serves your main registration page as the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// ------------------------------------


// --- AUTHENTICATION ROUTES ---
app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    try {
        const userCount = await knex('clients').count('id as count').first();
        const isAdmin = userCount.count === 0;
        const hashedPassword = await bcrypt.hash(password, 10);
        const apiKey = crypto.randomBytes(16).toString('hex');
        const newClient = { name, email, password: hashedPassword, api_key: apiKey, is_admin: isAdmin };
        const [insertedClient] = await knex('clients').insert(newClient).returning(['id', 'name', 'email']);
        console.log(`New client registered: ${insertedClient.name}${isAdmin ? ' (as ADMIN)' : ''}`);
        res.status(201).json({ message: 'Registration successful!', client: insertedClient });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'A user with this email already exists.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'An error occurred during registration.' });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    try {
        const client = await knex('clients').where({ email }).first();
        if (!client || !(await bcrypt.compare(password, client.password))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const token = jwt.sign({ id: client.id, name: client.name, isAdmin: client.is_admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful!', token, isAdmin: client.is_admin });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Requires admin access.' });
    }
};

// --- CLIENT API ROUTES ---
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const clientId = req.user.id;
        
        // --- NEW: Calculate Statistics ---
        const smsCount = await knex('sms_logs').where({ client_id: clientId }).count('id as count').first();
        const airtimeCount = await knex('airtime_logs').where({ client_id: clientId }).count('id as count').first();
        const ussdCostSum = await knex('ussd_logs').where({ client_id: clientId }).sum('client_price as total').first();

        const stats = {
            totalSmsSent: smsCount.count,
            totalAirtimeSent: airtimeCount.count,
            totalUssdTokensSpent: ussdCostSum.total || 0
        };
        // -----------------------------

        const [client, sms_logs, airtime_logs, ussd_logs, transactions] = await Promise.all([
            knex('clients').where({ id: clientId }).first(),
            knex('sms_logs').where({ client_id: clientId }).orderBy('logged_at', 'desc').limit(5), // Get last 5
            knex('airtime_logs').where({ client_id: clientId }).orderBy('logged_at', 'desc').limit(5),
            knex('ussd_logs').where({ client_id: clientId }).orderBy('logged_at', 'desc').limit(5),
            knex('transactions').where({ client_id: clientId }).orderBy('created_at', 'desc').limit(5)
        ]);

        if (!client) {
            return res.status(404).json({ error: 'Client not found.' });
        }

        res.status(200).json({ client, stats, sms_logs, airtime_logs, ussd_logs, transactions }); // Add stats to response

    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
    const clientId = req.user.id;
    const { name, password } = req.body;

    if (!name && !password) {
        return res.status(400).json({ error: 'At least a name or password is required.' });
    }

    try {
        const updateData = {};
        if (name) {
            updateData.name = name;
        }
        if (password) {
            // Securely hash the new password before saving
            updateData.password = await bcrypt.hash(password, 10);
        }

        await knex('clients').where({ id: clientId }).update(updateData);

        res.status(200).json({ message: 'Profile updated successfully.' });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// --- Import Paystack at the top ---
const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);

// We need a Naira-to-Token conversion rate
//const NGN_TO_TOKEN_RATE = 4; // 1 NGN = 4 Tokens

// --- Add these new routes, e.g., after the client API routes ---

// 1. Endpoint to START a transaction
app.post('/api/billing/initialize', authenticateToken, async (req, res) => {
    const clientId = req.user.id;
    const { amount } = req.body; // Amount in NGN

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'A valid amount is required.' });
    }

    try {
        const client = await knex('clients').where({ id: clientId }).first();
        const reference = crypto.randomBytes(16).toString('hex');
        const tokensPurchased = Math.floor(amount * NGN_TO_TOKEN_RATE);
        
        // Log the pending transaction
        await knex('transactions').insert({
            client_id: clientId,
            reference: reference,
            amount: amount,
            tokens_purchased: tokensPurchased,
            status: 'Pending'
        });

        // Initialize payment with Paystack
        const paystackResponse = await paystack.transaction.initialize({
            email: client.email,
            amount: amount * 100, // Paystack expects amount in kobo
            reference: reference,
            callback_url: `${process.env.APP_URL}/dashboard.html` // URL to return to after payment
        });
        
        res.status(200).json(paystackResponse.data);

    } catch (error) {
        console.error("Payment initialization error:", error);
        res.status(500).json({ error: "Failed to start payment process." });
    }
});

// 2. Endpoint to receive confirmation from Paystack (Webhook)
app.post('/billing/webhook', async (req, res) => {
    // We'll add webhook verification logic later for security
    const event = req.body;

    if (event.event === 'charge.success') {
        const reference = event.data.reference;
        
        try {
            await knex.transaction(async (trx) => {
                const transaction = await trx('transactions')
                    .where({ reference: reference, status: 'Pending' })
                    .first();

                if (transaction) {
                    // Update transaction status
                    await trx('transactions')
                        .where({ id: transaction.id })
                        .update({ status: 'Success' });
                    
                    // Add tokens to the client's wallet
                    await trx('clients')
                        .where({ id: transaction.client_id })
                        .increment('token_balance', transaction.tokens_purchased);
                    
                    console.log(`Tokens credited for transaction: ${reference}`);
                }
            });
        } catch (error) {
            console.error("Webhook processing error:", error);
        }
    }

    res.sendStatus(200); // Always send a 200 OK to Paystack
});

app.post('/api/sendsms', authenticateToken, async (req, res) => {
    const clientId = req.user.id;
    const { to, message } = req.body;
    const recipientList = to.split('\n').map(num => num.trim()).filter(num => num);

    if (recipientList.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one valid recipient number.' });
    }

    try {
        const client = await knex('clients').where({ id: clientId }).first();
        const totalTokenCost = recipientList.length * SMS_TOKEN_COST;

        if (client.token_balance < totalTokenCost) {
            return res.status(402).json({ error: `Insufficient token balance...` });
        }

        // --- THE KEY CHANGE ---
        // Check if the client has an approved Sender ID.
        if (!client.sender_id) {
            return res.status(400).json({ error: 'No Sender ID has been approved for your account. Please contact support.' });
        }
        
        const toCommaSeparated = recipientList.join(',');
        
        // Use the client's sender_id in the 'from' field
        const result = await africastalking.SMS.send({
            to: toCommaSeparated,
            message: message,
            from: client.sender_id 
        });
        // --------------------

        const successfulRecipients = result.SMSMessageData.Recipients.filter(r => r.messageId.startsWith('ATX'));

        if (successfulRecipients.length > 0) {
            await knex('clients').where({ id: clientId }).decrement('token_balance', totalTokenCost);
            // ... (rest of the logging logic is the same)
        } else {
             return res.status(400).json({ error: 'Message failed to send. Please check the recipient number.' });
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Bulk SMS sending error:', error.message);
        res.status(500).json({ error: 'An internal server error occurred while sending SMS.' });
    }
});

app.post('/api/sendairtime', authenticateToken, async (req, res) => {
    const clientId = req.user.id;
    const { phoneNumber, amount } = req.body;
    if (!phoneNumber || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid phoneNumber and a positive amount are required.' });
    }
    try {
        const client = await knex('clients').where({ id: clientId }).first();
        const tokenCost = Math.ceil(amount);
        if (client.token_balance < tokenCost) {
            return res.status(402).json({ error: `Insufficient token balance. You need ${tokenCost} tokens for this transaction, but you only have ${client.token_balance}.` });
        }
        const options = { recipients: [{ phoneNumber, currencyCode: 'NGN', amount }] };
        const result = await africastalking.AIRTIME.send(options);
        const response = result.responses[0];
        if (result && result.responses && result.responses.length > 0) {
            const response = result.responses[0];
            if (response.status === 'Sent' || response.status === 'Success') {
                await knex('clients').where({ id: clientId }).decrement('token_balance', tokenCost);
                await knex('airtime_logs').insert({
                    client_id: clientId,
                    phone_number: phoneNumber,
                    amount: `NGN ${amount}`,
                    request_id: response.requestId,
                    status: response.status,
                });
                console.log(`Airtime sent and client ${clientId} billed ${tokenCost} tokens.`);
            }
        }
        res.status(200).json(result);
    } catch (error) {
        console.error('Airtime sending error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// --- USSD ROUTES ---
app.post('/ussd_callback', async (req, res) => {
    const { sessionId, phoneNumber, text, serviceCode } = req.body;

    try {
        const client = await knex('clients').where({ ussd_code: serviceCode }).first();
        if (!client) return res.send('END This service code is not active.');

        // Find the correct menu handler for this service code
        const handler = menuHandlers[serviceCode];

        if (!handler) {
            console.warn(`No menu handler found for service code: ${serviceCode}`);
            return res.send('END This service is not configured correctly.');
        }

        // Create the initial log entry if it's the start of the session
        if (text === '') {
            await knex('ussd_logs').insert({
                client_id: client.id, session_id: sessionId, phone_number: phoneNumber, network_code: networkCode, status: 'Pending'
            });
        } else {
            await knex('ussd_logs').where({ session_id: sessionId }).update({ final_user_string: text });
        }

        // Run the handler to get the response
        const response = handler(text, phoneNumber, client);

        res.set('Content-Type: text/plain').send(response);
    } catch (error) {
        console.error('Error in USSD callback:', error);
        res.send('END An error occurred. Please try again.');
    }
});

app.post('/ussd_events_callback', async (req, res) => {
    const { sessionId, status, durationInSeconds, cost } = req.body;

    // Acknowledge the request immediately
    res.status(200).send('Event received.');

    console.log(`Received USSD Event: Session ${sessionId} has status ${status}`);

    // We only bill when the final event arrives
    if ((status !== 'Done' && status !== 'Success') || !sessionId) {
        return console.log("Event status is not final, no action taken.");
    }

    try {
        await knex.transaction(async (trx) => {
            // 1. Find the log entry to get the client_id and network_code
            const logEntry = await trx('ussd_logs').where({ session_id: sessionId }).first();
            
            // If the log is not found or has already been billed, do nothing.
            if (!logEntry || logEntry.status === 'Completed') {
                if (logEntry) console.log(`Session ${sessionId} already processed.`);
                return;
            }

            // 2. Find the price for the network used in the session
            const pricing = await trx('ussd_pricing').where({ network_code: logEntry.network_code }).first();
            
            // 3. If no specific price is found, use a default cost, otherwise use the network-specific price
            const tokensPerInterval = pricing ? pricing.tokens_per_interval : USSD_INTERVAL_TOKEN_COST;

            // 4. Calculate final token cost
            const intervals = Math.ceil(parseInt(durationInSeconds, 10) / 20) || 1;
            const clientTokenCost = intervals * tokensPerInterval;

            // 5. Update the log with the final details
            await trx('ussd_logs')
                .where({ session_id: sessionId })
                .update({
                    duration_seconds: parseInt(durationInSeconds, 10),
                    session_cost: cost,
                    client_price: clientTokenCost,
                    status: 'Completed'
                });

            // 6. Deduct the price from the client's wallet
            await trx('clients')
                .where({ id: logEntry.client_id })
                .decrement('token_balance', clientTokenCost);
            
            console.log(`USSD session ${sessionId} BILLED ${clientTokenCost} tokens to client ${logEntry.client_id}.`);
        });
    } catch (error) {
        console.error('Error processing USSD event:', error);
    }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/clients', authenticateToken, isAdmin, async (req, res) => {
    try {
        const clients = await knex('clients').select('id', 'name', 'is_admin', 'created_at', 'token_balance');
        res.status(200).json(clients);
    } catch (error) {
        console.error('Admin fetch clients error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.post('/api/admin/topup', authenticateToken, isAdmin, async (req, res) => {
    const { clientId, amount } = req.body;
    if (!clientId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid clientId and a positive amount are required.' });
    }
    try {
        await knex('clients').where({ id: clientId }).increment('token_balance', amount);
        res.status(200).json({ message: `Successfully topped up client ${clientId} with ${amount} tokens.` });
    } catch (error) {
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.put('/api/admin/clients/:clientId', authenticateToken, isAdmin, async (req, res) => {
    const { clientId } = req.params; // Get the client ID from the URL parameter
    const { name, ussd_code, sender_id } = req.body; // Get the new data from the request body

    if (!name && !ussd_code) {
        return res.status(400).json({ error: 'At least one field (name or ussd_code) is required to update.' });
    }

    try {
        const updateData = {};
        if (name) updateData.name = name;
        if (ussd_code) updateData.ussd_code = ussd_code;
        if (sender_id) updateData.sender_id = sender_id;

        const updatedCount = await knex('clients')
            .where({ id: clientId })
            .update(updateData);

        if (updatedCount === 0) {
            return res.status(404).json({ error: 'Client not found.' });
        }
        
        console.log(`Admin updated details for client ${clientId}.`);
        res.status(200).json({ message: 'Client updated successfully.' });

    } catch (error) {
        // Handle potential unique constraint error if USSD code is already taken
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'This USSD code is already assigned to another client.' });
        }
        console.error('Update client error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/admin/logs', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [smsLogs, airtimeLogs, ussdLogs, transactions] = await Promise.all([
            knex('sms_logs').join('clients', 'sms_logs.client_id', '=', 'clients.id').select('sms_logs.*', 'clients.name as client_name'),
            knex('airtime_logs').join('clients', 'airtime_logs.client_id', '=', 'clients.id').select('airtime_logs.*', 'clients.name as client_name'),
            knex('ussd_logs').join('clients', 'ussd_logs.client_id', '=', 'clients.id').select('ussd_logs.*', 'clients.name as client_name'),
            // --- ADD THIS QUERY FOR TRANSACTIONS ---
            knex('transactions').join('clients', 'transactions.client_id', '=', 'clients.id').select('transactions.*', 'clients.name as client_name')
        ]);

        res.status(200).json({ smsLogs, airtimeLogs, ussdLogs, transactions }); // Add transactions to the response

    } catch (error) {
        console.error('Admin fetch logs error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/admin/ussd-session/:sessionId', authenticateToken, isAdmin, async (req, res) => {
    const { sessionId } = req.params;
    try {
        const options = { sessionId: sessionId };
        // This is a new Africa's Talking SDK function we are using
        const sessionDetails = await africastalking.ussd.getSessionDetails(options);
        res.status(200).json(sessionDetails);
    } catch (error) {
        console.error('Fetch session details error:', error);
        res.status(500).json({ error: 'Failed to fetch session details from the provider.' });
    }
});

// --- Server Start ---
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));