"""Đo "luyện theo mẫu" THẬT: người ký (ViSignLanguage) so với video chuẩn của từ điển Bộ GD&ĐT.

30 từ có trong cả hai bộ được giữ làm bài kiểm tra; bộ mã hoá KHÔNG được thấy 30 từ này lúc train.
  A: train trên 70 từ còn lại của ViSignLanguage
  B: như A + thêm các từ QIPEDC khác (mỗi từ 1 video, tăng cường mạnh) để làm quen "giọng ký" của từ điển
  DTW: so khớp thô, không học
Đo: (1) chấm 1 từ cho trước: ký đúng từ X hay từ khác (AUC, độ chính xác cân bằng, ngưỡng);
    (2) đoán từ trong 30 từ; (3) đoán từ trong toàn bộ 3.315 từ.

Chạy (venv): python training/qipedc/eval_cross.py --eval .eval --q .eval/qipedc
"""
import argparse, json, os, sys, unicodedata
import numpy as np
import tensorflow as tf

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "eval"))
from eval_and_train import resample, augment, SEQ, FEAT  # noqa: E402
from embed_oneshot import encoder, CosHead  # noqa: E402
import dtw_oneshot as D  # noqa: E402

nf = lambda s: unicodedata.normalize("NFC", s).lower().strip()
EXTRA = {"họ": "họ (đại từ)"}  # ViSign "Họ" (họ = they) ↔ QIPEDC


def split(z):
    return np.split(z["data"], np.cumsum(z["lens"])[:-1])


