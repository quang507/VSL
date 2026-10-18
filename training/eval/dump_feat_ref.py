"""Xuất dữ liệu đối chiếu để kiểm tra lib/landmarks.ts tính đặc trưng "face" Y HỆT Python.

Lấy vài video trong rich.npz: toạ độ tay thô, khung mặt từng frame, và vector đặc trưng
mà try_models.featurize(feat="face") tạo ra. Test tests/e2e/features.unit.ts đọc file này.

Mỗi bàn tay xuất đúng thứ app nhận từ MediaPipe: nhãn GỐC + điểm tin cậy (rich.npz có hlab/hscore).
Thêm một mẫu GIẢ LẬP "hai tay cùng nhãn": cho qua đúng quy tắc mà extract_rich.py dùng
(hand_slots.resolve_same_label) rồi tính đặc trưng — app phải ra y hệt.

Chạy (trong .eval/venv): python training/eval/dump_feat_ref.py --data .eval --out tests/e2e/fixtures/face_features.json
Không có .eval (chỉ cần numpy): dựng lại từ file đối chiếu hiện có + thêm mẫu giả lập
    python training/eval/dump_feat_ref.py --from-fixture tests/e2e/fixtures/face_features.json --out tests/e2e/fixtures/face_features.json
"""
import argparse, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import try_models as tm  # noqa: E402
from hand_slots import resolve_same_label  # noqa: E402

NAMES = ("Left", "Right")
SYNTH = "gia-lap-hai-tay-cung-nhan"


def listed_hands(D, i, t):
    """Đầu vào app nhận ở frame t: nhãn gốc của MediaPipe (+ score nếu rich.npz có)."""
    out = []
    for s, name in enumerate(NAMES):
        pts = D["hands"][i][t, s]
        if np.abs(pts).sum() == 0:
            continue
        h = {"label": name, "points": [[float(x), float(y), float(z)] for x, y, z in pts]}
        if "hlab" in D:
            raw = int(D["hlab"][i][t, s])
            h["label"] = NAMES[raw] if raw >= 0 else name
            h["score"] = round(float(D["hscore"][i][t, s]), 6)
        out.append(h)
    return out


def entry(D, i, video, hands):
    feat = tm.featurize(D, i, "face")
    return {"video": video, "hands": hands, "face": [[float(v) for v in f] for f in D["face"][i]],
            "features": [[round(float(v), 6) for v in row] for row in feat]}


def synthetic_same_label(D, i):
    """Mọi frame có hai tay: giả lập MediaPipe gán CÙNG nhãn (xen kẽ cùng Left / cùng Right, đổi thứ tự trả về,
    đổi tay nào chắc hơn), xếp ô bằng resolve_same_label như extract_rich.py, rồi tính đặc trưng."""
    H = D["hands"][i]
    new = np.zeros_like(H)
    listed = []
    for t in range(len(H)):
        hs = [{"label": n, "score": 1.0, "slot": s} for s, n in enumerate(NAMES) if np.abs(H[t, s]).sum() > 0]
        if len(hs) == 2:
            for h in hs:
                h["label"] = NAMES[t % 2]
            hs[0]["score"], hs[1]["score"] = (0.9, 0.6) if t % 3 else (0.55, 0.8)
            if t % 2:
                hs.reverse()
        for h in resolve_same_label(hs):
            new[t, NAMES.index(h["label"])] = H[t, h["slot"]]
        listed.append([{"label": h["label"], "score": h["score"], "points": [[float(x), float(y), float(z)] for x, y, z in H[t, h["slot"]]]}
                       for h in hs])
    D2 = {**D, "hands": list(D["hands"])}
    D2["hands"][i] = new
    return entry(D2, i, SYNTH, listed)


def from_fixture(path):
    """Dựng lại D (dạng try_models.load) từ file đối chiếu cũ; kiểm tra featurize còn ra đúng số đã lưu."""
    refs = [r for r in json.load(open(path, encoding="utf-8")) if r["video"] != SYNTH]
    D = {"hands": [], "face": [], "aspect": np.ones(len(refs), np.float32)}
    for r in refs:
        H = np.zeros((len(r["hands"]), 2, 21, 3), np.float32)
        for t, hs in enumerate(r["hands"]):
            for h in hs:
                H[t, NAMES.index(h["label"])] = h["points"]
        D["hands"].append(H)
        D["face"].append(np.array(r["face"], np.float32))
    out = []
    for i, r in enumerate(refs):
        e = entry(D, i, r["video"], r["hands"])
        diff = np.abs(np.array(e["features"]) - np.array(r["features"])).max()
        assert diff < 1e-5, f"{r['video']}: featurize lệch {diff} so với file cũ"
        out.append(e)
    return D, out, list(range(len(refs)))


def from_data(data, n):
    D = tm.load(data)
    rng = np.random.default_rng(3)
    # ưu tiên video có cả hai tay ở vài frame, để kiểm cả phần "phải − trái"
    cand = [int(i) for i in rng.permutation(D["reps"]) if D["lens"][i] > 0]
    picked, two = [], 0
    if "hlab" in D:  # có frame thật bị MediaPipe gán cùng nhãn → lấy một video như thế
        clash = [i for i in cand if ((D["hlab"][i][:, 0] == D["hlab"][i][:, 1]) & (D["hlab"][i][:, 0] >= 0)).any()]
        picked += clash[:1]; two += len(clash[:1])
    for i in cand:
        if i in picked: continue
        h = D["hands"][i]; both = (np.abs(h).sum((2, 3)) > 0).all(1).any()
        if both and two < n // 2: picked.append(i); two += 1
        elif not both and len(picked) - two < n - n // 2: picked.append(i)
        if len(picked) == n: break
    out = [entry(D, i, os.path.basename(str(D["names"][i])) if "names" in D else str(i), [listed_hands(D, i, t) for t in range(len(D["hands"][i]))])
           for i in picked]
    return D, out, picked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=".eval"); ap.add_argument("--out", required=True); ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--from-fixture", help="dựng lại từ file đối chiếu có sẵn thay vì rich.npz")
    a = ap.parse_args()
    D, out, idx = from_fixture(a.from_fixture) if a.from_fixture else from_data(a.data, a.n)
    two = [idx[k] for k in range(len(out)) if any(len(hs) == 2 for hs in out[k]["hands"])]
    if two:
        out.append(synthetic_same_label(D, two[0]))
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, "w", encoding="utf-8"))
    print(len(out), "video →", a.out, "(gồm 1 mẫu giả lập hai tay cùng nhãn)" if two else "")


if __name__ == "__main__":
    main()
