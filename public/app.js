// in public/app.js

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Stop the form from reloading the page

    // Get all form values
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // --- NEW: Password confirmation check ---
    if (password !== confirmPassword) {
        alert("Error: Passwords do not match.");
        return; // Stop the function if passwords don't match
    }
    // ------------------------------------

    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Send the original data, confirmPassword is only for frontend check
            body: JSON.stringify({ name, email, password }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        alert('Registration successful! Please log in.');
        window.location.href = '/login.html';

    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});