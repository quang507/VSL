"""Đổi một video mẫu thành file .y4m để Chromium dùng làm CAMERA GIẢ.

Dùng cho scripts/eval-auto-capture.mjs: phát video người ký thật vào camera của app,
để kiểm tra chế độ tự chấm mà không cần người ngồi trước máy.

    python scripts/make_y4m.py "public/samples/Chào.mp4" out.y4m --lead 1 --tail 2

--lead / --tail: số giây đứng yên (lặp frame đầu / frame cuối) trước và sau khi ký,
giống người dùng để tay sẵn trong khung rồi mới ký. Chromium phát lặp lại file này.
"""
import argparse

import cv2


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--lead", type=float, default=1.0)
    ap.add_argument("--tail", type=float, default=2.0)
    a = ap.parse_args()

    cap = cv2.VideoCapture(a.src)
    fps = round(cap.get(cv2.CAP_PROP_FPS)) or 24
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        h, w = f.shape[:2]
        frames.append(f[: h - h % 2, : w - w % 2])  # I420 cần kích thước chẵn
    if not frames:
        raise SystemExit(f"Không đọc được video: {a.src}")

    h, w = frames[0].shape[:2]
    seq = [frames[0]] * int(a.lead * fps) + frames + [frames[-1]] * int(a.tail * fps)
    with open(a.dst, "wb") as out:
        out.write(f"YUV4MPEG2 W{w} H{h} F{fps}:1 Ip A1:1 C420jpeg\n".encode())
        for f in seq:
            out.write(b"FRAME\n")
            out.write(cv2.cvtColor(f, cv2.COLOR_BGR2YUV_I420).tobytes())
    print(f"{a.dst}: {len(seq)} frame, {w}x{h}, {fps} fps, {len(seq) / fps:.1f}s")


if __name__ == "__main__":
    main()
