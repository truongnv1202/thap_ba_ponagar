import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { appendUsedQuestionIds, clearCampaignQuestionPool, readExcludedQuestionIds } from "../lib/campaignQuestionPool";
import { gameConfig } from "../config/game.config";
import SoundControl from "../components/SoundControl";
import { type Language, useI18n } from "../lib/i18n";

type Stage = "overview" | "tutorial" | "missions" | "quiz" | "puzzle" | "level-complete" | "campaign-complete";

type SlideItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  i18n?: Record<string, { title?: string; description?: string | null }> | null;
};

function slideForLocale(slide: SlideItem, lang: Language): { title: string; description: string | null } {
  const pack = slide.i18n?.[lang];
  if (pack?.title?.trim()) {
    return { title: pack.title.trim(), description: pack.description ?? slide.description };
  }
  return { title: slide.title, description: slide.description };
}

type QuizQuestion = {
  runQuestionId: string;
  questionId: string;
  content: string;
  choices: Array<{ id: string; content: string }>;
};

type AnswerState = "correct" | "wrong" | null;

/** Lưu kết quả finalize dạng key, không lưu chuỗi đã dịch — đổi ngôn ngữ vẫn đúng. */
type CampaignFinalizeSummary = { kind: "won_top3" } | { kind: "won_rank"; rank: number } | { kind: "lost" };

