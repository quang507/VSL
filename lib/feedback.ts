// Phản hồi khi đúng/sai. Người điếc dựa vào RUNG + NHÁY VIỀN (component Flash);
// âm thanh chỉ là tuỳ chọn cho người nghe trong gia đình.
// Âm tạo bằng WebAudio nên KHÔNG cần file nhạc.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.15) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur);
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* máy không hỗ trợ rung */
  }
}

export interface FeedbackOpts {
  sound: boolean;
  vibrate: boolean;
}

export function signal(ok: boolean, o: FeedbackOpts) {
  if (o.vibrate) vibrate(ok ? [0, 35, 40, 35] : [0, 120, 80, 120]);
  if (!o.sound) return;
  audio()?.resume(); // iOS cần resume sau tương tác người dùng
  if (ok) {
    tone(660, 0, 0.12);
    tone(880, 0.1, 0.18);
  } else {
    tone(200, 0, 0.25, 0.12);
  }
}

// Giữ API cũ để không vỡ chỗ khác đang gọi
export const feedbackCorrect = (on: boolean) => signal(true, { sound: on, vibrate: on });
export const feedbackWrong = (on: boolean) => signal(false, { sound: on, vibrate: on });
