"""Quét từng frame của video ViSignLanguage (thư mục train): đánh dấu frame đơn sắc (đệm),
lưu ảnh thu nhỏ frame thật để tìm video gốc của các bản bị cắt/đệm.
Chạy (venv): python training/eval/scan_frames.py --data .eval
"""
import argparse, json, os
from multiprocessing import Pool
import numpy as np, cv2


def scan(p):
    c = cv2.VideoCapture(p); solid, thumbs = [], []
    while True:
        ok, f = c.read()
        if not ok: break
        s = f.reshape(-1, 3).std(0).max() < 3.0  # mọi kênh gần như hằng số → frame một màu
        solid.append(bool(s))
        thumbs.append(cv2.resize(f, (16, 16), interpolation=cv2.INTER_AREA).astype(np.uint8))
    return solid, np.array(thumbs)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); a = ap.parse_args()
    z = np.load(os.path.join(a.data, "landmarks_raw.npz")); names = [str(n) for n in z["names"]]
    clean = [i for i in range(len(names)) if "private_test" not in names[i]]
    with Pool(12) as pool:
        res = pool.map(scan, [names[i] for i in clean], chunksize=16)
    out = {}
    thumbs = {}
    for i, (s, t) in zip(clean, res):
        out[str(i)] = s; thumbs[str(i)] = t
    json.dump(out, open(os.path.join(a.data, "solid_frames.json"), "w"))
    np.savez_compressed(os.path.join(a.data, "thumbs16.npz"), **thumbs)
    n = [sum(s) for s in out.values()]
    print("video có frame đơn sắc:", sum(x > 0 for x in n), "/", len(n), "· trung bình", round(np.mean([x for x in n if x]), 1), "frame đệm")


if __name__ == "__main__":
    main()
