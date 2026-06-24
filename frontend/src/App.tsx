import { useEffect, useRef, useState } from "react";
import { api, type Poll } from "./api";

function AuthScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) await api.register(email, password);
      await api.login(email, password);
      onLoggedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360 }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            Live Voting
          </div>
          <h1 style={{ fontSize: 28 }}>{isRegister ? "Create your account" : "Welcome back"}</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && <p style={{ color: "var(--pulse)", fontSize: 14, margin: "0 0 12px" }}>{error}</p>}
          <button type="submit" disabled={loading} style={primaryButtonStyle}>
            {loading ? "..." : isRegister ? "Register & Continue" : "Log in"}
          </button>
        </form>
        <button
          onClick={() => setIsRegister(!isRegister)}
          style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, padding: 8 }}
        >
          {isRegister ? "Already have an account? Log in" : "Need an account? Register"}
        </button>
      </div>
    </div>
  );
}

function CreatePollForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState("");

  function updateOption(index: number, value: string) {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    try {
      await api.createPoll(question, cleanOptions);
      setQuestion("");
      setOptions(["", ""]);
      setOpen(false);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...primaryButtonStyle, width: "auto", padding: "10px 20px", marginBottom: 32 }}>
        + New poll
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 32 }}
    >
      <h3 style={{ fontSize: 16, marginBottom: 14 }}>New poll</h3>
      <input
        placeholder="Ask a question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        required
        style={inputStyle}
      />
      {options.map((opt, i) => (
        <input
          key={i}
          placeholder={`Option ${i + 1}`}
          value={opt}
          onChange={(e) => updateOption(i, e.target.value)}
          style={inputStyle}
        />
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {options.length < 4 && (
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}
          >
            + Option
          </button>
        )}
        <button type="submit" style={{ ...primaryButtonStyle, width: "auto", padding: "8px 18px", marginLeft: "auto" }}>
          Create
        </button>
      </div>
      {error && <p style={{ color: "var(--pulse)", fontSize: 14, marginTop: 10 }}>{error}</p>}
    </form>
  );
}

function PollList({ onSelect }: { onSelect: (id: number) => void }) {
  const [polls, setPolls] = useState<Poll[]>([]);

  function refresh() {
    api.listPolls().then(setPolls);
  }

  useEffect(refresh, []);

  return (
    <div>
      <CreatePollForm onCreated={refresh} />
      {polls.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>No polls yet. Create one to get started.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {polls.map((poll) => {
          const total = poll.options.reduce((s, o) => s + o.vote_count, 0);
          return (
            <div
              key={poll.id}
              onClick={() => onSelect(poll.id)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
            >
              <span style={{ fontWeight: 500 }}>{poll.question}</span>
              <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{total} votes</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PollDetail({ pollId, onBack }: { pollId: number; onBack: () => void }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [error, setError] = useState("");
  const [pulsingOptionId, setPulsingOptionId] = useState<number | null>(null);
  const prevCounts = useRef<Record<number, number>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    api.getPoll(pollId).then((p) => {
      setPoll(p);
      prevCounts.current = Object.fromEntries(p.options.map((o) => [o.id, o.vote_count]));
    });

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/polls/${pollId}`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const updated: Poll = JSON.parse(event.data);

      for (const opt of updated.options) {
        const prev = prevCounts.current[opt.id];
        if (prev !== undefined && opt.vote_count !== prev) {
          setPulsingOptionId(opt.id);
          setTimeout(() => setPulsingOptionId(null), 800);
        }
      }
      prevCounts.current = Object.fromEntries(updated.options.map((o) => [o.id, o.vote_count]));
      setPoll(updated);
    };

    return () => ws.close();
  }, [pollId]);

  async function handleVote(optionId: number) {
    setError("");
    try {
      await api.vote(pollId, optionId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!poll) return <p style={{ color: "var(--text-dim)" }}>Loading...</p>;

  const totalVotes = poll.options.reduce((sum, o) => sum + o.vote_count, 0);

  return (
    <div>
      <button onClick={onBack} style={backButtonStyle}>← All polls</button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "var(--success)" : "var(--text-dim)",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {connected ? "Live" : "Connecting..."}
        </span>
      </div>

      <h2 style={{ fontSize: 24, marginBottom: 24 }}>{poll.question}</h2>
      {error && <p style={{ color: "var(--pulse)", fontSize: 14 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {poll.options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
          return (
            <div key={option.id}>
              <button
                onClick={() => handleVote(option.id)}
                className={pulsingOptionId === option.id ? "vote-pulse" : ""}
                style={optionButtonStyle}
              >
                <span style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{option.text}</span>
                  <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                    {option.vote_count} · {pct}%
                  </span>
                </span>
                <div style={{ background: "var(--border)", height: 8, borderRadius: 99 }}>
                  <div
                    style={{
                      background: "linear-gradient(90deg, var(--accent-dim), var(--accent))",
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 99,
                      transition: "width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 24 }}>
        Results update instantly for everyone watching. Try opening this poll in another tab.
      </p>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn());
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);

  if (!loggedIn) {
    return <AuthScreen onLoggedIn={() => setLoggedIn(true)} />;
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Live Voting
          </div>
          <h1 style={{ fontSize: 22, marginTop: 2 }}>
            {selectedPollId === null ? "Polls" : ""}
          </h1>
        </div>
        <button
          onClick={() => { api.logout(); setLoggedIn(false); }}
          style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}
        >
          Logout
        </button>
      </div>
      {selectedPollId === null ? (
        <PollList onSelect={setSelectedPollId} />
      ) : (
        <PollDetail pollId={selectedPollId} onBack={() => setSelectedPollId(null)} />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginBottom: 10,
  padding: "12px 14px",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontWeight: 600,
  fontSize: 14,
};

const backButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-dim)",
  fontSize: 13,
  padding: 0,
  marginBottom: 20,
};

const optionButtonStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
  color: "var(--text)",
};