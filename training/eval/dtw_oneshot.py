"""Thử nghiệm "chấm theo mẫu" (one-shot, DTW) — cách dùng được cho từ điển QIPEDC (1 video/từ).

Trên ViSignLanguage (nhiều video/từ): lấy 1 video mỗi từ làm MẪU, các video khác làm người ký.
Đo: (1) nhận đúng từ trong 100 mẫu (top-1/top-3), (2) chấm 1 từ cho trước: phân biệt
"ký đúng từ" vs "ký từ khác" tốt cỡ nào (AUC; tỉ lệ đúng tại ngưỡng cân bằng).
Chạy (venv): python training/eval/dtw_oneshot.py --data .eval
"""
import argparse, os
import numpy as np

L = 20  # số frame sau khi lấy mẫu lại


def resample(fr, n=L):
    return fr[np.linspace(0, len(fr) - 1, n).round().astype(int)]


def feats(fr):
    """Chỉ dùng toạ độ x,y (bỏ z nhiễu), mỗi tay 42 số; giữ cờ có/không có tay."""
    f = resample(fr).reshape(L, 2, 21, 3)[..., :2].reshape(L, 2, 42)
    present = np.abs(f).sum(axis=2) > 0
    return f.astype(np.float32), present


def dtw(a, b):
    fa, pa = a; fb, pb = b
    # khoảng cách frame: trung bình trên các tay cùng có mặt; lệch có/không có tay → phạt
    d = np.zeros((L, L), np.float32)
    both = pa[:, None, :] & pb[None, :, :]
    diff = np.linalg.norm(fa[:, None] - fb[None, :], axis=3)          # (L, L, 2)
    miss = (pa[:, None, :] != pb[None, :, :]).sum(axis=2) * 1.5
    cnt = both.sum(axis=2)
    d = np.where(cnt > 0, (diff * both).sum(axis=2) / np.maximum(cnt, 1), 3.0) + miss
    D = np.full((L + 1, L + 1), np.inf, np.float32); D[0, 0] = 0
    w = 5  # dải Sakoe-Chiba
    for i in range(1, L + 1):
        for j in range(max(1, i - w), min(L, i + w) + 1):
            D[i, j] = d[i - 1, j - 1] + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return D[L, L] / (2 * L)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); ap.add_argument("--n", type=int, default=800)
    a = ap.parse_args()
    z = np.load(os.path.join(a.data, "landmarks_raw.npz"))
    seqs = np.split(z["data"], np.cumsum(z["lens"])[:-1]); y = z["y"]; names = z["names"]
    clean = np.array([i for i in range(len(y)) if "private_test" not in str(names[i])])
    rng = np.random.default_rng(0)
    classes = np.unique(y[clean])
    tmpl = {c: rng.choice(clean[y[clean] == c]) for c in classes}
    T = {c: feats(seqs[i]) for c, i in tmpl.items()}
    pool = np.array([i for i in clean if i not in set(tmpl.values())])
    q = rng.choice(pool, size=min(a.n, len(pool)), replace=False)
    top1 = top3 = 0; pos, neg = [], []
    for k, i in enumerate(q):
        f = feats(seqs[i])
        ds = np.array([dtw(f, T[c]) for c in classes])
        order = classes[np.argsort(ds)]
        top1 += order[0] == y[i]; top3 += y[i] in order[:3]
        pos.append(ds[classes == y[i]][0]); neg.extend(ds[classes != y[i]][rng.choice(len(classes) - 1, 5, replace=False)])
        if k % 100 == 0: print(k, flush=True)
    pos, neg = np.array(pos), np.array(neg)
    auc = float((pos[:, None] < neg[None, :]).mean())
    thr = np.median(np.concatenate([pos, neg]))
    best = max(((pos < t).mean() + (neg >= t).mean()) / 2 for t in np.quantile(np.concatenate([pos, neg]), np.linspace(0.05, 0.95, 91)))
    print(f"Nhận đúng từ trong {len(classes)} mẫu: top1 {top1/len(q):.1%} · top3 {top3/len(q):.1%}")
    print(f"Chấm 1 từ cho trước: AUC {auc:.3f} · độ chính xác cân bằng tốt nhất {best:.1%}")


if __name__ == "__main__":
    main()
