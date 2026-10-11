"""Xuất dữ liệu đối chiếu để kiểm tra lib/landmarks.ts tính đặc trưng "face" Y HỆT Python.

Lấy vài video trong rich.npz: toạ độ tay thô, khung mặt từng frame, và vector đặc trưng
mà try_models.featurize(feat="face") tạo ra. Test tests/e2e/features.unit.ts đọc file này.

Chạy (trong .eval/venv): python training/eval/dump_feat_ref.py --data .eval --out tests/e2e/fixtures/face_features.json
"""
import argparse, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import try_models as tm  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=".eval"); ap.add_argument("--out", required=True); ap.add_argument("--n", type=int, default=6)
    a = ap.parse_args()
    D = tm.load(a.data)
    rng = np.random.default_rng(3)
    # ưu tiên video có cả hai tay ở vài frame, để kiểm cả phần "phải − trái"
    cand = [int(i) for i in rng.permutation(D["reps"]) if D["lens"][i] > 0]
    picked, two = [], 0
    for i in cand:
        h = D["hands"][i]; both = (np.abs(h).sum((2, 3)) > 0).all(1).any()
        if both and two < a.n // 2: picked.append(i); two += 1
        elif not both and len(picked) - two < a.n - a.n // 2: picked.append(i)
        if len(picked) == a.n: break
    out = []
    for i in picked:
        feat = tm.featurize(D, i, "face")
        hands = D["hands"][i]
        frames = []
        for t in range(len(hands)):
            hs = []
            for s, label in enumerate(("Left", "Right")):
                if np.abs(hands[t, s]).sum() > 0:
                    hs.append({"label": label, "points": [[float(x), float(y), float(z)] for x, y, z in hands[t, s]]})
            frames.append(hs)
        out.append({"video": os.path.basename(str(D["names"][i])) if "names" in D else str(i), "hands": frames,
                    "face": [[float(v) for v in f] for f in D["face"][i]], "features": [[round(float(v), 6) for v in row] for row in feat]})
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, "w", encoding="utf-8"))
    print(len(out), "video →", a.out)


if __name__ == "__main__":
    main()
