import React, { createContext, useState, useEffect, useContext } from "react";
import { getCurrentUser, login, logout, signup } from "@/lib/api";

interface User {
    id: number;
    username: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    login: (username: string, password: string) => Promise<boolean>;
    signup: (
        username: string,
        email: string,
        password: string
    ) => Promise<boolean>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check if user is already logged in
        const checkAuthStatus = async () => {
            try {
                const response = await getCurrentUser();

                if (response && response.user) {
                    setUser(response.user);
                }
            } catch (err) {
                console.log("Not authenticated");
            } finally {
                setIsLoading(false);
            }
        };

        checkAuthStatus();
    }, []);
    
    const handleLogin = async (username: string, password: string): Promise<boolean> => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await login(username, password);

            if (response && response.user) {
                setUser(response.user);
                return true;
            }

            setError(response.message || "Login failed");
            return false;
        } catch (err) {
            setError("An error occurred during login");
            return false;
        } finally {
            setIsLoading(false);
        }
    }
    const handleSignup = async (
        username: string,
        email: string,
        password: string
    ): Promise<boolean> => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await signup(username, email, password);

            if (response && response.user) {
                setUser(response.user);
                return true;
            }

            setError(response.message || "Registration failed");
            return false;
        } catch (err) {
            setError("An error occurred during registration");
            return false;
        } finally {
            setIsLoading(false);
        }
    };
    const handleLogout = async () => {
        setIsLoading(true);
        try {
            await logout();
            setUser(null);
        } catch (err) {
            setError("Failed to logout");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                error,
                login: handleLogin,
                signup: handleSignup,
                logout: handleLogout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
