// =============================================================================
// ui/sound.js — Âm thanh tổng hợp bằng Web Audio, không dùng file âm thanh nào.
//
// Mỗi âm là vài bộ dao động (oscillator) hoặc tiếng ồn trắng (noise) đi qua bộ
// lọc và đường bao âm lượng (gain envelope): bật lên rất nhanh rồi tắt dần.
// Bảng âm thanh theo GDD mục 7.3: đi quân "cạch" nhẹ, ăn quân mạnh hơn, chiếu
// là âm cảnh báo, đi sai là âm trầm, chiếu hết là âm chiến thắng.
//
// Trình duyệt chỉ cho phát âm thanh sau khi người dùng chạm/bấm lần đầu, nên
// AudioContext được tạo "lười" ở lần phát đầu tiên (luôn xảy ra sau một cú chạm).
// =============================================================================

let ctx = null;
let enabled = true;

/** Bật/tắt toàn bộ âm thanh (theo cài đặt của người chơi). */
export function setSoundEnabled(on) {
  enabled = on;
}

/** Lấy AudioContext, tạo mới nếu chưa có. Trình duyệt không hỗ trợ thì trả null. */
function audio() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Phát một nốt: dao động dạng `type` ở tần số `freq` (Hz), bắt đầu sau `delay`
 * giây, dài `dur` giây, âm lượng đỉnh `vol`. `slideTo` (không bắt buộc) làm
 * tần số trượt dần tới giá trị đó (nghe như "rơi xuống" hoặc "vút lên").
 */
function tone(freq, { type = 'sine', delay = 0, dur = 0.15, vol = 0.2, slideTo } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/**
 * Tiếng "cạch" của quân gỗ: một chút tiếng ồn trắng rất ngắn đi qua bộ lọc
 * dải tần (bandpass) quanh `freq` Hz.
 */
function knock(freq, vol, dur = 0.06) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const length = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const gain = ac.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

/** Các âm dùng trong game. */
export const sounds = {
  /** Chạm chọn quân / bấm nút. */
  tap: () => tone(880, { type: 'triangle', dur: 0.05, vol: 0.06 }),
  /** Đi quân: "cạch" nhẹ. */
  move: () => { knock(1800, 0.9); tone(420, { type: 'triangle', dur: 0.07, vol: 0.08 }); },
  /** Ăn quân: tiếng gõ trầm và mạnh hơn. */
  capture: () => { knock(900, 1.4, 0.09); tone(220, { type: 'triangle', dur: 0.12, vol: 0.14 }); },
  /** Chiếu: hai nốt cảnh báo ngắn. */
  check: () => { tone(988, { type: 'square', dur: 0.08, vol: 0.05 }); tone(1319, { type: 'square', delay: 0.09, dur: 0.1, vol: 0.05 }); },
  /** Đi sai: âm trầm trượt xuống. */
  wrong: () => tone(220, { type: 'sawtooth', dur: 0.32, vol: 0.09, slideTo: 110 }),
  /** Chiếu hết: hợp âm rải Đô – Mi – Son – Đô. */
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', delay: i * 0.09, dur: 0.35, vol: 0.14 })),
  /** Coin bay vào ví: tiếng "ting" cao. */
  coin: () => { tone(1568, { type: 'sine', dur: 0.12, vol: 0.1 }); tone(2093, { type: 'sine', delay: 0.07, dur: 0.18, vol: 0.08 }); },
};
