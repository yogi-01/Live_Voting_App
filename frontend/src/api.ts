const API_BASE = "http://127.0.0.1:8000";

export interface Option {
    id: number;
    text: string;
    vote_count: number;
}

export interface Poll {
    id: number;
    question: string;
    creator_id: number;
    created_at: string;
    options: Option[];
}

function getToken(): string | null {
    return localStorage.getItem("token");
}

async function request(path: string, options: RequestInit = {}) {
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || `Request failed: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
}

export const api = {
    register: (email: string, password: string) =>
        request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

    login: async (email: string, password: string) => {
        const data = await request("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        localStorage.setItem("token", data.access_token);
        return data;
    },

    logout: () => localStorage.removeItem("token"),

    isLoggedIn: () => !!getToken(),

    listPolls: (): Promise<Poll[]> => request("/polls"),

    getPoll: (pollId: number): Promise<Poll> => request(`/polls/${pollId}`),

    createPoll: (question: string, options: string[]): Promise<Poll> =>
        request("/polls", { method: "POST", body: JSON.stringify({ question, options }) }),

    vote: (pollId: number, optionId: number) =>
        request(`/polls/${pollId}/votes`, {
            method: "POST",
            body: JSON.stringify({ option_id: optionId }),
        }),
};