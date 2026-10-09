"""Đo model đang chạy trong app + train model mới có tăng cường dữ liệu, so trên CÙNG tập kiểm tra.

Tập kiểm tra = đúng 15% mà notebook Colab để riêng (train_test_split random_state=42, stratify),
model hiện tại chưa từng thấy các mẫu này. Lưu ý: dataset không có ID người ký, nên đây vẫn
là "người quen" — độ chính xác với người lạ ngoài đời sẽ thấp hơn.

Chạy (trong .eval/venv):
    python training/eval/eval_and_train.py --data .eval --model public/models/vsl --out .eval/new_model
"""
import argparse, json, os, re
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split

SEQ = 30; FEAT = 126; FH = 63
rng = np.random.default_rng(0)


def resample(fr, n=SEQ):
    T = len(fr)
    if T == n: return fr
    return fr[np.linspace(0, T - 1, n).round().astype(int)]


# ---------- các điều kiện thử ----------
def pad_static(fr, frac):
    """Đứng yên trước & sau khi ký (app ghi 2,5s, ký thật ~1,6s → mỗi đầu ~18%)."""
    k = max(1, int(round(len(fr) * frac)))
    return np.concatenate([np.repeat(fr[:1], k, 0), fr, np.repeat(fr[-1:], k, 0)])


def mirror(fr):
    """Người thuận tay trái: đổi chỗ 2 tay + lật trục x."""
    out = fr.copy().reshape(len(fr), 2, 21, 3)
    out = out[:, ::-1].copy()
    nz = np.abs(out).sum(axis=(2, 3), keepdims=True) > 0
    out[..., 0] = np.where(nz[..., 0], -out[..., 0], 0)
    return out.reshape(len(fr), FEAT)


def crop_mid(fr, keep=0.75):
    T = len(fr); k = max(2, int(round(T * keep))); s = (T - k) // 2
    return fr[s:s + k]


CONDS = {
    "chuẩn": lambda f: f,
    "đứng yên 2 đầu (giống app)": lambda f: pad_static(f, 0.2),
    "thuận tay trái": mirror,
    "chỉ bắt 75% động tác": crop_mid,
}


# ---------- tăng cường khi train ----------
def rotate_scale(fr, deg, sc):
    out = fr.copy().reshape(len(fr), 2, 21, 3)
    t = np.deg2rad(deg); c, s = np.cos(t), np.sin(t)
    x, y = out[..., 0].copy(), out[..., 1].copy()
    nz = np.abs(out).sum(axis=3) > 0
    out[..., 0] = np.where(nz, (c * x - s * y) * sc, 0)
    out[..., 1] = np.where(nz, (s * x + c * y) * sc, 0)
    return out.reshape(len(fr), FEAT)


def augment(fr):
    if rng.random() < 0.6: fr = pad_static(fr, rng.uniform(0.0, 0.3))
    if rng.random() < 0.4: fr = crop_mid(fr, rng.uniform(0.75, 1.0))
    if rng.random() < 0.3: fr = mirror(fr)
    if rng.random() < 0.7: fr = rotate_scale(fr, rng.uniform(-15, 15), rng.uniform(0.9, 1.1))
    fr = resample(fr)
    noise = rng.normal(0, 0.02, fr.shape).astype(np.float32)
    return np.where(fr != 0, fr + noise, 0).astype(np.float32)


