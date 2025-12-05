document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Store token in localStorage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect to dashboard
            window.location.href = '/dashboard';
        } else {
            messageDiv.textContent = data.message || 'Login failed';
        }
    } catch (error) {
        console.error('Error:', error);
        messageDiv.textContent = 'An error occurred. Please try again.';
    }
});
