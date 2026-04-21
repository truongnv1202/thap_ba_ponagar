import readXlsxFile, { type Row } from "read-excel-file/node";

export type ParsedRow = {
  content: string;
  choices: [string, string, string, string];
  correctIndex: number;
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Chuẩn hóa tiêu đề để khớp cột: bỏ dấu + gập đ/Đ → d (NFD không xử lý U+0111). */
function normHeader(s: string): string {
  const t = stripDiacritics(s.trim().toLowerCase()).replace(/\s+/g, " ");
  return t.replace(/\u0111/g, "d");
}

/**
 * Khớp tên cột. Ký tự đơn (A–D): chỉ đúng toàn cột. Pattern ≥4 ký tự: trùng đủ hoặc includes.
 * Pattern 2–3 ký tự: chỉ trùng đủ — tránh nhầm (vd. "dung" trong "không áp dung").
 */
function findCol(headers: string[], patterns: string[]): number {
  const normHeaders = headers.map((h) => normHeader(String(h ?? "")));
  for (const p of patterns) {
    const np = normHeader(p);
    const idx = normHeaders.findIndex((h) => {
      if (h === np) return true;
      if (np.length <= 1) return false;
      if (np.length <= 2) return false;
      return h.includes(np) || np.includes(h);
    });
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Tìm chỉ số cột Excel cho từng lựa chọn theo **tên cột** (tiêu đề hàng 1): A, B, C, D.
 * Đúng với bảng: Question | A | B | C | D | Correct — ô Correct ghi **tên cột** (A/B/C/D) trùng tiêu đề cột đáp án.
 */
function findChoiceColumnsByHeaderName(headerRow: string[]): { A: number; B: number; C: number; D: number } {
  const normHeaders = headerRow.map((h) => normHeader(String(h ?? "")));
  const idx: Partial<Record<"a" | "b" | "c" | "d", number>> = {};

  for (let j = 0; j < normHeaders.length; j++) {
    const h = normHeaders[j]!;
    if (h === "a" || h === "b" || h === "c" || h === "d") {
      const L = h as "a" | "b" | "c" | "d";
      if (idx[L] !== undefined) {
        throw new Error(
          `Duplicate column name "${L.toUpperCase()}" in header row (columns ${idx[L]! + 1} and ${j + 1}).`,
        );
      }
      idx[L] = j;
    }
  }

  for (let j = 0; j < normHeaders.length; j++) {
    const h = normHeaders[j]!;
    if (h === "a" || h === "b" || h === "c" || h === "d") continue;
    const m =
      h.match(/(?:answer|dap an|답)\s+([abcd])$/) ||
      h.match(/答案\s*([abcd])$/) ||
      h.match(/答案([abcd])$/);
    if (m) {
      const L = m[1] as "a" | "b" | "c" | "d";
      if (idx[L] === undefined) idx[L] = j;
    }
  }

  for (const L of ["a", "b", "c", "d"] as const) {
    if (idx[L] === undefined) {
      throw new Error(
        `Missing choice column "${L.toUpperCase()}". Row 1 needs headers A, B, C, D (one column per letter), e.g. Question | A | B | C | D | Correct.`,
      );
    }
  }

  return { A: idx.a!, B: idx.b!, C: idx.c!, D: idx.d! };
}

/** Cột đáp án đúng: ưu tiên khớp đủ; chỉ dùng includes với pattern đủ dài (≥ 5) để tránh bắt nhầm cột. */
function findCorrectColumn(headers: string[], patterns: string[]): number {
  const normHeaders = headers.map((h) => normHeader(String(h ?? "")));
  for (const p of patterns) {
    const np = normHeader(p);
    const exact = normHeaders.findIndex((h) => h === np);
    if (exact >= 0) return exact;
  }
  for (const p of patterns) {
    const np = normHeader(p);
    /* nho hon 4 ky tu: bo qua includes (giam false positive) */
    if (np.length < 4) continue;
    const idx = normHeaders.findIndex((h) => h.includes(np) || np.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Chuẩn hóa ký tự toàn dạng và khoảng trắng trước khi so khớp đáp án đúng. */
function normalizeCorrectCell(raw: string): string {
  const fullLetter: Record<string, string> = {
    "Ａ": "A", "Ｂ": "B", "Ｃ": "C", "Ｄ": "D", "ａ": "a", "ｂ": "b", "ｃ": "c", "ｄ": "d",
  };
  const fullDigit: Record<string, string> = {
    "０": "0", "１": "1", "２": "2", "３": "3", "４": "4", "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
  };
  let t = raw.trim();
  if (t.startsWith("=")) t = t.slice(1).trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    t = t.slice(1, -1).trim();
  }
  t = [...t].map((ch) => fullLetter[ch] ?? fullDigit[ch] ?? ch).join("");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Ô Correct chứa **tên cột** đáp án đúng: A / B / C / D (trùng tiêu đề cột), hoặc 1–4 (thứ tự A–D).
 * Không dùng so khớp nội dung chữ trong ô đáp án.
 */
function resolveCorrectColumnName(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n >= 1 && n <= 4) return n - 1;
  }
  const normalized = normalizeCorrectCell(String(raw ?? ""));
  if (!normalized) throw new Error("Empty correct answer");
  const stripDot = normalized.toUpperCase().replace(/[.)）］\]]+$/u, "");
  if (stripDot === "A" || stripDot === "1") return 0;
  if (stripDot === "B" || stripDot === "2") return 1;
  if (stripDot === "C" || stripDot === "3") return 2;
  if (stripDot === "D" || stripDot === "4") return 3;
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const n = Math.round(parseFloat(normalized));
    if (n >= 1 && n <= 4) return n - 1;
  }
  const one = stripDot.match(/^[ABCD]$/);
  if (one) return one[0]!.charCodeAt(0) - 65;
  throw new Error(
    `Correct must be column name A, B, C, or D (or number 1–4). Got: "${normalized}"`,
  );
}

function rowToStrings(row: Row): string[] {
  return row.map((cell) => {
    if (cell === null || cell === undefined) return "";
    if (typeof cell === "string") return cell;
    if (typeof cell === "number" || typeof cell === "boolean") return String(cell);
    if (cell instanceof Date) return cell.toISOString();
    return String(cell);
  });
}



/**
 * Cột: câu hỏi / question / 질문 / 题目 | đáp án A–D | đáp án đúng / correct / 정답 / 正确答案
 */

export async function parseQuestionsFromXlsxBuffer(buffer: Buffer): Promise<ParsedRow[]> {
  const sheets = await readXlsxFile(buffer);
  const first = sheets[0];
  if (!first) throw new Error("Excel has no sheets");
  const rows = first.data.map((r) => rowToStrings(r));
  if (rows.length < 2) throw new Error("Excel needs a header row and at least one data row");

  const headerRow = rows[0]!.map((c) => String(c ?? ""));
  const colQ = findCol(headerRow, [
    "question",
    "cau hoi",
    "câu hỏi",
    "질문",
    "题目",
    "noi dung",
    "nội dung",
  ]);
  let choiceCols: { A: number; B: number; C: number; D: number };
  try {
    choiceCols = findChoiceColumnsByHeaderName(headerRow);
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? e.message
        : "Could not find columns A, B, C, D by header name. Use row 1: Question | A | B | C | D | Correct.",
    );
  }
  const colCorrect = findCorrectColumn(headerRow, [
    "correct",
    "standard answer",
    "answer key",
    "dap an dung",
    "đáp án đúng",
    "dap an chuan",
    "đáp án chuẩn",
    "정답",
    "标准答案",
    "参考答案",
    "參考答案",
    "正确答案",
    "正確答案",
    "正确",
    "正確",
    "答案",
  ]);

  if (colQ < 0 || colCorrect < 0) {
    throw new Error(
      "Missing required columns. Need: question column + A/B/C/D choice columns + Correct (e.g. đáp án đúng / correct).",
    );
  }

  const out: ParsedRow[] = [];
  const dataRows = first.data;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const content = String(row[colQ] ?? "").trim();
    const a = String(row[choiceCols.A] ?? "").trim();
    const b = String(row[choiceCols.B] ?? "").trim();
    const c = String(row[choiceCols.C] ?? "").trim();
    const d = String(row[choiceCols.D] ?? "").trim();
    if (!content && !a && !b && !c && !d) continue;
    if (!content) throw new Error(`Row ${r + 1}: empty question`);
    const choices = [a, b, c, d] as [string, string, string, string];
    if (choices.some((x) => !x)) throw new Error(`Row ${r + 1}: all four choices (A–D) are required`);
    const cell = dataRows[r]?.[colCorrect];
    const correctRaw = cell !== undefined && cell !== null ? cell : row[colCorrect];
    const correctIndex = resolveCorrectColumnName(correctRaw);
    out.push({ content, choices, correctIndex });
  }

  if (out.length === 0) throw new Error("No question rows found");
  return out;
}
