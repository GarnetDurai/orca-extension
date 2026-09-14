import React, { useState } from "react";
import { AUTH_TOKEN_KEY, USER_EMAIL_KEY, getDashboardConfig } from "../../config/dashboardConfig";

interface LoginFormProps {
    onLoginSuccess: (email: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password) {
            setError("Please enter both email and password.");
            return;
        }

        setLoading(true);
        try {
            const config = await getDashboardConfig();
            const response = await fetch(`${config.backendUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.token) {
                    if (typeof chrome !== "undefined" && chrome.storage?.local) {
                        await chrome.storage.local.set({
                            [AUTH_TOKEN_KEY]: data.token,
                            [USER_EMAIL_KEY]: email.trim()
                        });
                    }
                    onLoginSuccess(email.trim());
                    return;
                }
                setError("Login failed: Invalid server response.");
            } else if (response.status === 401) {
                setError("Invalid email or password.");
            } else if (response.status === 400) {
                setError("Validation error: Please check your input.");
            } else {
                setError(`Server error (HTTP ${response.status}).`);
            }
        } catch {
            setError("Unable to connect to backend server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-3.5 space-y-3">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Sign In to DSA Tracker
            </h2>

            {error && (
                <div className="p-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded">
                    {error}
                </div>
            )}

            <div>
                <label className="text-[11px] text-slate-400 block mb-1">Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
            </div>

            <div>
                <label className="text-[11px] text-slate-400 block mb-1">Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-medium text-xs rounded transition-colors"
            >
                {loading ? "Signing In..." : "Sign In"}
            </button>
        </form>
    );
};
