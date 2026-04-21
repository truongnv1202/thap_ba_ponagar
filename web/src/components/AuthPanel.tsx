import { useState } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

type Props = {
  user: User | null;
  token: string | null;
  onAuth: (token: string, user: User) => void;
  onLogout: () => void;
};

export default function AuthPanel({ user, token, onAuth, onLogout }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, displayName });
      onAuth(response.token, response.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  if (user && token) {
    return (
      <div className="card p-4">
        <p className="text-sm text-amber-100">Xin chao,</p>
        <p className="text-lg font-semibold text-white">{user.displayName}</p>
        <p className="text-xs text-gray-300">{user.email}</p>
        <button
          onClick={onLogout}
          className="mt-3 rounded-lg bg-red-500/80 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Dang xuat
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMode("login")}
          className={`rounded-lg px-3 py-1 text-sm ${mode === "login" ? "bg-amber-500 text-black" : "bg-white/10 text-white"}`}
        >
          Login
        </button>
        <button
          onClick={() => setMode("register")}
          className={`rounded-lg px-3 py-1 text-sm ${mode === "register" ? "bg-amber-500 text-black" : "bg-white/10 text-white"}`}
        >
          Register
        </button>
      </div>

      {mode === "register" && (
        <input
          className="mb-2 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      )}
      <input
        className="mb-2 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        className="mb-2 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
      >
        {loading ? "Dang xu ly..." : mode === "login" ? "Dang nhap" : "Tao tai khoan"}
      </button>
    </div>
  );
}