export default function CampaignPage() {
  const { language, setLanguage, t } = useI18n();
  const [stage, setStage] = useState<Stage>("overview");
  const [levelIndex, setLevelIndex] = useState(0);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [runAccessToken, setRunAccessToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerStates, setAnswerStates] = useState<AnswerState[]>([]);
  const [answeredChoices, setAnsweredChoices] = useState<Array<string | null>>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusText, setStatusText] = useState("");
  const [puzzleFinalizeSummary, setPuzzleFinalizeSummary] = useState<CampaignFinalizeSummary | null>(null);
  const [campaignLbError, setCampaignLbError] = useState<string | null>(null);
  const [pieces, setPieces] = useState<
    Array<{
      pieceId: string;
      pieceCode: string;
      correctSlot: number;
      displayOrder: number;
    }>
  >([]);
  const [puzzleImageUrl, setPuzzleImageUrl] = useState("/images/ponagar-bg.png");
  /** Số ô lưới = puzzleTemplate.totalPieces (API); khớp số mảnh trong kho. */
  const [puzzleSlotCount, setPuzzleSlotCount] = useState<number | null>(null);
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [showWinnerForm, setShowWinnerForm] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerAge, setPlayerAge] = useState(12);
  const [leaderboardLevelTab, setLeaderboardLevelTab] = useState(1);
  const [leaderboardItems, setLeaderboardItems] = useState<
    Array<{ rank: number; displayName: string; totalTimeSec: number; highestLevel: number }>
  >([]);
  const [guestKey, setGuestKey] = useState<string>("");
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const beepCtxRef = useRef<AudioContext | null>(null);
  const quizRunLocaleRef = useRef<string | null>(null);
  const quizLanguageRestartingRef = useRef(false);

  const level = gameConfig.levels[levelIndex]!;
  const levelTitle = t(level.nameKey);
  const currentQuestion = questions[currentQuestionIndex];
  const missionCount = 10;
  const activeSlide = slides.length > 0 ? slides[slideIndex] : null;
  const activeSlideText = useMemo(() => {
    if (!activeSlide) return null;
    return slideForLocale(activeSlide, language);
  }, [activeSlide, language]);

  const puzzleFinalizeSummaryLine = useMemo(() => {
    if (!puzzleFinalizeSummary) return "";
    if (puzzleFinalizeSummary.kind === "won_top3") return t("finalizeWonTop3");
    if (puzzleFinalizeSummary.kind === "won_rank") return t("finalizeWonRank", { rank: puzzleFinalizeSummary.rank });
    return t("finalizeLost");
  }, [puzzleFinalizeSummary, t, language]);

  const tutorialSlides = useMemo(
    () => [
      { title: t("tutorial1Title"), description: t("tutorial1Desc"), imageUrl: "/images/tutorial-1.png" },
      { title: t("tutorial2Title"), description: t("tutorial2Desc"), imageUrl: "/images/tutorial-2.png" },
      { title: t("tutorial3Title"), description: t("tutorial3Desc"), imageUrl: "/images/tutorial-3.png" },
    ],
    [t],
  );

  useEffect(() => {
    const saved = localStorage.getItem("pg_campaign_guest_key");
    if (saved) {
      setGuestKey(saved);
      return;
    }
    const generated = crypto.randomUUID();
    localStorage.setItem("pg_campaign_guest_key", generated);
    setGuestKey(generated);
  }, []);

  useEffect(() => {
    async function loadSlides() {
      try {
        const res = await api.getPublicSlides();
        if (res.items.length > 0) {
          setSlides(res.items);
        }
      } catch {
        // Fallback to static hero when slide API unavailable.
      }
    }
    void loadSlides();
  }, []);

  /** Đổi ngôn ngữ khi đang làm trắc nghiệm → tạo ván mới theo locale (mỗi ngôn ngữ một bộ câu hỏi trong DB). */
  useEffect(() => {
    if (stage !== "quiz" || !runId) return;
    if (quizRunLocaleRef.current === language) return;
    if (quizLanguageRestartingRef.current) return;
    quizLanguageRestartingRef.current = true;
    setStatusText(t("quizReloadingForLocale"));
    void (async () => {
      try {
        await startLevel();
      } finally {
        quizLanguageRestartingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi đổi language/stage/runId; startLevel lấy locale mới từ closure
  }, [language, stage, runId]);

  useEffect(() => {
    if (stage !== "overview" || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [stage, slides]);

  useEffect(() => {
    if (stage !== "quiz") return;
    if (timeLeftSec <= 0) return;
    const timer = window.setInterval(() => setTimeLeftSec((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [stage, timeLeftSec]);

  useEffect(() => {
    if (stage !== "quiz") return;
    if (timeLeftSec <= 10 && timeLeftSec > 0) {
      const ctx = beepCtxRef.current ?? new AudioContext();
      beepCtxRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = 920;
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.06);
    }
    if (timeLeftSec === 0) {
      setStatusText(t("timeUpNoPuzzle"));
      setRunId(null);
      setRunAccessToken(null);
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setStage("missions");
    }
  }, [stage, timeLeftSec, t]);

  useEffect(() => {
    async function loadPiecesForPuzzle() {
      if (stage !== "puzzle" || !runId || !runAccessToken) return;
      try {
        const res = await api.getPieces(runId, runAccessToken);
        setPuzzleImageUrl(res.imageUrl);
        setPuzzleSlotCount(res.totalPieces);
        setPieces(res.pieces);
      } catch (e) {
        setStatusText(e instanceof Error ? e.message : t("errorLoadPieces"));
      }
    }
    void loadPiecesForPuzzle();
  }, [stage, runId, runAccessToken, t]);

  const completedMissions = useMemo(() => {
    return Math.min(missionCount, currentQuestionIndex + (stage === "quiz" ? 0 : questions.length ? 1 : 0));
  }, [currentQuestionIndex, stage, questions.length]);

  const slotCount = puzzleSlotCount ?? level.pieceCount;
  const piecesInPlay = useMemo(
    () => pieces.filter((p) => p.correctSlot >= 0 && p.correctSlot < slotCount),
    [pieces, slotCount],
  );
  const availablePieces = piecesInPlay.filter((p) => !Object.values(placements).includes(p.pieceId));
  const sortedAvailablePieces = [...availablePieces].sort((a, b) => a.displayOrder - b.displayOrder);
  const puzzleCols = Math.ceil(Math.sqrt(slotCount));
  const puzzleRows = Math.ceil(slotCount / puzzleCols);

  async function startLevel() {
    setStatusText("");
    setPuzzleFinalizeSummary(null);
    setCampaignLbError(null);
    setShowWinnerForm(false);
    setPlayerName("");
    setPlayerAge(12);
    setPlacements({});
    setPieces([]);
    setPuzzleSlotCount(null);
    setPuzzleImageUrl("/images/ponagar-bg.png");
    setSelectedChoiceId(null);
    setAnswerStates(Array.from({ length: missionCount }, () => null));
    setAnsweredChoices(Array.from({ length: missionCount }, () => null));
    setLives(3);
    setCurrentQuestionIndex(0);

    try {
      const effectiveGuestKey = guestKey || crypto.randomUUID();
      if (!guestKey) {
        localStorage.setItem("pg_campaign_guest_key", effectiveGuestKey);
        setGuestKey(effectiveGuestKey);
      }
      const res = await api.startRun({
        configCode: gameConfig.defaultConfigCode,
        puzzleCode: level.puzzleCode,
        guestKey: effectiveGuestKey,
        locale: language,
        excludedQuestionIds: readExcludedQuestionIds(),
      });

      setRunId(res.runId);
      setRunAccessToken(res.runAccessToken);
      setQuestions(
        res.questions.map((q) => ({
          runQuestionId: q.runQuestionId,
          questionId: q.questionId,
          content: q.content,
          choices: q.choices,
        })),
      );
      setTimeLeftSec(res.timeLimitSec);
      quizRunLocaleRef.current = language;
      setStage("quiz");
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : t("errorStartLevel"));
    }
  }

  async function submitAnswer() {
    if (!runId || !runAccessToken || !currentQuestion || !selectedChoiceId) return;
    if (timeLeftSec <= 0) return;
    const choiceIdx = currentQuestion.choices.findIndex((c) => c.id === selectedChoiceId);
    if (choiceIdx < 0) return;
    const selectedLetter = String.fromCharCode(65 + choiceIdx);
    try {
      setSubmittingAnswer(true);
      const res = await api.submitAnswer(
        runId,
        { runQuestionId: currentQuestion.runQuestionId, selectedLetter },
        runAccessToken,
      );
      if (!res.isCorrect) {
        setLives((prev) => Math.max(0, prev - 1));
      }
      setAnswerStates((prev) => {
        const next = [...prev];
        next[currentQuestionIndex] = res.isCorrect ? "correct" : "wrong";
        return next;
      });
      setAnsweredChoices((prev) => {
        const next = [...prev];
        next[currentQuestionIndex] = selectedChoiceId;
        return next;
      });
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedChoiceId(answeredChoices[currentQuestionIndex + 1] ?? null);
      } else if (res.puzzleUnlocked) {
        setStage("puzzle");
        setStatusText(t("quizDonePuzzle"));
      } else {
        setRunId(null);
        setRunAccessToken(null);
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setStage("missions");
        setStatusText(t("quizFailedNotAllCorrect", { count: res.totalQuestions }));
      }
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : t("errorSubmitAnswer"));
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function placePiece(slotPosition: number, pieceId?: string) {
    if (!runId || !runAccessToken) return;
    const chosen = pieceId ?? selectedPieceId;
    if (!chosen) return;
    try {
      const result = await api.placePiece(runId, { pieceId: chosen, slotPosition }, runAccessToken);
      setPlacements((prev) => ({ ...prev, [slotPosition]: result.pieceId }));
      setSelectedPieceId(null);
      setDraggingPieceId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "WRONG_SLOT") setStatusText(t("errorWrongSlot"));
      else setStatusText(msg || t("errorPlacePiece"));
    }
  }

  async function finalizeLevel() {
    if (!runId || !runAccessToken) return;
    try {
      const result = await api.finalize(runId, runAccessToken);
      if (!result.won) {
        setPuzzleFinalizeSummary({ kind: "lost" });
        return;
      }
      setPuzzleFinalizeSummary(result.isTop3 ? { kind: "won_top3" } : { kind: "won_rank", rank: result.rank });
      setShowWinnerForm(result.isTop3);

      appendUsedQuestionIds(questions.map((q) => q.questionId));

      if (levelIndex < gameConfig.levels.length - 1) {
        setStage("level-complete");
      } else {
        setStage("campaign-complete");
      }
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : t("errorFinalize"));
    }
  }

  async function submitWinnerProfile() {
    if (!runId || !runAccessToken) return;
    try {
      await api.submitWinnerProfile(runId, { playerName, playerAge }, runAccessToken);
      setStatusText(t("savedHonor"));
      setShowWinnerForm(false);
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : t("errorSaveProfile"));
    }
  }

  function nextLevel() {
    setLevelIndex((prev) => prev + 1);
    setStage("missions");
    setStatusText("");
    setPuzzleFinalizeSummary(null);
  }

  function pieceStyleBySlot(slotIndex: number) {
    const col = slotIndex % puzzleCols;
    const row = Math.floor(slotIndex / puzzleCols);
    return {
      backgroundImage: `url('${puzzleImageUrl}')`,
      backgroundSize: `${puzzleCols * 100}% ${puzzleRows * 100}%`,
      backgroundPosition: `${(col / Math.max(1, puzzleCols - 1)) * 100}% ${(row / Math.max(1, puzzleRows - 1)) * 100}%`,
    };
  }

  async function loadCampaignLeaderboard(levelTab: number) {
    try {
      setCampaignLbError(null);
      const res = await api.campaignLeaderboard(levelTab);
      setLeaderboardItems(
        res.items.map((item) => ({
          rank: item.rank,
          displayName: item.displayName,
          totalTimeSec: item.totalTimeSec,
          highestLevel: item.highestLevel,
        })),
      );
    } catch (e) {
      setLeaderboardItems([]);
      setCampaignLbError(e instanceof Error ? e.message : t("errorLoadCampaignLb"));
    }
  }

  useEffect(() => {
    if (stage !== "campaign-complete") return;
    void loadCampaignLeaderboard(leaderboardLevelTab);
  }, [stage, leaderboardLevelTab]);

  return (
    <div className="relative mx-auto max-w-6xl pt-14">
      <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
        {(["vi", "en", "zh", "ko"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            className={`rounded-md border px-2 py-1 text-xs ${
              language === lang
                ? "border-amber-300 bg-amber-500/30 text-amber-50"
                : "border-amber-200/30 bg-black/35 text-amber-100/90"
            }`}
          >
            {lang === "vi" ? "VI" : lang === "en" ? "EN" : lang === "zh" ? "中文" : "KO"}
          </button>
        ))}
        <SoundControl />
      </div>

      {stage === "overview" && (
        <section className="card min-h-[82vh] overflow-hidden p-0">
          <div
            className="relative min-h-[82vh] bg-[radial-gradient(circle_at_center,rgba(236,172,86,0.15),rgba(18,8,4,0.95))] bg-cover bg-center"
            style={activeSlide ? { backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.65), rgba(0,0,0,0.35)), url(${activeSlide.imageUrl})` } : undefined}
          >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.55),rgba(0,0,0,0.25))]" />
            <div className="relative z-10 flex min-h-[82vh] flex-col justify-end p-8 md:p-12">
              <h1 className="text-5xl font-bold text-amber-200 md:text-7xl">
                {activeSlideText?.title ?? t("heroTitleFallback")}
              </h1>
              <p className="mt-3 max-w-xl text-lg text-amber-50/90">
                {activeSlideText?.description ?? t("heroDescFallback")}
              </p>
              <button
                onClick={() => {
                  clearCampaignQuestionPool();
                  setStage("tutorial");
                }}
                className="mt-8 w-fit rounded-2xl bg-amber-500 px-12 py-5 text-2xl font-bold text-black hover:bg-amber-400"
              >
                {t("startGame")}
              </button>
              {slides.length > 1 && (
                <div className="mt-6 flex gap-2">
                  {slides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      onClick={() => setSlideIndex(idx)}
                      className={`h-2 w-8 rounded-full ${idx === slideIndex ? "bg-amber-300" : "bg-amber-100/40"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {stage === "tutorial" && (
        <section className="card min-h-[60vh] p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-amber-300">{t("tutorialHeading")}</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-amber-200/20 bg-black/20">
            <img
              src={tutorialSlides[tutorialIndex].imageUrl}
              alt={tutorialSlides[tutorialIndex].title}
              className="h-[320px] w-full object-cover md:h-[420px]"
            />
            <div className="border-t border-amber-200/20 bg-black/45 p-4">
              <h2 className="text-2xl font-bold text-amber-100">{tutorialSlides[tutorialIndex].title}</h2>
              <p className="mt-2 text-base text-amber-50/90">{tutorialSlides[tutorialIndex].description}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {tutorialSlides.map((slide, idx) => (
              <button
                key={slide.title}
                onClick={() => setTutorialIndex(idx)}
                className={`h-2 w-10 rounded-full ${idx === tutorialIndex ? "bg-amber-300" : "bg-amber-100/30"}`}
              />
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            {tutorialIndex < tutorialSlides.length - 1 ? (
              <button
                onClick={() => setTutorialIndex((prev) => prev + 1)}
                className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-black"
              >
                {t("tutorialNext")}
              </button>
            ) : (
              <button onClick={() => setStage("missions")} className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-black">
                {t("tutorialEnterMissions")}
              </button>
            )}
            <button onClick={() => setStage("missions")} className="rounded-xl border border-amber-200/30 px-5 py-2 text-amber-100">
              {t("tutorialSkip")}
            </button>
          </div>
        </section>
      )}

      {stage === "missions" && (
        <section className="card p-6">
          <h2 className="text-2xl font-bold text-amber-100">{levelTitle}</h2>
          <p className="mt-2 text-amber-50/90">{t("missionsDesc")}</p>
          <div className="mt-5 grid grid-cols-5 gap-3 md:grid-cols-10">
            {Array.from({ length: missionCount }, (_, idx) => (
              <div
                key={idx}
                className={`rounded-lg border px-3 py-2 text-center text-sm ${
                  answerStates[idx] === "correct"
                    ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                    : answerStates[idx] === "wrong"
                      ? "border-red-400/70 bg-red-500/20 text-red-100"
                      : idx < completedMissions
                        ? "border-amber-300/60 bg-amber-500/10 text-amber-100"
                        : "border-amber-200/20 bg-black/25 text-amber-100"
                }`}
              >
                {idx + 1}
              </div>
            ))}
          </div>
          <button onClick={startLevel} className="mt-6 rounded-xl bg-amber-500 px-5 py-2 font-semibold text-black">
            {t("startQuiz")}
          </button>
        </section>
      )}

      {stage === "quiz" && currentQuestion && (
        <section className="space-y-4">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
              {Array.from({ length: missionCount }, (_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const target = Math.min(idx, questions.length - 1);
                    if (target >= 0) {
                      setCurrentQuestionIndex(target);
                      setSelectedChoiceId(answeredChoices[target] ?? null);
                    }
                  }}
                  className={`rounded-md border px-2 py-1 text-center text-xs ${
                    answerStates[idx] === "correct"
                      ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                      : answerStates[idx] === "wrong"
                        ? "border-red-400/70 bg-red-500/20 text-red-100"
                        : "border-amber-200/20 bg-black/25 text-amber-100"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-2 text-2xl">
            {[0, 1, 2].map((idx) => (
              <span key={idx} className={idx < lives ? "opacity-100" : "opacity-30"}>
                💗
              </span>
            ))}
          </div>
          <div className="card mx-auto max-w-4xl p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">
              {t("questionLabel")} {currentQuestionIndex + 1}/{questions.length}
            </p>
            <h3 className="mt-3 text-3xl font-bold text-amber-100">{currentQuestion.content}</h3>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {currentQuestion.choices.map((choice, idx) => (
                <button
                  key={choice.id}
                  onClick={() => setSelectedChoiceId(choice.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                    selectedChoiceId === choice.id
                      ? "border-amber-200 bg-amber-500/20"
                      : "border-amber-200/20 bg-black/20 hover:border-amber-300/60"
                  }`}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/30 text-xs font-bold">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{choice.content}</span>
                </button>
              ))}
            </div>
            <button
              onClick={submitAnswer}
              disabled={!selectedChoiceId || submittingAnswer || timeLeftSec <= 0}
              className="mt-6 w-full rounded-xl bg-slate-600/80 px-4 py-3 font-semibold text-amber-50 disabled:opacity-50"
            >
              {submittingAnswer ? t("checkingAnswer") : t("confirmAnswer")}
            </button>
            <p className="mt-3 text-sm text-amber-200/80">{t("timeRemaining", { seconds: timeLeftSec })}</p>
          </div>
        </section>
      )}

      {stage === "puzzle" && (
        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="card p-4">
            <h3 className="text-xl font-semibold text-amber-100">{levelTitle}</h3>
            <p className="mt-1 text-sm text-amber-200/80">{t("puzzlePiecesToPlace", { count: slotCount })}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {sortedAvailablePieces.map((piece) => (
                <button
                  key={piece.pieceId}
                  type="button"
                  draggable
                  aria-label={t("pieceBankAria")}
                  onDragStart={() => {
                    setDraggingPieceId(piece.pieceId);
                    setSelectedPieceId(piece.pieceId);
                  }}
                  onDragEnd={() => setDraggingPieceId(null)}
                  onClick={() => setSelectedPieceId(piece.pieceId)}
                  className={`jigsaw-piece h-16 min-h-[4rem] w-full border ${
                    selectedPieceId === piece.pieceId ? "border-amber-200 ring-2 ring-amber-300/50" : "border-amber-200/25 bg-black/20"
                  }`}
                  style={pieceStyleBySlot(piece.correctSlot)}
                />
              ))}
            </div>
            <button type="button" onClick={finalizeLevel} className="mt-4 w-full rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-black">
              {t("finishLevel")}
            </button>
          </div>
          <div className="card p-5">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${puzzleCols}, minmax(0, 1fr))` }}>
              {Array.from({ length: slotCount }, (_, idx) => {
                const pieceId = placements[idx];
                const piece = piecesInPlay.find((p) => p.pieceId === pieceId);
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-label={piece ? t("placedPieceAria") : t("emptySlotAria")}
                    onClick={() => void placePiece(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingPieceId) void placePiece(idx, draggingPieceId);
                    }}
                    className={`jigsaw-slot flex aspect-square items-center justify-center border ${
                      pieceId ? "border-emerald-400/40 bg-black/15" : "border-amber-200/25 bg-black/30"
                    }`}
                    style={piece ? pieceStyleBySlot(piece.correctSlot) : undefined}
                  />
                );
              })}
            </div>

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
                    placeholder={t("agePlaceholder")}
                    type="number"
                    min={7}
                    max={18}
                    value={playerAge}
                    onChange={(e) => setPlayerAge(Number(e.target.value))}
                  />
                </div>
                <button type="button" onClick={submitWinnerProfile} className="mt-3 rounded-lg bg-amber-500 px-3 py-2 font-semibold text-black">
                  {t("saveHonor")}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {stage === "level-complete" && (
        <section className="card p-8 text-center">
          <h2 className="text-3xl font-bold text-emerald-300">{t("levelCompleteTitle", { name: levelTitle })}</h2>
          <p className="mt-3 text-amber-100">{puzzleFinalizeSummaryLine || statusText}</p>
          <button type="button" onClick={nextLevel} className="mt-6 rounded-xl bg-amber-500 px-6 py-2 font-semibold text-black">
            {t("nextLevel")}
          </button>
        </section>
      )}

      {stage === "campaign-complete" && (
        <section className="card p-8 text-center">
          <h2 className="text-3xl font-bold text-amber-200">{t("campaignCompleteTitle")}</h2>
          <p className="mt-3 text-amber-100">
            {puzzleFinalizeSummaryLine || statusText || t("campaignCompleteFallback")}
          </p>
          {campaignLbError ? <p className="mt-2 text-sm text-red-200/90">{campaignLbError}</p> : null}
          <div className="mt-6">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-amber-300">{t("leaderboardByMilestone")}</p>
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              {[
                ["🔥", 1],
                ["💧", 2],
                ["🌿", 3],
                ["🌬️", 4],
                ["⚡", 5],
              ].map(([icon, tab]) => (
                <button
                  key={String(tab)}
                  type="button"
                  onClick={() => setLeaderboardLevelTab(Number(tab))}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    leaderboardLevelTab === Number(tab)
                      ? "border-amber-200 bg-amber-500/25"
                      : "border-amber-200/20 bg-black/20"
                  }`}
                >
                  {icon} {t("passedLevelTab", { n: tab })}
                </button>
              ))}
            </div>
            <div className="mx-auto max-w-2xl space-y-2 text-left">
              {leaderboardItems.map((item) => (
                <div key={`${item.rank}-${item.displayName}`} className="flex items-center justify-between rounded-lg border border-amber-200/20 bg-black/25 px-3 py-2">
                  <p className="text-sm text-amber-100">
                    #{item.rank} - {item.displayName} (L{item.highestLevel})
                  </p>
                  <p className="text-sm font-semibold text-amber-200">{item.totalTimeSec}s</p>
                </div>
              ))}
              {leaderboardItems.length === 0 && <p className="text-center text-sm text-amber-100/80">{t("noLeaderboardData")}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearCampaignQuestionPool();
              setLevelIndex(0);
              setStage("overview");
              setStatusText("");
              setPuzzleFinalizeSummary(null);
              setCampaignLbError(null);
              setAnswerStates([]);
            }}
            className="mt-6 rounded-xl bg-amber-500 px-6 py-2 font-semibold text-black"
          >
            {t("playAgainFromStart")}
          </button>
        </section>
      )}
    </div>
  );
}
