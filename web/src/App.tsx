import { Route, Routes } from "react-router-dom";
import { useState } from "react";
import Layout from "./components/Layout";
import CampaignPage from "./pages/CampaignPage";
import AdminPage from "./pages/AdminPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import type { User } from "./lib/types";

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("pg_token"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("pg_user");
    return raw ? (JSON.parse(raw) as User) : null;
  });

  function handleAuth(nextToken: string, nextUser: User) {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem("pg_token", nextToken);
    localStorage.setItem("pg_user", JSON.stringify(nextUser));
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("pg_token");
    localStorage.removeItem("pg_user");
    localStorage.removeItem("pg_run_id");
    localStorage.removeItem("pg_run_access_token");
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CampaignPage />} />
        <Route path="/admin/login" element={<AdminLoginPage onAuth={handleAuth} />} />
        <Route path="/admin" element={<AdminPage token={token} user={user} />} />
      </Routes>
    </Layout>
  );
}

export default App;
