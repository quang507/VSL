// Giữ luồng camera trước cho các hook nhận diện.
// - App xuống nền (đổi tab, khoá máy): TẮT camera, khỏi tốn pin và giữ đèn camera.
//   Quay lại thì tự mở lại.
// - iOS hay tự kết thúc luồng (cuộc gọi đến, Siri, app khác dùng camera) mà không báo lỗi gì:
//   nghe sự kiện "ended" của track để mở lại.
// Lưu ý: track.stop() do mình gọi KHÔNG bắn "ended", nên không bị mở lại vòng vòng.

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "user", width: 640, height: 480 },
  audio: false,
};

/** Camera đứng hình chừng này (frame không đổi) thì coi là bị gián đoạn */
export const STALL_MS = 2000;

export function cameraErrorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Không truy cập được camera. Kiểm tra quyền camera.";
}

export interface CameraHandle {
  /** Lần mở đầu tiên; reject nếu không mở được (chưa cấp quyền, không có camera…).
   *  Lúc đó handle tự huỷ: không âm thầm bật camera sau lưng khi chưa có ai dùng. */
  ready: Promise<void>;
  /** Luồng hiện tại; null khi app đang ở nền hoặc đang mở lại */
  current(): MediaStream | null;
  /** Đóng rồi mở lại (người dùng bấm "mở lại camera") */
  reopen(): Promise<void>;
  dispose(): void;
}

export function openCamera(handlers: {
  /** Lỗi ở những lần MỞ LẠI (lần đầu thì `ready` reject) */
  onError: (e: unknown) => void;
  /** Đã mở lại được sau khi bị ngắt / quay lại từ nền */
  onReopen?: () => void;
}): CameraHandle {
  let stream: MediaStream | null = null;
  let disposed = false;
  let opening: Promise<void> | null = null;

  const close = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const open = (initial: boolean): Promise<void> => {
    if (disposed || stream || document.hidden) return opening ?? Promise.resolve();
    opening ??= (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (disposed || document.hidden) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        for (const t of s.getVideoTracks()) {
          t.addEventListener("ended", () => {
            if (stream !== s) return;
            stream = null;
            reopenQuietly();
          });
        }
        stream = s;
        if (!initial) handlers.onReopen?.();
      } catch (e) {
        if (initial) throw e;
        if (!disposed) handlers.onError(e);
      } finally {
        opening = null;
      }
    })();
    return opening;
  };

  // Có thể nhập chung promise của lần mở đầu (lần đó reject khi lỗi) → nuốt lỗi, `ready` đã báo
  const reopenQuietly = () => void open(false).catch(() => {});
  const onVisibility = () => {
    if (document.hidden) close();
    else reopenQuietly();
  };

  const dispose = () => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisibility);
    close();
  };

  document.addEventListener("visibilitychange", onVisibility);
  const ready = open(true).catch((e) => {
    dispose();
    throw e;
  });

  return {
    ready,
    current: () => stream,
    reopen: () => {
      close();
      return open(false).catch(() => {});
    },
    dispose,
  };
}
