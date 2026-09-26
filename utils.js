/**
 * Petasos v2 - 汎用ユーティリティ関数
 */

// 現在日時文字列のフォーマット (例: "2026/09/25 12:30")
export function formatCurrentDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

// HTMLエスケープ（XSS防止および安全なテキストレンダリング）
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 企画書準拠のユニークNote ID生成: YYYYMMDD-HHmmss-[uuid8]
export function generateNoteId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 10);
  return `${y}${m}${d}-${hh}${mm}${ss}-${rand}`;
}

/**
 * カテゴリ文字列の正規化（空文字、inbox、未分類などを内部値 "" に統一）
 */
export function normalizeCategory(cat) {
  if (!cat) return "";
  const trimmed = String(cat).trim().replace(/^#/, "").trim();
  const lower = trimmed.toLowerCase();
  if (lower === "" || lower === "inbox" || lower === "未分類") {
    return "";
  }
  return trimmed;
}

/**
 * 作成・更新日時の動的相対時間フォーマット（今日、昨日、◯分前、◯日前など）
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  // 未来日時または1分以内の誤差
  if (diffMs < 60 * 1000) {
    return "たった今";
  }

  // 今日の判定（年・月・日が一致）
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    const diffHours = Math.floor(diffMs / (3600 * 1000));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
      return `${diffMins}分前`;
    }
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `今日 ${hh}:${mm}`;
  }

  // 昨日の判定
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `昨日 ${hh}:${mm}`;
  }

  // 2〜6日前
  const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));
  if (diffDays >= 2 && diffDays <= 6) {
    return `${diffDays}日前`;
  }

  // 7日以上前
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) {
    return `${m}月${day}日`;
  }
  return `${d.getFullYear()}/${m}/${day}`;
}

/**
 * 簡易Markdownパーサー（チェックリスト、箇条書き、見出し、空行対応）
 */
export function renderMarkdown(content, { interactive = false } = {}) {
  if (!content) return "";
  const lines = String(content).split("\n");

  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]")) {
      const dataAttr = interactive ? ` data-line-index="${idx}"` : "";
      return `<div class="todo-item"${dataAttr}><span class="todo-check"></span><span>${escapeHtml(trimmed.slice(5).trim())}</span></div>`;
    } else if (trimmed.startsWith("- [x]")) {
      const dataAttr = interactive ? ` data-line-index="${idx}"` : "";
      return `<div class="todo-item"${dataAttr}><span class="todo-check checked"></span><span style="text-decoration: line-through; opacity: 0.65;">${escapeHtml(trimmed.slice(5).trim())}</span></div>`;
    } else if (trimmed.startsWith("### ")) {
      return `<h4 class="md-heading-3">${escapeHtml(trimmed.slice(4))}</h4>`;
    } else if (trimmed.startsWith("## ")) {
      return `<h3 class="md-heading-2">${escapeHtml(trimmed.slice(3))}</h3>`;
    } else if (trimmed.startsWith("# ")) {
      return `<h2 class="md-heading-1">${escapeHtml(trimmed.slice(2))}</h2>`;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return `<div class="md-bullet-item"><span class="md-bullet-dot">•</span><span class="md-bullet-text">${escapeHtml(trimmed.slice(2).trim())}</span></div>`;
    } else if (trimmed === "") {
      return `<div class="md-empty-line"></div>`;
    }
    return `<div class="md-text-line">${escapeHtml(line)}</div>`;
  }).join("");
}