# ---------- model ----------
def build(nc):
    m = tf.keras.Sequential([
        tf.keras.layers.Input((SEQ, FEAT)),
        tf.keras.layers.Masking(0.0),
        tf.keras.layers.LSTM(128, return_sequences=True), tf.keras.layers.Dropout(0.3),
        tf.keras.layers.LSTM(64), tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dense(nc, activation="softmax"),
    ])
    m.compile("adam", "sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def load_tfjs(dir_):
    mj = json.load(open(os.path.join(dir_, "model.json"), encoding="utf-8"))
    cfg = mj["modelTopology"]["model_config"]
    m = tf.keras.models.model_from_json(json.dumps(cfg))
    buf = open(os.path.join(dir_, mj["weightsManifest"][0]["paths"][0]), "rb").read()
    arrs, off = [], 0
    for w in mj["weightsManifest"][0]["weights"]:
        n = int(np.prod(w["shape"])); arrs.append(np.frombuffer(buf, "<f4", n, off).reshape(w["shape"])); off += n * 4
    m.set_weights(arrs)
    return m


def evaluate(m, seqs, y, name):
    print(f"\n== {name} ==")
    res = {}
    for cname, fn in CONDS.items():
        X = np.stack([resample(fn(s)) for s in seqs])
        p = m.predict(X, verbose=0, batch_size=256)
        top1 = float((p.argmax(1) == y).mean())
        top3 = float((np.argsort(-p, 1)[:, :3] == y[:, None]).any(1).mean())
        conf = p.max(1)
        ok60 = float(((p.argmax(1) == y) & (conf >= 0.6)).mean())  # app cần đúng VÀ ≥60%
        res[cname] = dict(top1=top1, top3=top3, app_pass=ok60)
        print(f"  {cname:30s} top1 {top1:6.1%}  top3 {top3:6.1%}  qua ngưỡng app {ok60:6.1%}")
    return res


def export_tfjs(m, out):
    os.makedirs(out, exist_ok=True)
    topo = json.loads(m.to_json())
    cell = re.compile(r"/(?:lstm|gru|simple_rnn)_cell(?:_\d+)?/")
    names, arrs = [], []
    for w in m.weights:
        names.append(cell.sub("/", w.name.split(":")[0])); arrs.append(np.asarray(w.numpy(), dtype="<f4"))
    with open(os.path.join(out, "group1-shard1of1.bin"), "wb") as f:
        for a in arrs: f.write(a.tobytes())
    mj = {"format": "layers-model", "generatedBy": "keras v" + topo.get("keras_version", "2"), "convertedBy": "manual-numpy-converter",
          "modelTopology": {"keras_version": topo.get("keras_version"), "backend": topo.get("backend"),
                            "model_config": {"class_name": topo["class_name"], "config": topo["config"]}},
          "weightsManifest": [{"paths": ["group1-shard1of1.bin"], "weights": [{"name": n, "shape": list(a.shape), "dtype": "float32"} for n, a in zip(names, arrs)]}]}
    json.dump(mj, open(os.path.join(out, "model.json"), "w"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--model", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=int, default=150)
    a = ap.parse_args()
    z = np.load(os.path.join(a.data, "landmarks_raw.npz"))
    seqs = np.split(z["data"], np.cumsum(z["lens"])[:-1]); y = z["y"]
    labels = json.load(open(os.path.join(a.data, "labels.json"), encoding="utf-8"))
    app_labels = json.load(open(os.path.join(os.path.dirname(a.model.rstrip("/\\")), "..", "labels.json"), encoding="utf-8"))
    assert labels == app_labels, "Thứ tự nhãn khác labels.json của app!"
    idx = np.arange(len(y))
    tr, va = train_test_split(idx, test_size=0.15, random_state=42, stratify=y)
    print(f"{len(y)} mẫu · train {len(tr)} · kiểm tra {len(va)} · {len(labels)} nhãn")
    val_seqs = [seqs[i] for i in va]; yv = y[va]

    report = {"n_val": int(len(va))}
    old = load_tfjs(a.model)
    report["model_cu"] = evaluate(old, val_seqs, yv, "MODEL ĐANG DÙNG TRONG APP")

    # model mới: tăng cường dữ liệu; early stopping trên 10% tách từ train (không chạm tập kiểm tra)
    tr2, inner = train_test_split(tr, test_size=0.1, random_state=7, stratify=y[tr])
    Xin = np.stack([resample(pad_static(seqs[i], 0.1)) for i in inner]); yin = y[inner]
    tf.keras.utils.set_random_seed(0)
    new = build(len(labels))
    best, best_acc, wait = None, -1, 0
    for ep in range(a.epochs):
        Xb = np.stack([augment(seqs[i]) for i in tr2]); yb = y[tr2]
        new.fit(Xb, yb, epochs=1, batch_size=32, verbose=0)
        acc = float((new.predict(Xin, verbose=0).argmax(1) == yin).mean())
        if acc > best_acc: best_acc, best, wait = acc, new.get_weights(), 0
        else: wait += 1
        if ep % 10 == 0: print(f"  epoch {ep:3d} · inner val {acc:.3f} (tốt nhất {best_acc:.3f})")
        if wait >= 25: break
    new.set_weights(best)
    report["model_moi"] = evaluate(new, val_seqs, yv, "MODEL MỚI (tăng cường dữ liệu)")
    export_tfjs(new, a.out)
    json.dump(report, open(os.path.join(a.out, "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("\nĐã xuất model mới TF.js →", a.out)


if __name__ == "__main__":
    main()
