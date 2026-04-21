import type { AuthResponse, GameRunResponse, LeaderboardItem } from "./types";

/**
 * - Không set `VITE_API_BASE`: dev → `""` (cùng origin, proxy Vite `/api` → :4000, tránh CORS / nhầm host).
 *   Build production → `http://localhost:4000` trừ khi set `VITE_API_BASE` khi build.
 * - `VITE_API_BASE=` (rỗng): luôn dùng đường dẫn tương đối `/api` (cần proxy dev/preview hoặc reverse proxy).
 */
function resolveApiBase(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined;
  if (env !== undefined) return env;
  if (import.meta.env.DEV) return "";
  return "http://localhost:4000";
}

const API_BASE = resolveApiBase();

function messageFromApiError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Request failed";
  const err = (payload as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    if (o.fieldErrors && typeof o.fieldErrors === "object") {
      const parts = Object.entries(o.fieldErrors).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((msg) => `${k}: ${msg}`) : [],
      );
      if (parts.length) return parts.join(" · ");
    }
    if (o.formErrors?.length) return o.formErrors.join(" · ");
    try {
      return JSON.stringify(err);
    } catch {
      return "Request failed";
    }
  }
  return "Request failed";
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errorPayload = await res.json().catch(() => ({}));
    throw new Error(messageFromApiError(errorPayload));
  }
  return res.json() as Promise<T>;
}

async function requestForm<T>(path: string, body: FormData, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) {
    const errorPayload = await res.json().catch(() => ({}));
    const err = errorPayload as { error?: string | { formErrors?: unknown } };
    const msg =
      typeof err.error === "string"
        ? err.error
        : err.error && typeof err.error === "object"
          ? JSON.stringify(err.error)
          : "Request failed";
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  register(payload: { email: string; password: string; displayName: string }) {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  startRun(payload: {
    configCode?: string;
    puzzleCode: string;
    guestKey?: string;
    locale?: "vi" | "en" | "zh" | "ko";
    /** Không chọn lại các câu đã dùng ở các cấp trước (chiến dịch hiện tại). */
    excludedQuestionIds?: string[];
  }) {
    return request<GameRunResponse>(
      "/api/game/runs",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
  submitAnswer(
    runId: string,
    payload:
      | { runQuestionId: string; selectedChoiceId: string }
      | { runQuestionId: string; selectedLetter: string }
      | { runQuestionId: string; selectedOrderIndex: number },
    runAccessToken: string,
  ) {
    return request<{
      runId: string;
      isCorrect: boolean;
      totalAnswered: number;
      totalCorrect: number;
      totalQuestions: number;
      quizFinished: boolean;
      puzzleUnlocked: boolean;
      runStatus: string;
    }>(
      `/api/game/runs/${runId}/answers`,
      {
        method: "POST",
        headers: { "x-run-access-token": runAccessToken },
        body: JSON.stringify(payload),
      },
    );
  },
  getPieces(runId: string, runAccessToken: string) {
    return request<{
      runId: string;
      totalPieces: number;
      imageUrl: string;
      pieces: Array<{
        pieceId: string;
        pieceCode: string;
        correctSlot: number;
        displayOrder: number;
      }>;
    }>(`/api/game/runs/${runId}/pieces`, { headers: { "x-run-access-token": runAccessToken } });
  },
  placePiece(runId: string, payload: { pieceId: string; slotPosition: number }, runAccessToken: string) {
    return request<{ pieceId: string; slotPosition: number; isCorrectPosition: boolean }>(
      `/api/game/runs/${runId}/placements`,
      { method: "POST", headers: { "x-run-access-token": runAccessToken }, body: JSON.stringify(payload) },
    );
  },
  finalize(runId: string, runAccessToken: string) {
    return request<{
      won: boolean;
      scoreTotal: number;
      completionTimeSec: number;
      rank: number;
      isTop3: boolean;
      message: string;
      messageKey?: "won_top3" | "won_rank" | "lost";
    }>(`/api/game/runs/${runId}/finalize`, {
      method: "POST",
      headers: { "x-run-access-token": runAccessToken },
    });
  },
  submitWinnerProfile(runId: string, payload: { playerName: string; playerAge: number }, runAccessToken: string) {
    return request<{ ok: boolean; rank: number }>(
      `/api/game/runs/${runId}/winner-profile`,
      { method: "POST", headers: { "x-run-access-token": runAccessToken }, body: JSON.stringify(payload) },
    );
  },
  leaderboard() {
    return request<{ items: LeaderboardItem[] }>("/api/leaderboard");
  },
  campaignLeaderboard(level: number) {
    return request<{
      level: number;
      items: Array<{
        rank: number;
        userId: string;
        displayName: string;
        totalTimeSec: number;
        highestLevel: number;
        completedAt: string | null;
      }>;
    }>(`/api/leaderboard/campaign?level=${level}`);
  },
  createConfig(
    payload: { code: string; questionsPerRun: number; minCorrectUnlockPuzzle: number; timeLimitSec: number; active?: boolean },
    token: string,
  ) {
    return request(
      "/api/admin/configs",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  importQuestionsFromExcel(
    file: File,
    fields: {
      locale: "vi" | "en" | "zh" | "ko";
      importMode: "append" | "replace";
      topic?: string;
      difficulty?: number;
    },
    token: string,
  ) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("locale", fields.locale);
    fd.append("importMode", fields.importMode);
    if (fields.topic) fd.append("topic", fields.topic);
    if (fields.difficulty != null) fd.append("difficulty", String(fields.difficulty));
    return requestForm<{ created: number; locale: string; importMode: string; message: string }>(
      "/api/admin/questions/import-excel",
      fd,
      token,
    );
  },
  createPuzzleTemplate(
    payload: { code: string; name: string; pieces: Array<{ pieceCode: string; correctSlot: number }> },
    token: string,
  ) {
    return request(
      "/api/admin/puzzle-templates",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  getPublicSlides() {
    return request<{
      items: Array<{
        id: string;
        title: string;
        description: string | null;
        imageUrl: string;
        i18n?: Record<string, { title?: string; description?: string | null }> | null;
        orderIndex: number;
        active: boolean;
      }>;
    }>("/api/public/slides");
  },
  getAdminSlides(token: string) {
    return request<{
      items: Array<{
        id: string;
        title: string;
        description: string | null;
        imageUrl: string;
        i18n?: Record<string, { title?: string; description?: string | null }> | null;
        orderIndex: number;
        active: boolean;
      }>;
    }>("/api/admin/slides", {}, token);
  },
  createSlide(
    payload: { title: string; description?: string; imageUrl: string; orderIndex: number; active?: boolean },
    token: string,
  ) {
    return request("/api/admin/slides", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  updateSlide(
    id: string,
    payload: { title?: string; description?: string; imageUrl?: string; orderIndex?: number; active?: boolean },
    token: string,
  ) {
    return request(`/api/admin/slides/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
  },
  deleteSlide(id: string, token: string) {
    return request(`/api/admin/slides/${id}`, { method: "DELETE" }, token);
  },
};
