"""Kiểm tra & chọn lại video mẫu (public/samples/<từ>.mp4) bằng dữ liệu đã rà + model sạch.

Mẫu cũ được chọn "file có dung lượng giữa" (fetch_samples.py) nên có thể dính video bị chèn
frame đơn sắc / bị cắt. Ở đây với mỗi từ:
  - xác định video nguồn của mẫu hiện tại (tái hiện cách chọn cũ)
  - mẫu bị coi là lỗi nếu: có frame đệm, thuộc nhóm mâu thuẫn nhãn, ít tay, hoặc model sạch
    không nhận ra (xác suất đúng < 0.5)
  - thay bằng video đầy đủ, không phải bản sao, model nhận đúng chắc nhất
Chỉ thay mẫu lỗi. Chạy (venv):
  python training/repick_samples.py --data .eval --model .eval/model_clean --ffmpeg <ffmpeg.exe> [--apply]
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, unicodedata
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "eval"))
from eval_and_train import load_tfjs, resample  # noqa: E402

nfc = lambda t: unicodedata.normalize("NFC", t)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--model", required=True); ap.add_argument("--ffmpeg", required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--keep", default="", help="từ giữ nguyên mẫu cũ sau khi xem tận mắt, cách nhau bởi dấu phẩy")
    a = ap.parse_args()
    z = np.load(os.path.join(a.data, "landmarks_raw.npz"))
    seqs = np.split(z["data"], np.cumsum(z["lens"])[:-1]); names = [str(n) for n in z["names"]]
    idx = {n: i for i, n in enumerate(names)}
    app = json.load(open(os.path.join(ROOT, "public", "labels.json"), encoding="utf-8"))
    S = {int(k): any(v) for k, v in json.load(open(os.path.join(a.data, "solid_frames.json"))).items()}
    A = json.load(open(os.path.join(a.data, "audit.json")))
    bad_src = set(A["drop_conflict"]) | set(A["drop_few"])
    m = load_tfjs(a.model)
    base = os.path.join(a.data, "videos", "dataset", "train")

    report, changes = [], []
    for li, lab in enumerate(app):
        folder = os.path.join(base, lab)
        if not os.path.isdir(folder):
            report.append((lab, "không có thư mục")); continue
        fs = sorted(os.listdir(folder), key=lambda f: os.path.getsize(os.path.join(folder, f)))
        cur = f"{base}/{lab}/{fs[len(fs) // 2]}".replace("\\", "/")
        ci = idx.get(cur)
        cands = [idx[p] for p in (f"{base}/{lab}/{f}".replace("\\", "/") for f in fs) if p in idx]
        P = m.predict(np.stack([resample(seqs[i]) for i in cands]), verbose=0)[:, li]
        prob = dict(zip(cands, P))
        issues = []
        if ci is None: issues.append("không có landmark")
        else:
            if S.get(ci): issues.append("có frame đệm")
            if ci in bad_src: issues.append("dữ liệu lỗi")
            if prob[ci] < 0.5: issues.append(f"model chỉ chắc {prob[ci]:.0%}")
        if not issues: continue
        good = [i for i in cands if not S.get(i) and i not in bad_src and not re.search(r"_\d+\.mp4$", names[i])]
        if not good:
            report.append((lab, ", ".join(issues), "không có video thay")); continue
        best = max(good, key=lambda i: (prob[i], len(seqs[i])))
        hard = ci is None or S.get(ci) or ci in bad_src  # lỗi dữ liệu thật → luôn thay
        if best == ci or (not hard and prob[best] - prob[ci] < 0.3):
            report.append((lab, ", ".join(issues), "giữ nguyên (không có video tốt hơn rõ rệt)")); continue
        report.append((lab, ", ".join(issues), f"→ {os.path.basename(names[best])} (model chắc {prob[best]:.0%})"))
        changes.append((lab, names[best]))

    keep = {nfc(k.strip()) for k in a.keep.split(",") if k.strip()}
    changes = [(lab, src) for lab, src in changes if nfc(lab) not in keep]
    for r in report: print(" · ".join(r) + (" · GIỮ (đã xem)" if nfc(r[0]) in keep else ""))
    print(len(changes), "mẫu cần thay")
    if a.apply and changes:
        tmp = tempfile.mkdtemp(prefix="vsl_repick_")
        for lab, src in changes:
            dst = os.path.join(tmp, lab + ".mp4")
            r = subprocess.run([a.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                                "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0", "-pix_fmt", "yuv420p",
                                "-crf", "22", "-vf", "scale=448:448:flags=lanczos", "-r", "24", "-movflags", "+faststart", "-an", dst])
            if r.returncode == 0 and os.path.getsize(dst) > 0:
                shutil.copyfile(dst, os.path.join(ROOT, "public", "samples", lab + ".mp4"))
            else:
                print("lỗi chuyển mã:", lab)
        json.dump({lab: os.path.basename(src) for lab, src in changes}, open(os.path.join(ROOT, "training", "samples_repicked.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("Đã thay", len(changes), "mẫu")


if __name__ == "__main__":
    main()
