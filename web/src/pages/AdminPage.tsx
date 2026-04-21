import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";
import { gameConfig } from "../config/game.config";
import { adminT } from "../lib/i18n";

type Props = {
  token: string | null;
  user: User | null;
};

type Notice = { kind: "success" | "error"; text: string } | null;

export default function AdminPage({ token, user }: Props) {
  const [topic, setTopic] = useState<string>(gameConfig.defaultTopic);
  const [difficulty, setDifficulty] = useState<number>(gameConfig.defaultDifficulty);
  const [configCode, setConfigCode] = useState<string>(gameConfig.defaultConfigCode);
  const [questionsPerRun, setQuestionsPerRun] = useState<number>(gameConfig.defaultQuestionsPerRun);
  const [timeLimitSec, setTimeLimitSec] = useState<number>(gameConfig.defaultTimeLimitSec);
  const [puzzleCode, setPuzzleCode] = useState<string>(gameConfig.defaultPuzzleCode);
  const [puzzleName, setPuzzleName] = useState<string>(gameConfig.defaultPuzzleName);
  const [pieceCount, setPieceCount] = useState<number>(gameConfig.defaultPieceCount);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<
    Array<{ id: string; title: string; description: string | null; imageUrl: string; orderIndex: number; active: boolean }>
  >([]);
  const [slideTitle, setSlideTitle] = useState("Tháp Bà Ponagar");
  const [slideDescription, setSlideDescription] = useState("Di sản văn hóa Chăm có giá trị lịch sử đặc sắc.");
  const [slideImageUrl, setSlideImageUrl] = useState("/images/ponagar-bg.png");
  const [slideOrder, setSlideOrder] = useState(0);
  const importExcelInputRef = useRef<HTMLInputElement>(null);
  const [importLocale, setImportLocale] = useState<"vi" | "en" | "zh" | "ko">("vi");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");

  const isAdmin = user?.role === "ADMIN";

  function showSuccess(detail: string) {
    setNotice({ kind: "success", text: detail });
  }

  function showError(text: string) {
    setNotice({ kind: "error", text });
  }

  async function loadSlides() {
    if (!token) return;
    try {
      const res = await api.getAdminSlides(token);
      setSlides(res.items);
    } catch (e) {
      showError(e instanceof Error ? e.message : adminT("adminErrorLoadSlides"));
    }
  }

  useEffect(() => {
    if (!token || !isAdmin) return;
    void loadSlides();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on admin gate only
  }, [token, isAdmin]);

  async function createConfig() {
    if (!token) return;
    setNotice(null);
    setLoading(true);
    try {
      await api.createConfig(
        {
          code: configCode,
          questionsPerRun,
          minCorrectUnlockPuzzle: Math.max(1, Math.floor(questionsPerRun * 0.6)),
          timeLimitSec,
          active: true,
        },
        token,
      );
      showSuccess(adminT("adminConfigCreated"));
    } catch (e) {
      showError(e instanceof Error ? e.message : adminT("adminErrorCreateConfig"));
    } finally {
      setLoading(false);
    }
  }

  async function importExcelQuestions() {
    if (!token) return;
    const file = importExcelInputRef.current?.files?.[0];
    if (!file) {
      showError(adminT("adminImportPickFile"));
      return;
    }
    const ok =
      importMode === "replace"
        ? window.confirm(adminT("adminImportConfirmReplace"))
        : window.confirm(adminT("adminImportConfirmAppend"));
    if (!ok) return;
    setNotice(null);
    setLoading(true);
    try {
      const res = await api.importQuestionsFromExcel(
        file,
        { locale: importLocale, importMode, topic, difficulty },
        token,
      );
      showSuccess(`${adminT("adminQuestionsCreated", { count: res.created })} · ${importLocale} · ${res.importMode}`);
      if (importExcelInputRef.current) importExcelInputRef.current.value = "";
    } catch (e) {
      showError(e instanceof Error ? e.message : adminT("adminErrorBulkQuestions"));
    } finally {
      setLoading(false);
    }
  }

  async function createPuzzle() {
    if (!token) return;
    setNotice(null);
    setLoading(true);
    try {
      await api.createPuzzleTemplate(
        {
          code: puzzleCode,
          name: puzzleName,
          pieces: Array.from({ length: pieceCount }, (_, i) => ({
            pieceCode: `piece-${i + 1}`,
            correctSlot: i,
          })),
        },
        token,
      );
      showSuccess(adminT("adminPuzzleCreated"));
    } catch (e) {
      showError(e instanceof Error ? e.message : adminT("adminErrorCreatePuzzle"));
    } finally {
      setLoading(false);
    }
  }

  async function createSlide() {
    if (!token) return;
    setNotice(null);
    setLoading(true);
    try {
      await api.createSlide(
        {
          title: slideTitle,
          description: slideDescription,
          imageUrl: slideImageUrl,
          orderIndex: slideOrder,
          active: true,
        },
        token,
      );
      showSuccess(adminT("adminSlideAdded"));
      await loadSlides();
    } catch (e) {
      showError(e instanceof Error ? e.message : adminT("adminErrorCreateSlide"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleSlideActive(id: string, active: boolean) {
    if (!token) return;
    setNotice(null);
    try {
      await api.updateSlide(id, { active: !active }, token);
      showSuccess(adminT("adminSlideUpdated"));
      await loadSlides();
    } catch (e) {
      showError(e instanceof Error ? e.message : adminT("adminErrorUpdateSlide"));
    }
  }

  async function deleteSlide(id: string) {
    if (!token) return;
    setNotice(null);
    try {
      await api.deleteSlide(id, token);
      showSuccess(adminT("adminSlideDeleted"));
      await loadSlides();
    } catch (e) {
      showError(e instanceof Error ? e.message : adminT("adminErrorDeleteSlide"));
    }
  }

  if (!token || !isAdmin) {
    return (
      <section className="card p-6">
        <h1 className="text-2xl font-bold text-amber-100">{adminT("adminStudioTitle")}</h1>
        <p className="mt-3 text-amber-50">{adminT("adminLoginPrompt")}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5 md:grid-cols-2">
      {notice && (
        <div
          className={`md:col-span-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            notice.kind === "success"
              ? "border-emerald-400/70 bg-emerald-950/60 text-emerald-50"
              : "border-red-400/60 bg-red-950/45 text-red-50"
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
            {notice.kind === "success" ? adminT("adminSuccessTitle") : adminT("adminErrorTitle")}
          </p>
          <p className="mt-1.5 leading-relaxed">{notice.text}</p>
        </div>
      )}

      <div className="card p-5 md:col-span-2">
        <h2 className="text-xl font-semibold text-amber-100">{adminT("adminImportExcelTitle")}</h2>
        <p className="mt-2 text-sm text-amber-100/80">{adminT("adminImportExcelHint")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Chủ đề câu hỏi" />
          <input
            className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
            type="number"
            min={1}
            max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            title="Độ khó 1–5"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-amber-100">
            {adminT("adminImportLocale")}
            <select
              className="rounded-lg border border-white/20 bg-black/20 px-2 py-1"
              value={importLocale}
              onChange={(e) => setImportLocale(e.target.value as "vi" | "en" | "zh" | "ko")}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ko">한국어</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-amber-100">
            <input type="radio" name="importMode" checked={importMode === "append"} onChange={() => setImportMode("append")} />
            {adminT("adminImportModeAppend")}
          </label>
          <label className="flex items-center gap-2 text-sm text-amber-100">
            <input type="radio" name="importMode" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />
            {adminT("adminImportModeReplace")}
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={importExcelInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block max-w-full text-sm text-amber-100 file:mr-2 file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void importExcelQuestions()}
            className="rounded-lg bg-violet-500 px-3 py-2 font-semibold text-black hover:bg-violet-400 disabled:opacity-60"
          >
            {adminT("adminImportSubmit")}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-xl font-semibold text-amber-100">{adminT("adminConfigTitle")}</h2>
        <div className="mt-3 grid gap-2">
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" value={configCode} onChange={(e) => setConfigCode(e.target.value)} placeholder="Mã cấu hình" />
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" type="number" min={1} max={100} value={questionsPerRun} onChange={(e) => setQuestionsPerRun(Number(e.target.value))} />
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" type="number" min={30} max={3600} value={timeLimitSec} onChange={(e) => setTimeLimitSec(Number(e.target.value))} />
          <button disabled={loading} onClick={() => void createConfig()} className="rounded-lg bg-sky-500 px-3 py-2 font-semibold text-black hover:bg-sky-400 disabled:opacity-60">
            {adminT("adminConfigCta")}
          </button>
        </div>
      </div>

      <div className="card p-5 md:col-span-2">
        <h2 className="text-xl font-semibold text-amber-100">{adminT("adminPuzzleGenTitle")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" value={puzzleCode} onChange={(e) => setPuzzleCode(e.target.value)} placeholder="Mã puzzle" />
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" value={puzzleName} onChange={(e) => setPuzzleName(e.target.value)} placeholder="Tên puzzle" />
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" type="number" min={4} max={64} value={pieceCount} onChange={(e) => setPieceCount(Number(e.target.value))} />
          <button disabled={loading} onClick={() => void createPuzzle()} className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60">
            {adminT("adminPuzzleCta")}
          </button>
        </div>
      </div>

      <div className="card p-5 md:col-span-2">
        <h2 className="text-xl font-semibold text-amber-100">{adminT("adminHeroTitle")}</h2>
        <p className="mt-1 text-sm text-gray-400">{adminT("adminHeroI18nHint")}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" value={slideTitle} onChange={(e) => setSlideTitle(e.target.value)} placeholder="Tiêu đề" />
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" value={slideImageUrl} onChange={(e) => setSlideImageUrl(e.target.value)} placeholder="URL ảnh" />
          <input className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" value={slideDescription} onChange={(e) => setSlideDescription(e.target.value)} placeholder="Mô tả" />
          <div className="flex gap-2">
            <input
              type="number"
              className="w-24 rounded-lg border border-white/20 bg-black/20 px-3 py-2"
              value={slideOrder}
              onChange={(e) => setSlideOrder(Number(e.target.value))}
            />
            <button disabled={loading} onClick={() => void createSlide()} className="rounded-lg bg-fuchsia-500 px-3 py-2 font-semibold text-black hover:bg-fuchsia-400 disabled:opacity-60">
              {adminT("adminAddSlide")}
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {slides.map((slide) => (
            <div key={slide.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-amber-100">
                  [{slide.orderIndex}] {slide.title}
                </p>
                <p className="truncate text-xs text-gray-300">{slide.imageUrl}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void toggleSlideActive(slide.id, slide.active)}
                  className="rounded-md bg-sky-500 px-2 py-1 text-xs font-semibold text-black"
                >
                  {slide.active ? adminT("adminToggleOff") : adminT("adminToggleOn")}
                </button>
                <button onClick={() => void deleteSlide(slide.id)} className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white">
                  {adminT("adminDelete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
