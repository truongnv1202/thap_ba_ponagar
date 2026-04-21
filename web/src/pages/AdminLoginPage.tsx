import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { User } from "../lib/types";
import { adminT } from "../lib/i18n";

type Props = {
  onAuth: (token: string, user: User) => void;
};

export default function AdminLoginPage({ onAuth }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email: email.trim(), password });
      if (res.user.role !== "ADMIN") {
        setError(adminT("adminLoginForbidden"));
        return;
      }
      onAuth(res.token, res.user);
      navigate("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : adminT("adminLoginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md card p-6">
      <h1 className="text-2xl font-bold text-amber-100">{adminT("adminLoginHeading")}</h1>
      <p className="mt-2 text-sm text-gray-300">{adminT("adminLoginSubtitle")}</p>
      <div className="mt-4 grid gap-3">
        <input
          className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
          placeholder={adminT("adminLoginEmailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
          placeholder={adminT("adminLoginPasswordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => void login()}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-3 py-2 font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
        >
          {loading ? adminT("adminLoginProcessing") : adminT("adminLoginSubmit")}
        </button>
        {error && <p className="rounded-lg bg-red-500/20 p-2 text-sm text-red-100">{error}</p>}
      </div>
    </section>
  );
}