def metrics(sim, true_idx, name):
    """sim: (n_query, n_templates) càng cao càng giống; true_idx: cột đúng của mỗi query."""
    n = len(true_idx)
    pos = sim[np.arange(n), true_idx]
    neg = np.concatenate([np.delete(sim[k], true_idx[k]) for k in range(n)])
    rng = np.random.default_rng(0)
    negs = rng.choice(neg, size=min(len(neg), 20000), replace=False)
    auc = float((pos[:, None] > negs[None, :]).mean())
    allv = np.concatenate([pos, negs])
    best, thr = 0, 0
    for t in np.quantile(allv, np.linspace(0.02, 0.98, 97)):
        b = ((pos >= t).mean() + (negs < t).mean()) / 2
        if b > best: best, thr = b, t
    order = np.argsort(-sim, axis=1)
    top1 = float((order[:, 0] == true_idx).mean())
    top3 = float(np.mean([true_idx[k] in order[k, :3] for k in range(n)]))
    print(f"{name:34s} AUC {auc:.3f} · chấm đúng/sai {best:.1%} (ngưỡng {thr:.3f}, nhận đúng {(pos >= thr).mean():.0%}, báo nhầm {(negs >= thr).mean():.0%}) · top1 {top1:.1%} · top3 {top3:.1%}", flush=True)
    return dict(auc=auc, bal=best, thr=float(thr), tpr=float((pos >= thr).mean()), fpr=float((negs >= thr).mean()), top1=top1, top3=top3,
                pos_med=float(np.median(pos)), neg_med=float(np.median(negs)), neg_p95=float(np.quantile(negs, 0.95)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval", required=True)
    ap.add_argument("--q", required=True)
    ap.add_argument("--epochs", type=int, default=60)
    a = ap.parse_args()

    z = np.load(os.path.join(a.eval, "landmarks_raw.npz"))
    vs, vy, vn = split(z), z["y"], z["names"]
    vlab = json.load(open(os.path.join(a.eval, "labels.json"), encoding="utf-8"))
    clean = np.array([i for i in range(len(vy)) if "private_test" not in str(vn[i])])

    qz = np.load(os.path.join(a.q, "landmarks.npz"))
    qs, qw = split(qz), [nf(w) for w in qz["words"]]
    qwords = sorted(set(qw))
    q_of = {}
    for i, w in enumerate(qw): q_of.setdefault(w, []).append(i)  # nhiều biến thể miền

    # 30 từ chung
    shared = {}
    for c, l in enumerate(vlab):
        k = EXTRA.get(nf(l), nf(l))
        if k in q_of: shared[c] = k
    test_c = np.array(sorted(shared))
    print(len(test_c), "từ chung:", ", ".join(vlab[c] for c in test_c), flush=True)
    test_q = clean[np.isin(vy[clean], test_c)]
    train_v = clean[~np.isin(vy[clean], test_c)]
    test_words = [shared[c] for c in test_c]
    col = {c: j for j, c in enumerate(test_c)}
    true30 = np.array([col[c] for c in vy[test_q]])
    print(len(test_q), "video người ký để kiểm tra,", len(train_v), "video train", flush=True)

    def score_matrix(Eq, Et, cols):
        """Điểm với mỗi từ = max qua các biến thể miền của từ đó."""
        S = Eq @ Et.T
        return np.stack([S[:, idx].max(axis=1) for idx in cols], axis=1)

    results = {}
    # ---- DTW (không học) ----
    T = [[D.feats(qs[i]) for i in q_of[w]] for w in test_words]
    sub = np.random.default_rng(1).choice(len(test_q), size=min(400, len(test_q)), replace=False)
    dd = np.array([[min(D.dtw(D.feats(vs[test_q[s]]), t) for t in ts) for ts in T] for s in sub])
    results["dtw"] = metrics(-dd, true30[sub], "DTW (400 video)")

    seen_v = np.unique(vy[train_v])
    vremap = {c: k for k, c in enumerate(seen_v)}
    test_set = set(test_words)
    extra_w = [w for w in qwords if w not in test_set]

    for variant in ["A", "B"]:
        tf.keras.utils.set_random_seed(0)
        nc = len(seen_v) + (len(extra_w) if variant == "B" else 0)
        enc = encoder()
        inp = tf.keras.layers.Input((SEQ, FEAT))
        clf = tf.keras.Model(inp, CosHead(nc)(enc(inp)))
        clf.compile(tf.keras.optimizers.Adam(1e-3), tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True))
        X_idx = [("v", i) for i in train_v]
        Y = [vremap[c] for c in vy[train_v]]
        if variant == "B":
            for j, w in enumerate(extra_w):
                for i in q_of[w]:
                    for _ in range(3):  # 3 bản tăng cường mỗi epoch cho mỗi video từ điển
                        X_idx.append(("q", i)); Y.append(len(seen_v) + j)
        Y = np.array(Y)
        E = lambda seqs: enc.predict(np.stack([resample(s) for s in seqs]), verbose=0, batch_size=256)
        best = None
        for ep in range(a.epochs):
            X = np.stack([augment(vs[i] if src == "v" else qs[i]) for src, i in X_idx])
            clf.fit(X, Y, epochs=1, batch_size=64, verbose=0, shuffle=True)
            if ep % 10 == 9 or ep == a.epochs - 1:
                Eq = E([vs[i] for i in test_q])
                Et = E([qs[i] for w in test_words for i in q_of[w]])
                cols, k = [], 0
                for w in test_words:
                    cols.append(list(range(k, k + len(q_of[w])))); k += len(q_of[w])
                sim = score_matrix(Eq, Et, cols)
                acc = float((sim.argmax(1) == true30).mean())
                print(f"  {variant} epoch {ep+1}: top1 trong 30 từ {acc:.1%}", flush=True)
                if best is None or acc > best[0]: best = (acc, sim, ep + 1, [w.copy() for w in enc.get_weights()])
        results[variant] = metrics(best[1], true30, f"Embedding {variant} (epoch {best[2]})")
        enc.set_weights(best[3])
        np.savez(os.path.join(a.q, f"enc_{variant}.npz"), *best[3])

        # Đoán trong toàn bộ từ điển: so với mọi từ QIPEDC
        Eall = E(qs)
        allcols = [q_of[w] for w in qwords]
        widx = {w: j for j, w in enumerate(qwords)}
        S = score_matrix(E([vs[i] for i in test_q]), Eall, allcols)
        tr = np.array([widx[w] for w in (shared[c] for c in vy[test_q])])
        order = np.argsort(-S, axis=1)
        r1 = float((order[:, 0] == tr).mean()); r5 = float(np.mean([tr[k] in order[k, :5] for k in range(len(tr))]))
        print(f"  {variant}: đoán trong {len(qwords)} từ: top1 {r1:.1%} · top5 {r5:.1%}", flush=True)
        results[variant].update(all_top1=r1, all_top5=r5)

    json.dump(results, open(os.path.join(os.path.dirname(__file__), "report_cross.json"), "w", encoding="utf-8"), indent=2)


if __name__ == "__main__":
    main()
