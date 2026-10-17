#!/usr/bin/env python3
"""
scripts/optimize-videos.py
Tối ưu hóa video bài học Ngôn ngữ ký hiệu (VSL):
1. Nén dung lượng cực thấp bằng H.264 (CRF 26-28), web-ready (+faststart).
2. Tăng cường độ nét ở vùng bàn tay & khẩu hình mặt (unsharp filter).
3. Cố định chu kỳ keyframe (GOP=30) giúp chế độ rùa (Turtle Mode 0.5x) tua mượt, không giật hình.
4. Hỗ trợ chuẩn hóa tỷ lệ 1:1 (vuông) hoặc 16:9 (ngang).

Yêu cầu: Đã cài đặt ffmpeg trên hệ thống.
Cách dùng:
    python scripts/optimize-videos.py --input input.mp4 --output output.mp4 --ratio 1:1
    python scripts/optimize-videos.py --input-dir raw_videos/ --output-dir public/videos/ --ratio 16:9
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def optimize_video(
    src_path: Path,
    dst_path: Path,
    ratio: str = "16:9",
    crf: int = 27,
    preset: str = "medium",
    fps: int = 30,
) -> bool:
    """Tối ưu 1 video với ffmpeg."""
    dst_path.parent.mkdir(parents=True, exist_ok=True)

    # Bộ lọc hình ảnh:
    # - scale & pad theo tỷ lệ mong muốn
    # - unsharp: làm nét biên cử chỉ ngón tay và khóe miệng
    #   (luma_msize_x:luma_msize_y:luma_amount:chroma_msize_x:chroma_msize_y:chroma_amount)
    unsharp_filter = "unsharp=5:5:0.6:3:3:0.0"

    if ratio == "1:1":
        # Chuẩn hóa về 720x720, giữ tỉ lệ gốc và crop/pad giữa
        scale_filter = "scale=720:720:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:(oh-ih)/2:black"
    else:
        # Chuẩn hóa 16:9 (1280x720)
        scale_filter = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black"

    vf = f"{scale_filter},{unsharp_filter},fps={fps}"

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(src_path),
        "-vf", vf,
        "-c:v", "libx264",
        "-crf", str(crf),
        "-preset", preset,
        "-profile:v", "high",
        "-level", "4.0",
        "-pix_fmt", "yuv420p",
        # GOP=30 đảm bảo mỗi giây có 1 keyframe -> Turtle mode 0.5x không bị nhòe/khựng
        "-g", str(fps),
        "-keyint_min", str(fps),
        "-sc_threshold", "0",
        # faststart đưa moov atom lên đầu file để load tức thì trên trình duyệt/mobile
        "-movflags", "+faststart",
        # Tắt âm thanh thừa nếu là video ký hiệu thuần túy
        "-an",
        str(dst_path),
    ]

    print(f"-> Đang xử lý: {src_path.name} -> {dst_path.name}")
    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print(f"Lỗi khi xử lý {src_path.name}:\n{res.stderr}", file=sys.stderr)
        return False

    orig_size = src_path.stat().st_size / 1024
    new_size = dst_path.stat().st_size / 1024
    saved = (1 - (new_size / orig_size)) * 100 if orig_size > 0 else 0
    print(f"   Hoàn thành: {orig_size:.1f} KB -> {new_size:.1f} KB (giảm {saved:.1f}%)")
    return True


def main():
    parser = argparse.ArgumentParser(description="Tối ưu video bài học VSL chuẩn Lingvano")
    parser.add_argument("--input", "-i", type=str, help="Đường dẫn file video đầu vào")
    parser.add_argument("--output", "-o", type=str, help="Đường dẫn file video xuất ra")
    parser.add_argument("--input-dir", type=str, help="Thư mục chứa video đầu vào")
    parser.add_argument("--output-dir", type=str, help="Thư mục xuất video")
    parser.add_argument("--ratio", choices=["1:1", "16:9"], default="16:9", help="Tỷ lệ khung hình (1:1 hoặc 16:9)")
    parser.add_argument("--crf", type=int, default=27, help="Mức nén CRF (24-30, mặc định 27)")

    args = parser.parse_args()

    if not check_ffmpeg():
        print("Lỗi: Không tìm thấy ffmpeg trên hệ thống. Vui lòng cài đặt ffmpeg.", file=sys.stderr)
        sys.exit(1)

    if args.input and args.output:
        ok = optimize_video(Path(args.input), Path(args.output), ratio=args.ratio, crf=args.crf)
        sys.exit(0 if ok else 1)

    if args.input_dir and args.output_dir:
        in_dir = Path(args.input_dir)
        out_dir = Path(args.output_dir)
        extensions = {".mp4", ".mov", ".m4v", ".webm"}
        files = [p for p in in_dir.iterdir() if p.suffix.lower() in extensions]
        if not files:
            print(f"Không tìm thấy video nào trong {in_dir}")
            sys.exit(0)

        success = 0
        for f in files:
            dst = out_dir / f"{f.stem}.mp4"
            if optimize_video(f, dst, ratio=args.ratio, crf=args.crf):
                success += 1
        print(f"\nĐã tối ưu thành công {success}/{len(files)} video.")
        sys.exit(0)

    parser.print_help()


if __name__ == "__main__":
    main()
