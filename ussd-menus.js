// ussd-menus.js

// --- Menu for your first client (e.g., AOCOSA) ---
function aocosaMenu(text, phoneNumber, client) {
    let response = '';
    if (text === '') {
        response = `CON Welcome to ${client.name}.\n1. My Account\n2. My Phone Number`;
    } else if (text === '1') {
        response = `CON Choose account information\n1. Account Number\n2. Account Balance`;
    } else if (text === '2') {
        response = `END Your phone number is ${phoneNumber}`;
    } else if (text === '1*1') {
        response = `END Your account number is ACC${client.id}`;
    } else if (text === '1*2') {
        response = `END Your account balance is ₦10,000`;
    } else {
        response = 'END Invalid choice';
    }
    return response;
}

// --- Menu for a future client (e.g., Q4I) ---
function q4iMenu(text, phoneNumber, client) {
    let response = '';
    if (text === '') {
        response = `CON Welcome to Q4I Communications.\n1. Check Airtime Balance\n2. Buy Data`;
    } else if (text === '1') {
        response = `END Your Airtime balance is NGN 500.`;
    } else if (text === '2') {
        response = `END Data services are coming soon.`;
    } else {
        response = 'END Invalid selection.';
    }
    return response;
}

// --- A Map to link USSD codes to their menu functions ---
const menuHandlers = {
    '*384*19379#': aocosaMenu,
    '*384*55555#': q4iMenu, // Example for a new client
    // Add more clients here as you get them
};

module.exports = menuHandlers;