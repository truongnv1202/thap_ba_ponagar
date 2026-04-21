import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { LeaderboardItem } from "../lib/types";
import { useI18n } from "../lib/i18n";

export default function LeaderboardPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.leaderboard();
        setItems(res.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorLoadLeaderboard"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <section className="card p-4 md:p-6">
      <h1 className="text-2xl font-bold text-amber-100 md:text-3xl">{t("leaderboardTitle")}</h1>
      <p className="mt-2 text-sm text-gray-300">{t("leaderboardDesc")}</p>

      {loading && <p className="mt-4 text-amber-50">{t("loading")}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-500/20 p-3 text-red-100">{error}</p>}

      {!loading && !error && (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-amber-200">
                <th className="px-3 py-2">{t("rank")}</th>
                <th className="px-3 py-2">{t("player")}</th>
                <th className="px-3 py-2">{t("score")}</th>
                <th className="px-3 py-2">{t("time")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.userId}-${item.rank}`} className="rounded-xl bg-white/5">
                  <td className="rounded-l-xl px-3 py-2 font-semibold">{item.rank}</td>
                  <td className="px-3 py-2">{item.displayName}</td>
                  <td className="px-3 py-2">{item.score}</td>
                  <td className="rounded-r-xl px-3 py-2">{item.completionTimeSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
