document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = event.target.email.value;
const password = event.target.password.value;

try {
    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }), // Send email and password
    });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error);
            }

            // Save the token to localStorage
            localStorage.setItem('authToken', result.token);

            // --- NEW: Check if the user is an admin ---
            if (result.isAdmin) {
                // Redirect to the admin page
                window.location.href = '/admin.html';
            } else {
                // Redirect to the regular client dashboard
                window.location.href = '/dashboard.html';
            }
            // -----------------------------------------

        } catch (error) {
            alert(`Login Failed: ${error.message}`);
        }
    });
});