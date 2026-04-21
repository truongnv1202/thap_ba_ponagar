export type SlideLocale = "vi" | "en" | "zh" | "ko";

export type SlideLocaleBlock = {
  title?: string;
  description?: string | null;
  imageUrl?: string;
};

export type SlideI18nJson = Partial<Record<Exclude<SlideLocale, "vi">, SlideLocaleBlock>>;

type SlideRow = {
  title: string;
  description: string | null;
  imageUrl: string;
  i18n: unknown;
};

function pickBlock(i18n: unknown, lang: SlideLocale): SlideLocaleBlock | undefined {
  if (!i18n || typeof i18n !== "object") return undefined;
  const rec = i18n as Record<string, SlideLocaleBlock>;
  return rec[lang];
}

/** `title` / `description` / `imageUrl` = tiếng Việt (mặc định). Các ngôn ngữ khác trong `i18n`. */
export function resolveSlideForLang(slide: SlideRow, lang: string): { title: string; description: string | null; imageUrl: string } {
  const normalized = (["vi", "en", "zh", "ko"] as const).includes(lang as SlideLocale)
    ? (lang as SlideLocale)
    : "vi";
  if (normalized === "vi") {
    return { title: slide.title, description: slide.description, imageUrl: slide.imageUrl };
  }
  const block = pickBlock(slide.i18n, normalized);
  return {
    title: block?.title?.trim() || slide.title,
    description: block?.description !== undefined ? block.description : slide.description,
    imageUrl: block?.imageUrl?.trim() || slide.imageUrl,
  };
}
