// =============================================================================
// storage.js — Lưu và đọc dữ liệu chơi (save data, GDD mục 5.4 và 8.4).
//
// Dữ liệu lưu gồm 3 phần, mỗi phần do một file quản lý:
//   progress (progress.js), economy (economy.js), settings (cài đặt, ở đây).
//
// Lưu vào localStorage của trình duyệt dưới một khoá duy nhất, dạng JSON.
// localStorage có thể KHÔNG dùng được: chế độ ẩn danh, người dùng chặn dữ liệu
// trang web, bộ nhớ đầy, hoặc chạy trong Node (khi test). Vì vậy MỌI lần đọc/ghi
// đều bọc try/catch: lỗi thì game vẫn chạy bình thường với dữ liệu trong bộ nhớ,
// chỉ là không lưu được giữa các lần mở game.
//
// Đây là file "luật" duy nhất được chạm tới localStorage. Để test được trong
// Node, mọi hàm nhận tham số `storage` (bất kỳ đối tượng nào có getItem /
// setItem / removeItem); mặc định là localStorage của trình duyệt nếu có.
// =============================================================================

import { createProgress } from './progress.js';
import { createEconomy } from './economy.js';

/** Khoá trong localStorage. */
export const SAVE_KEY = 'the-rook-chess/save';
/** Phiên bản định dạng save. Tăng lên khi đổi cấu trúc, và viết thêm bước chuyển đổi. */
export const SAVE_VERSION = 1;

/** Cài đặt mặc định (màn Settings, GDD mục 7.1). */
export function createSettings() {
  return { sound: true, music: true, vibration: true, showLegalMoves: true };
}

/** Tạo save data mới cho người chơi lần đầu mở game. */
export function createSave() {
  return { version: SAVE_VERSION, progress: createProgress(), economy: createEconomy(), settings: createSettings() };
}

/**
 * Lấy localStorage của trình duyệt một cách an toàn. Chỉ đọc biến
 * `globalThis.localStorage` thôi cũng có thể ném lỗi (trình duyệt chặn
 * dữ liệu trang web), nên phải bọc try/catch. Không có thì trả null.
 */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Trộn dữ liệu đọc được vào giá trị mặc định: trường nào thiếu (save cũ, hoặc
 * bị sửa tay) thì lấy mặc định; trường nào có thì giữ. Chỉ trộn đệ quy với
 * đối tượng thường, còn mảng và giá trị đơn lấy nguyên.
 * Trường có kiểu khác mặc định (ví dụ coins là chuỗi) thì bỏ, lấy mặc định.
 */
function mergeDefaults(defaults, data) {
  if (!isPlainObject(data)) return defaults;
  const result = { ...defaults };
  for (const [key, value] of Object.entries(data)) {
    const def = defaults[key];
    if (def === undefined) {
      result[key] = value; // trường không có trong mặc định (ví dụ id level trong "solved")
    } else if (isPlainObject(def)) {
      result[key] = mergeDefaults(def, value);
    } else if (def === null || (typeof def === typeof value && Array.isArray(def) === Array.isArray(value))) {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Đọc save data. Không bao giờ ném lỗi: chưa có save, JSON hỏng, phiên bản
 * không hiểu được, hoặc không truy cập được localStorage đều trả về save mới.
 * Trả về { save, status } với status là 'loaded' | 'new' | 'corrupt' | 'unavailable'
 * để giao diện có thể báo "không lưu được tiến trình" nếu muốn.
 */
export function loadSave(storage = defaultStorage()) {
  if (!storage) return { save: createSave(), status: 'unavailable' };
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { save: createSave(), status: 'unavailable' };
  }
  if (raw === null || raw === undefined) return { save: createSave(), status: 'new' };
  try {
    const data = JSON.parse(raw);
    if (!isPlainObject(data) || data.version !== SAVE_VERSION) return { save: createSave(), status: 'corrupt' };
    return { save: mergeDefaults(createSave(), data), status: 'loaded' };
  } catch {
    return { save: createSave(), status: 'corrupt' };
  }
}

/**
 * Ghi save data. Trả về true nếu ghi được, false nếu không (không có
 * localStorage, bộ nhớ đầy, bị chặn...). Không bao giờ ném lỗi.
 */
export function writeSave(save, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Xoá save data (nút "reset tiến trình" trong Settings) và trả về save mới.
 * Xoá không được thì vẫn trả save mới, lần ghi sau sẽ đè lên.
 */
export function resetSave(storage = defaultStorage()) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // bỏ qua: không xoá được cũng không sao
  }
  return createSave();
}
