import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { GameQuestion } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { gameConfig } from "../config/game.config";

type Props = {
  onRunReady: (runId: string, runAccessToken: string) => void;
};

export default function QuizPage({ onRunReady }: Props) {
  const { t, language } = useI18n();
  const [runId, setRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState<string>("");
  const [configQuestions, setConfigQuestions] = useState<string>(gameConfig.defaultConfigCode);
  const [puzzleCode, setPuzzleCode] = useState<string>(gameConfig.defaultPuzzleCode);
  const [stats, setStats] = useState({ totalAnswered: 0, totalCorrect: 0 });
  const [error, setError] = useState<string | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [timeWarning, setTimeWarning] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [lives, setLives] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const beepCtxRef = useRef<AudioContext | null>(null);

  const current = questions[currentIndex];
  const progressText = useMemo(
    () => (questions.length ? `${currentIndex + 1}/${questions.length}` : "0/0"),
    [currentIndex, questions.length],
  );

  async function startGame() {
    setError(null);
    setFeedback("");
    try {
      const res = await api.startRun({
        configCode: configQuestions,
        puzzleCode,
        locale: language,
      });
      setRunId(res.runId);
      setQuestions(res.questions);
      setCurrentIndex(0);
      setTimeLeftSec(res.timeLimitSec);
      setTimeWarning("");
      setSelectedChoiceId(null);
      setLives(3);
      onRunReady(res.runId, res.runAccessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorStartLevel"));
    }
  }

  useEffect(() => {
    if (!runId || !questions.length) return;
    const timer = window.setInterval(() => {
      setTimeLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [runId, questions.length]);

  useEffect(() => {
    if (!runId || !questions.length) return;
    if (timeLeftSec === 0) {
      setTimeWarning(t("timeoutHint"));
      return;
    }
    if (timeLeftSec <= 10) {
      setTimeWarning(`${t("countdownWarning")}: ${timeLeftSec}s`);
      const ctx = beepCtxRef.current ?? new AudioContext();
      beepCtxRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.06;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.08);
    } else {
      setTimeWarning("");
    }
  }, [timeLeftSec, runId, questions.length, t]);

  async function answer() {
    if (!runId || !current) return;
    if (!selectedChoiceId) return;
    const runAccessToken = localStorage.getItem("pg_run_access_token");
    if (!runAccessToken) return;
    try {
      setSubmitting(true);
      const res = await api.submitAnswer(runId, { runQuestionId: current.runQuestionId, selectedChoiceId }, runAccessToken);
      setStats({ totalAnswered: res.totalAnswered, totalCorrect: res.totalCorrect });
      if (res.isCorrect) {
        setFeedback(t("quizCorrectFeedback"));
      } else {
        setLives((prev) => Math.max(0, prev - 1));
        setFeedback(t("quizWrongLife"));
      }
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((v) => v + 1);
        setSelectedChoiceId(null);
      } else {
        setFeedback(t("finishedQuiz"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorSubmitAnswer"));
    } finally {
      setSubmitting(false);
    }
  }

  const topicTabs = useMemo(
    () => [
      { key: "history", label: t("quizTopicHistory"), active: currentIndex % 3 === 0 },
      { key: "material", label: t("quizTopicMaterial"), active: currentIndex % 3 === 1 },
      { key: "tech", label: t("quizTopicTech"), active: currentIndex % 3 === 2 },
    ],
    [t, currentIndex],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {!runId ? (
        <section className="card p-4 md:p-6">
          <div className="mb-5 rounded-xl bg-temple-gradient p-4">
            <h1 className="text-2xl font-bold text-amber-50 md:text-3xl">{t("quizTitle")}</h1>
            <p className="mt-2 text-sm text-amber-100 md:text-base">{t("quizDesc")}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={configQuestions}
              onChange={(e) => setConfigQuestions(e.target.value)}
              className="rounded-xl border border-white/20 bg-black/20 px-3 py-2"
              placeholder={t("configCode")}
            />
            <input
              value={puzzleCode}
              onChange={(e) => setPuzzleCode(e.target.value)}
              className="rounded-xl border border-white/20 bg-black/20 px-3 py-2"
              placeholder={t("puzzleCode")}
            />
            <button
              onClick={startGame}
              className="md:col-span-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-black hover:bg-amber-400"
            >
              {t("startRun")}
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-amber-200">
            <p className="font-semibold">{t("quizChallengeTitle")}</p>
            <p>{t("timeLeft")}: {timeLeftSec}s</p>
          </div>

          <div className="flex justify-center gap-3">
            {topicTabs.map((tab) => (
              <div
                key={tab.key}
                className={`rounded-xl border px-6 py-3 text-sm font-semibold ${
                  tab.active
                    ? "border-amber-200 bg-amber-500/70 text-black"
                    : "border-amber-200/20 bg-black/30 text-amber-100"
                }`}
              >
                {tab.label}
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 text-2xl">
            {[0, 1, 2].map((idx) => (
              <span key={idx} className={idx < lives ? "opacity-100" : "opacity-30"}>
                💗
              </span>
            ))}
          </div>

          <div className="card mx-auto max-w-3xl p-5 md:p-8">
            {current && timeLeftSec > 0 ? (
              <>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
                  {t("questionLabel")} {progressText} • {topicTabs.find((x) => x.active)?.label}
                </p>
                <h2 className="mt-3 text-2xl font-semibold leading-snug text-amber-50">{current.content}</h2>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {current.choices.map((choice, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const selected = selectedChoiceId === choice.id;
                    return (
                      <button
                        key={choice.id}
                        onClick={() => setSelectedChoiceId(choice.id)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-amber-200 bg-amber-500/25"
                            : "border-amber-200/20 bg-black/25 hover:border-amber-300/60 hover:bg-amber-500/10"
                        }`}
                      >
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/30 text-xs font-bold text-amber-100">
                          {letter}
                        </span>
                        <span className="text-base text-amber-50">{choice.content}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={answer}
                  disabled={!selectedChoiceId || submitting}
                  className="mt-6 w-full rounded-xl bg-slate-600/80 px-4 py-3 text-base font-semibold text-amber-50 hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? t("checkingAnswer") : t("confirmAnswer")}
                </button>
              </>
            ) : (
              <p className="text-amber-100">{t("finishedQuiz")}</p>
            )}
          </div>
          {feedback && <p className="rounded-lg bg-emerald-500/20 p-3 text-sm text-emerald-100">{feedback}</p>}
          {timeWarning && <p className="rounded-lg bg-orange-500/20 p-3 text-sm text-orange-100">{timeWarning}</p>}
          {error && <p className="rounded-lg bg-red-500/20 p-3 text-sm text-red-100">{error}</p>}
        </section>
      )}
    </div>
  );
}
