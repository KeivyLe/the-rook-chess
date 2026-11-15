// =============================================================================
// ui/i18n.js — Đa ngôn ngữ cho giao diện (15 ngôn ngữ, mặc định tiếng Anh).
//
// Mỗi ngôn ngữ là một file trong ui/i18n/ (en.js, de.js, ...) xuất ra một đối
// tượng { khoá: chuỗi }. Chuỗi có chỗ điền dạng {tên}, ví dụ "Mate in {n}".
// Chuỗi phụ thuộc số nhiều viết dạng đối tượng { one, few, many, other } và được
// chọn bằng Intl.PluralRules của trình duyệt (tiếng Nga, Ba Lan có 3–4 dạng).
// Thiếu khoá ở một ngôn ngữ thì dùng tiếng Anh (test i18n.test.js bắt lỗi thiếu).
//
// File này không đụng DOM, chỉ là hàm thuần, nên test được bằng Node.
// =============================================================================

import en from './i18n/en.js';
import de from './i18n/de.js';
import fr from './i18n/fr.js';
import ja from './i18n/ja.js';
import es from './i18n/es.js';
import pt from './i18n/pt.js';
import ko from './i18n/ko.js';
import ru from './i18n/ru.js';
import id from './i18n/id.js';
import hi from './i18n/hi.js';
import it from './i18n/it.js';
import tr from './i18n/tr.js';
import zh from './i18n/zh.js';
import pl from './i18n/pl.js';
import vi from './i18n/vi.js';

/** Ngôn ngữ mặc định (yêu cầu chủ dự án: tiếng Anh). */
export const DEFAULT_LANGUAGE = 'en';

/** Danh sách ngôn ngữ theo thứ tự hiển thị, tên viết bằng chính ngôn ngữ đó. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'ja', name: '日本語' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ko', name: '한국어' },
  { code: 'ru', name: 'Русский' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'it', name: 'Italiano' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh', name: '简体中文' },
  { code: 'pl', name: 'Polski' },
  { code: 'vi', name: 'Tiếng Việt' },
];

/** Từ điển của mọi ngôn ngữ, theo mã. */
export const DICTIONARIES = { en, de, fr, ja, es, pt, ko, ru, id, hi, it, tr, zh, pl, vi };

/** Mã ngôn ngữ hợp lệ không; không hợp lệ thì dùng mặc định. */
export function normalizeLanguage(code) {
  return DICTIONARIES[code] ? code : DEFAULT_LANGUAGE;
}

/**
 * Tạo hàm dịch t(key, params) cho ngôn ngữ `lang`.
 *   - Tìm chuỗi trong ngôn ngữ đó, không có thì lấy tiếng Anh, không có nữa thì trả lại `key`.
 *   - Chuỗi dạng đối tượng (số nhiều): chọn dạng theo params.n bằng Intl.PluralRules.
 *   - Thay {tên} bằng params.tên.
 */
export function createTranslator(lang) {
  const code = normalizeLanguage(lang);
  const dict = DICTIONARIES[code];
  const plural = new Intl.PluralRules(code);
  return function t(key, params = {}) {
    let value = dict[key] ?? en[key];
    if (value === undefined) return key;
    if (typeof value === 'object') {
      const form = typeof params.n === 'number' ? plural.select(params.n) : 'other';
      value = value[form] ?? value.other;
    }
    return value.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? String(params[name]) : m));
  };
}

/**
 * Ngày "yyyymmdd" → "ngày + tên tháng" theo ngôn ngữ, ví dụ en "November 14",
 * vi "14 tháng 11", ja "11月14日". Dùng cho tiêu đề Daily.
 */
export function formatDayMonth(lang, key) {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))));
  return new Intl.DateTimeFormat(normalizeLanguage(lang), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

/** Ngày "yyyymmdd" → ngày/tháng ngắn theo ngôn ngữ (ví dụ "11/14", "14.11."), cho màn Trophy. */
export function formatShortDate(lang, key) {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))));
  return new Intl.DateTimeFormat(normalizeLanguage(lang), { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(date);
}
