import React, { useState } from "react";
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_EMAIL_KEY, getDashboardConfig } from "../../config/dashboardConfig";
import { SessionQueueService } from "../../services/sessionQueueService";

interface AuthViewProps {
    onAuthSuccess: (email: string) => void;
    initialMode?: "signin" | "register";
}

export const AuthView: React.FC<AuthViewProps> = ({
    onAuthSuccess,
    initialMode = "signin"
}) => {
    const [mode, setMode] = useState<"signin" | "register">(initialMode);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSwitchToRegister = () => {
        setMode("register");
        setError(null);
        setConfirmPassword("");
    };

    const handleSwitchToSignIn = () => {
        setMode("signin");
        setError(null);
        setConfirmPassword("");
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError("Email is required.");
            return;
        }

        if (!password) {
            setError("Password is required.");
            return;
        }

        setLoading(true);
        try {
            const config = await getDashboardConfig();
            const response = await fetch(`${config.backendUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmedEmail, password })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.token) {
                    if (typeof chrome !== "undefined" && chrome.storage?.local) {
                        const toStore: Record<string, string> = {
                            [AUTH_TOKEN_KEY]: data.token,
                            [USER_EMAIL_KEY]: trimmedEmail
                        };
                        if (data.refreshToken) {
                            toStore[REFRESH_TOKEN_KEY] = data.refreshToken;
                        }
                        await chrome.storage.local.set(toStore);
                    }
                    onAuthSuccess(trimmedEmail);
                    SessionQueueService.flushPendingSessions().catch(() => {});
                    return;
                }
                setError("Login failed: Invalid server response.");
            } else if (response.status === 401) {
                setError("Invalid email or password.");
            } else if (response.status === 400) {
                setError("Validation error: Please check your input.");
            } else {
                setError("Server error occurred. Please try again later.");
            }
        } catch {
            setError("Unable to connect to backend server.");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError("Email is required.");
            return;
        }

        if (!password) {
            setError("Password is required.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const config = await getDashboardConfig();
            const derivedName = trimmedEmail.split("@")[0] || "User";

            const response = await fetch(`${config.backendUrl}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: derivedName,
                    email: trimmedEmail,
                    password
                })
            });

            if (response.ok) {
                const data = await response.json();
                let token = data?.token;

                let refreshToken = data?.refreshToken;

                // Fallback: if backend register did not return a token, perform login
                if (!token) {
                    const loginRes = await fetch(`${config.backendUrl}/auth/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: trimmedEmail, password })
                    });
                    if (loginRes.ok) {
                        const loginData = await loginRes.json();
                        token = loginData?.token;
                        refreshToken = loginData?.refreshToken;
                    }
                }

                if (token) {
                    if (typeof chrome !== "undefined" && chrome.storage?.local) {
                        const toStore: Record<string, string> = {
                            [AUTH_TOKEN_KEY]: token,
                            [USER_EMAIL_KEY]: trimmedEmail
                        };
                        if (refreshToken) {
                            toStore[REFRESH_TOKEN_KEY] = refreshToken;
                        }
                        await chrome.storage.local.set(toStore);
                    }
                    onAuthSuccess(trimmedEmail);
                    SessionQueueService.flushPendingSessions().catch(() => {});
                    return;
                }

                setError("Account created, but could not authenticate. Please sign in.");
                setMode("signin");
                return;
            }

            if (response.status === 409) {
                setError("An account with this email already exists.");
                return;
            }

            if (response.status === 400) {
                setError("Validation failed. Please check your email and password.");
                return;
            }

            if (response.status >= 500) {
                setError("Server error occurred. Please try again later.");
                return;
            }

            setError(`Registration failed (HTTP ${response.status}).`);
        } catch {
            setError("Unable to connect to backend server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-[340px] p-4 bg-slate-900 text-slate-100 font-sans select-none min-h-[440px] flex flex-col justify-center">
            <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-sky-500/10 text-sky-400 text-2xl mb-2">
                    ⚡
                </div>
                <h1 className="text-base font-bold text-slate-100 tracking-tight">
                    DSA Tracker
                </h1>
                {mode === "register" ? (
                    <p className="text-xs text-slate-400 mt-1">Create your account</p>
                ) : (
                    <p className="text-xs text-slate-400 mt-1">Sign in to sync your progress</p>
                )}
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-lg">
                {error && (
                    <div className="mb-3.5 p-2.5 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg">
                        {error}
                    </div>
                )}

                {mode === "signin" ? (
                    <form onSubmit={handleLogin} className="space-y-3">
                        <div>
                            <label className="text-[11px] font-medium text-slate-300 block mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                                required
                                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-medium text-slate-300 block mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-sm transition-all duration-150 cursor-pointer mt-1"
                        >
                            {loading ? "Signing In..." : "Sign In"}
                        </button>

                        <div className="pt-3 border-t border-slate-700/60 text-center">
                            <span className="text-xs text-slate-400 block mb-1.5">
                                Don't have an account?
                            </span>
                            <button
                                type="button"
                                onClick={handleSwitchToRegister}
                                className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer transition-colors"
                            >
                                Create Account
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-3">
                        <div>
                            <label className="text-[11px] font-medium text-slate-300 block mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                                required
                                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-medium text-slate-300 block mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-medium text-slate-300 block mb-1">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-sm transition-all duration-150 cursor-pointer mt-1"
                        >
                            {loading ? "Creating Account..." : "Create Account"}
                        </button>

                        <div className="pt-3 border-t border-slate-700/60 text-center">
                            <span className="text-xs text-slate-400 block mb-1.5">
                                Already have an account?
                            </span>
                            <button
                                type="button"
                                onClick={handleSwitchToSignIn}
                                className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer transition-colors"
                            >
                                Sign In
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
