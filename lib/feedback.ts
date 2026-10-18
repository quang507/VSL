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

// Hiệu ứng pháo hoa chúc mừng (Confetti) phong cách Duolingo / Lingvano
let activeConfettiCanvas: HTMLCanvasElement | null = null;
let activeConfettiRaf = 0;

export function fireConfetti() {
  if (typeof window === "undefined") return;
  try {
    if (activeConfettiCanvas) {
      cancelAnimationFrame(activeConfettiRaf);
      activeConfettiCanvas.remove();
      activeConfettiCanvas = null;
    }

    const canvas = document.createElement("canvas");
    activeConfettiCanvas = canvas;
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "99999";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      activeConfettiCanvas = null;
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#4a8cf5", "#fccf48", "#45a557", "#e854b2", "#ed8002", "#10aeda"];
    const pieces = Array.from({ length: 45 }, () => ({
      x: window.innerWidth * (0.3 + Math.random() * 0.4),
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 14 - 4,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    const start = performance.now();
    const render = (now: number) => {
      const elapsed = now - start;
      if (elapsed > 1800) {
        cancelAnimationFrame(activeConfettiRaf);
        if (activeConfettiCanvas === canvas) {
          canvas.remove();
          activeConfettiCanvas = null;
        }
        return;
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45; // gravity
        p.rot += p.vrot;
        p.opacity = Math.max(0, 1 - elapsed / 1800);
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      activeConfettiRaf = requestAnimationFrame(render);
    };
    activeConfettiRaf = requestAnimationFrame(render);
  } catch {}
}

export function signal(ok: boolean, o: FeedbackOpts) {
  if (o.vibrate) vibrate(ok);
  if (!o.sound) return;
  audio()?.resume(); // iOS cần resume sau tương tác người dùng
  if (ok) {
    // Âm chuông "ding" hài âm ngọt tai chuẩn Lingvano (C6 -> E6 -> G6)
    tone(1046.5, 0, 0.15, 0.18);
    tone(1318.5, 0.08, 0.18, 0.16);
    tone(1567.98, 0.16, 0.28, 0.2);
  } else {
    // Âm trầm đục báo sai nhẹ nhàng
    tone(220, 0, 0.15, 0.12);
    tone(175, 0.12, 0.22, 0.1);
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
    
    const applyVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const vi = voices.find((v) => v.lang.toLowerCase().replace(/_/g, "-").startsWith("vi"));
      if (vi) u.voice = vi;
      window.speechSynthesis.speak(u);
    };

    const currentVoices = window.speechSynthesis.getVoices();
    if (currentVoices.length > 0) {
      applyVoiceAndSpeak();
    } else {
      // Chrome/Edge có thể tải danh sách voices bất đồng bộ
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        applyVoiceAndSpeak();
      };
      // Fallback nói ngay nếu onvoiceschanged không kích hoạt
      setTimeout(() => {
        if (!window.speechSynthesis.speaking) {
          window.speechSynthesis.speak(u);
        }
      }, 250);
    }
  } catch {
    /* bỏ qua nếu browser chặn */
  }
}
