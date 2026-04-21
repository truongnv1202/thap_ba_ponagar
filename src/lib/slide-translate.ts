/**
 * Dịch tiêu đề / mô tả slide hero sang en, zh, ko (nguồn mặc định: tiếng Việt).
 * Dùng MyMemory public API (không cần key; có giới hạn tần suất — gọi tuần tự).
 */

export type SlideI18nPayload = Record<string, { title: string; description: string | null }>;

const MYMEMORY = "https://api.mymemory.translated.net/get";

/** Cặp MyMemory từ tiếng Việt */
const VI_TO: Record<"en" | "zh" | "ko", string> = {
  en: "vi|en",
  zh: "vi|zh-CN",
  ko: "vi|ko",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateOne(text: string, langpair: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const url = `${MYMEMORY}?q=${encodeURIComponent(trimmed)}&langpair=${encodeURIComponent(langpair)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return trimmed;
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    const out = data.responseData?.translatedText?.trim();
    if (!out) return trimmed;
    return out;
  } catch {
    return trimmed;
  } finally {
    clearTimeout(t);
  }
}

export async function buildHomeSlideI18n(
  title: string,
  description: string | null | undefined,
): Promise<SlideI18nPayload> {
  const desc = description?.trim() ? description.trim() : null;
  const vi = { title: title.trim(), description: desc };

  if (process.env.SLIDE_I18N_DISABLE === "1" || process.env.SLIDE_I18N_DISABLE === "true") {
    return {
      vi,
      en: { title: vi.title, description: vi.description },
      zh: { title: vi.title, description: vi.description },
      ko: { title: vi.title, description: vi.description },
    };
  }

  const out: SlideI18nPayload = { vi };

  for (const lang of ["en", "zh", "ko"] as const) {
    const pair = VI_TO[lang];
    const tTitle = await translateOne(vi.title, pair);
    await sleep(250);
    const tDesc = vi.description ? await translateOne(vi.description, pair) : null;
    await sleep(250);
    out[lang] = { title: tTitle, description: tDesc };
  }

  return out;
}
