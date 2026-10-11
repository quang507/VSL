"""Chuyển video mẫu (mpeg4 part 2, trình duyệt không đọc được) sang H.264 baseline.
Chạy: pip install imageio-ffmpeg && python training/transcode_samples.py
"""
import os, shutil, subprocess, sys, tempfile
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = os.path.join(ROOT, "public", "samples")
tmp = tempfile.mkdtemp(prefix="vsl_h264_")
ok = 0
for name in sorted(os.listdir(SAMPLES)):
    if not name.lower().endswith(".mp4"):
        continue
    src = os.path.join(SAMPLES, name)
    dst = os.path.join(tmp, name)
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                        "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0",
                        "-pix_fmt", "yuv420p", "-crf", "22", "-vf", "scale=448:448:flags=lanczos",
                        "-r", "24", "-movflags", "+faststart", "-an", dst])
    if r.returncode == 0 and os.path.getsize(dst) > 0:
        shutil.copyfile(dst, src)
        ok += 1
    else:
        print("lỗi:", name, file=sys.stderr)
print("Đã chuyển", ok, "video. Thư mục tạm:", tmp)
