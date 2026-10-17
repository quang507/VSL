// Phản hồi khi đúng/sai. Người điếc dựa vào RUNG + NHÁY VIỀN (component Flash);
// âm thanh chỉ là tuỳ chọn cho người nghe trong gia đình.
// Âm tạo bằng WebAudio nên KHÔNG cần file nhạc.
import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";

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

/** Máy này rung được không: bản cài (iOS/Android) luôn được; trình duyệt thì tuỳ (Safari iPhone không có). */
export function canVibrate(): boolean {
  if (typeof navigator === "undefined") return false;
  return Capacitor.isNativePlatform() || typeof navigator.vibrate === "function";
}

// Đúng: 1 nhịp "thành công". Sai: 2 nhịp "lỗi" cách nhau, để phân biệt bằng xúc giác.
function vibrate(ok: boolean) {
  try {
    if (Capacitor.isNativePlatform()) {
      const type = ok ? NotificationType.Success : NotificationType.Error;
      void Haptics.notification({ type }).catch(() => {});
      if (!ok) setTimeout(() => void Haptics.notification({ type }).catch(() => {}), 320);
    } else {
      navigator.vibrate?.(ok ? [0, 35, 40, 35] : [0, 120, 80, 120]);
    }
  } catch {
    /* máy không hỗ trợ rung */
  }
}

export interface FeedbackOpts {
  sound: boolean;
  vibrate: boolean;
}

export function signal(ok: boolean, o: FeedbackOpts) {
  if (o.vibrate) vibrate(ok);
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

/** Phát âm tiếng Việt bằng giọng nói (cho người nghe trong gia đình). */
export function speakVietnamese(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    const vi = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("vi"));
    if (vi) u.voice = vi;
    window.speechSynthesis.speak(u);
  } catch {
    /* bỏ qua nếu browser chặn */
  }
}
