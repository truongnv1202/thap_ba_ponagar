import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";

type Props = {
  runId: string | null;
  runAccessToken: string | null;
};

const SLOT_COUNT = 12;

type FinalizeSnapshot = { won: boolean; isTop3: boolean; rank: number };

export default function PuzzlePage({ runId, runAccessToken }: Props) {
  const { t, language } = useI18n();
  const [pieces, setPieces] = useState<Array<{ pieceId: string; pieceCode: string; correctSlot: number; displayOrder: number }>>(
    [],
  );
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [finalizeSnapshot, setFinalizeSnapshot] = useState<FinalizeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [showWinnerForm, setShowWinnerForm] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerAge, setPlayerAge] = useState(12);

  useEffect(() => {
    setFinalizeSnapshot(null);
    setMessage("");
    async function loadPieces() {
      if (!runId || !runAccessToken) return;
      try {
        const res = await api.getPieces(runId, runAccessToken);
        setPieces(res.pieces);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : t("errorLoadPieces"));
      }
    }
    void loadPieces();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only new run; omit `t` so language toggle does not clear finalize.
  }, [runId, runAccessToken]);

  const finalizeLine = useMemo(() => {
    if (!finalizeSnapshot) return "";
    if (!finalizeSnapshot.won) return t("finalizeLost");
    if (finalizeSnapshot.isTop3) return t("finalizeWonTop3");
    return t("finalizeWonRank", { rank: finalizeSnapshot.rank });
  }, [finalizeSnapshot, t, language]);

  const availablePieces = useMemo(() => {
    const list = pieces.filter((p) => !Object.values(placements).includes(p.pieceId));
    return [...list].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [pieces, placements]);

  async function place(slotPosition: number, pieceId?: string) {
    const usePieceId = pieceId ?? selectedPieceId;
    if (!runId || !usePieceId || !runAccessToken) return;
    try {
      setLoading(true);
      const result = await api.placePiece(runId, { pieceId: usePieceId, slotPosition }, runAccessToken);
      setPlacements((prev) => ({ ...prev, [slotPosition]: result.pieceId }));
      setMessage(result.isCorrectPosition ? t("placementOk") : t("placementWrong"));
      setSelectedPieceId(null);
      setDraggingPieceId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "WRONG_SLOT") setMessage(t("errorWrongSlot"));
      else setMessage(msg || t("errorPlacePiece"));
    } finally {
      setLoading(false);
    }
  }

  async function finalize() {
    if (!runId || !runAccessToken) return;
    try {
      const res = await api.finalize(runId, runAccessToken);
      setFinalizeSnapshot({ won: res.won, isTop3: res.isTop3, rank: res.rank });
      setMessage("");
      setShowWinnerForm(Boolean(res.won && res.isTop3));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("errorEndRun"));
    }
  }

  async function submitWinnerProfile() {
    if (!runId || !runAccessToken) return;
    try {
      await api.submitWinnerProfile(runId, { playerName, playerAge }, runAccessToken);
      setMessage(t("savedHonor"));
      setShowWinnerForm(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("errorSaveProfile"));
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className="card p-4">
        <h2 className="text-xl font-bold text-amber-100">{t("piecesStore")}</h2>
        <p className="mt-1 text-sm text-gray-300">{t("piecesHint")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {availablePieces.map((piece) => (
            <button
              key={piece.pieceId}
              onClick={() => setSelectedPieceId(piece.pieceId)}
              draggable
              onDragStart={() => {
                setDraggingPieceId(piece.pieceId);
                setSelectedPieceId(piece.pieceId);
              }}
              onDragEnd={() => setDraggingPieceId(null)}
              className={`rounded-lg border px-3 py-2 text-xs md:text-sm ${
                selectedPieceId === piece.pieceId || draggingPieceId === piece.pieceId
                  ? "border-amber-200 bg-amber-500/30"
                  : "border-white/20 bg-black/20 hover:border-amber-200/60"
              }`}
            >
              <span className="sr-only">{piece.pieceCode}</span>
              <span aria-hidden className="block min-h-[2.5rem] w-full bg-black/35" />
            </button>
          ))}
        </div>
        <button
          disabled={!runId}
          onClick={finalize}
          className="mt-4 w-full rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
        >
          {t("checkResult")}
        </button>
      </section>

      <section className="card p-4 md:p-6">
        <h2 className="text-xl font-bold text-amber-100 md:text-2xl">{t("buildTower")}</h2>
        <p className="mt-2 text-sm text-gray-300">{t("piecesHint")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const pieceId = placements[i];
            const pieceCode = pieces.find((p) => p.pieceId === pieceId)?.pieceCode;
            return (
              <button
                key={i}
                disabled={!selectedPieceId || loading}
                onClick={() => place(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingPieceId) {
                    void place(i, draggingPieceId);
                  }
                }}
                className={`flex aspect-square items-center justify-center rounded-xl border border-amber-200/30 bg-black/30 text-center text-xs transition hover:bg-amber-500/20 disabled:opacity-70 ${
                  draggingPieceId ? "ring-1 ring-amber-300/40" : ""
                }`}
              >
                {pieceCode ? <span className="sr-only">{pieceCode}</span> : null}
              </button>
            );
          })}
        </div>
        {(finalizeLine || message) && (
          <div className="mt-4 space-y-2">
            {finalizeLine ? (
              <p className="rounded-lg bg-black/30 p-3 text-sm text-amber-50">{finalizeLine}</p>
            ) : null}
            {message ? <p className="rounded-lg bg-black/30 p-3 text-sm text-amber-50">{message}</p> : null}
          </div>
        )}
        {showWinnerForm && (
          <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">{t("top3FormTitle")}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                placeholder={t("namePlaceholder")}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <input
                className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                type="number"
                min={7}
                max={18}
                value={playerAge}
                onChange={(e) => setPlayerAge(Number(e.target.value))}
              />
            </div>
            <button
              onClick={submitWinnerProfile}
              className="mt-3 rounded-lg bg-amber-500 px-3 py-2 font-semibold text-black hover:bg-amber-400"
            >
              {t("saveHonor")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
