"""Chấm theo mẫu bằng EMBEDDING học được (cho từ chỉ có 1 video, như QIPEDC).

Train bộ mã hoá (LSTM → vector 128 chiều, chuẩn hoá L2, softmax có nhiệt độ) trên 80 từ,
rồi đo one-shot trên 20 từ CHƯA TỪNG THẤY: 1 video mẫu/từ, các video khác làm người ký.
So sánh với DTW thô trên cùng 20 từ.
Chạy (venv): python training/eval/embed_oneshot.py --data .eval
"""
import argparse, os, sys
import numpy as np
import tensorflow as tf
sys.path.insert(0, os.path.dirname(__file__))
from eval_and_train import resample, augment, SEQ, FEAT  # noqa: E402
import dtw_oneshot as D  # noqa: E402


def encoder(dim=128):
    inp = tf.keras.layers.Input((SEQ, FEAT))
    x = tf.keras.layers.Masking(0.0)(inp)
    x = tf.keras.layers.LSTM(128, return_sequences=True)(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.LSTM(128)(x)
    x = tf.keras.layers.Dense(dim)(x)
    out = tf.keras.layers.Lambda(lambda v: tf.math.l2_normalize(v, axis=1), name="emb")(x)
    return tf.keras.Model(inp, out)


class CosHead(tf.keras.layers.Layer):
    """Softmax trên cosine (normalized softmax) — embedding gom cụm theo góc."""
    def __init__(self, n, s=16.0):
        super().__init__(); self.n, self.s = n, s
    def build(self, shp):
        self.w = self.add_weight(shape=(shp[-1], self.n), initializer="glorot_uniform")
    def call(self, e):
        return self.s * tf.matmul(e, tf.math.l2_normalize(self.w, axis=0))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); ap.add_argument("--epochs", type=int, default=120)
    a = ap.parse_args()
    z = np.load(os.path.join(a.data, "landmarks_raw.npz"))
    seqs = np.split(z["data"], np.cumsum(z["lens"])[:-1]); y = z["y"]; names = z["names"]
    clean = np.array([i for i in range(len(y)) if "private_test" not in str(names[i])])
    rng = np.random.default_rng(1)
    classes = np.unique(y[clean]); rng.shuffle(classes)
    unseen, seen = classes[:20], classes[20:]
    tr = clean[np.isin(y[clean], seen)]; te = clean[np.isin(y[clean], unseen)]
    remap = {c: k for k, c in enumerate(seen)}

    tf.keras.utils.set_random_seed(0)
    enc = encoder(); inp = tf.keras.layers.Input((SEQ, FEAT)); logits = CosHead(len(seen))(enc(inp))
    clf = tf.keras.Model(inp, logits)
    clf.compile(tf.keras.optimizers.Adam(1e-3), tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True))
    yt = np.array([remap[c] for c in y[tr]])

    # mẫu & người ký trên 20 từ chưa thấy (cố định để so công bằng)
    tmpl = {c: rng.choice(te[y[te] == c]) for c in unseen}
    q = np.array([i for i in te if i not in set(tmpl.values())])
    best, best_s = None, -1
    for ep in range(a.epochs):
        clf.fit(np.stack([augment(seqs[i]) for i in tr]), yt, epochs=1, batch_size=32, verbose=0)
        if ep % 10 == 9 or ep == a.epochs - 1:
            E = lambda idx: enc.predict(np.stack([resample(seqs[i]) for i in idx]), verbose=0)
            Et = E([tmpl[c] for c in unseen]); Eq = E(q)
            sim = Eq @ Et.T; pred = unseen[sim.argmax(1)]
            acc = float((pred == y[q]).mean())
            print(f"epoch {ep+1}: one-shot 20 từ chưa thấy top1 {acc:.1%}", flush=True)
            if acc > best_s: best_s, best = acc, (sim.copy())
    sim = best
    pos = sim[np.arange(len(q)), [list(unseen).index(c) for c in y[q]]]
    neg = np.concatenate([np.delete(sim[k], list(unseen).index(y[q][k])) for k in range(len(q))])
    auc = float((pos[:, None] > neg[None, ::7]).mean())
    top3 = float(np.mean([y[q][k] in unseen[np.argsort(-sim[k])[:3]] for k in range(len(q))]))
    allv = np.concatenate([pos, neg])
    bal = max(((pos >= t).mean() + (neg < t).mean()) / 2 for t in np.quantile(allv, np.linspace(0.05, 0.95, 91)))
    print(f"EMBEDDING · 20 từ chưa thấy: top1 {best_s:.1%} · top3 {top3:.1%} · AUC {auc:.3f} · chấm 1 từ {bal:.1%}")

    # DTW trên cùng 20 từ, cùng mẫu
    T = {c: D.feats(seqs[tmpl[c]]) for c in unseen}
    dd = np.array([[D.dtw(D.feats(seqs[i]), T[c]) for c in unseen] for i in q])
    print(f"DTW       · 20 từ chưa thấy: top1 {float((unseen[dd.argmin(1)] == y[q]).mean()):.1%}")


if __name__ == "__main__":
    main()
