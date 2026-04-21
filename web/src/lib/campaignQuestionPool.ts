/** ID câu đã dùng trong chiến dịch (theo guest) — mỗi level sau khi thắng sẽ cộng dồn để level sau không trùng. */

const LS_KEY = "pg_campaign_used_question_ids";

export function readExcludedQuestionIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function appendUsedQuestionIds(ids: string[]): void {
  if (ids.length === 0) return;
  const prev = readExcludedQuestionIds();
  const merged = [...new Set([...prev, ...ids])];
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
}

export function clearCampaignQuestionPool(): void {
  localStorage.removeItem(LS_KEY);
}
