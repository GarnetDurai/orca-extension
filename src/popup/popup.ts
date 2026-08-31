const BACKEND_LOGIN_URL = "http://localhost:8080/auth/login";
const AUTH_TOKEN_KEY = "authToken";
const USER_EMAIL_KEY = "userEmail";

document.addEventListener("DOMContentLoaded", async () => {
    const loginView = document.getElementById("loginView") as HTMLDivElement;
    const profileView = document.getElementById("profileView") as HTMLDivElement;
    const loginForm = document.getElementById("loginForm") as HTMLFormElement;
    const emailInput = document.getElementById("emailInput") as HTMLInputElement;
    const passwordInput = document.getElementById("passwordInput") as HTMLInputElement;
    const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement;
    const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;
    const statusMsg = document.getElementById("statusMsg") as HTMLDivElement;
    const userEmailDisplay = document.getElementById("userEmailDisplay") as HTMLElement;

    function showStatus(message: string, isError = false): void {
        statusMsg.textContent = message;
        statusMsg.className = "status-message " + (isError ? "status-error" : "status-success");
        statusMsg.style.display = "block";
    }

    function hideStatus(): void {
        statusMsg.style.display = "none";
        statusMsg.textContent = "";
    }

    function renderLoggedIn(email: string): void {
        loginView.style.display = "none";
        profileView.style.display = "block";
        userEmailDisplay.textContent = email;
        hideStatus();
    }

    function renderLoggedOut(): void {
        loginView.style.display = "block";
        profileView.style.display = "none";
        passwordInput.value = "";
        hideStatus();
    }

    // Check existing stored auth token
    try {
        const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
        const email = stored[USER_EMAIL_KEY] as string | undefined;
        const token = stored[AUTH_TOKEN_KEY] as string | undefined;
        if (token && email) {
            renderLoggedIn(email);
        } else {
            renderLoggedOut();
        }
    } catch {
        renderLoggedOut();
    }

    // Handle Login Form Submission
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideStatus();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showStatus("Please enter both email and password.", true);
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "Signing In...";

        try {
            const response = await fetch(BACKEND_LOGIN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = (await response.json()) as { token?: string };
                if (data && data.token) {
                    await chrome.storage.local.set({
                        [AUTH_TOKEN_KEY]: data.token,
                        [USER_EMAIL_KEY]: email
                    });
                    renderLoggedIn(email);
                    return;
                }
                showStatus("Login failed: Invalid server response.", true);
            } else if (response.status === 401) {
                showStatus("Invalid email or password.", true);
            } else if (response.status === 400) {
                showStatus("Validation error: Please check your input.", true);
            } else {
                showStatus(`Server error (HTTP ${response.status}).`, true);
            }
        } catch {
            showStatus("Unable to connect to backend server at localhost:8080.", true);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = "Sign In";
        }
    });

    // Handle Logout
    logoutBtn.addEventListener("click", async () => {
        try {
            await chrome.storage.local.remove([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
        } catch {
            // Ignore error
        }
        renderLoggedOut();
    });
});
