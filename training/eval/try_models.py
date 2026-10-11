"""So sánh ĐẶC TRƯNG và KIẾN TRÚC model trên cùng một bài kiểm tra: người ký CHƯA GẶP (GroupKFold theo buổi quay).

Cách chia, cách dừng sớm và cách chấm giữ y hệt retrain_clean.py để so được với con số 64% hiện tại.
Dữ liệu: rich.npz (extract_rich.py) — toạ độ gốc của tay + mốc cơ thể + khung mặt.

Đặc trưng (mỗi frame):
  shape0  hình dạng bàn tay chuẩn hoá theo cổ tay, KHÔNG sửa tỉ lệ khung hình  (= model đang chạy)
  shape   như trên nhưng đổi về toạ độ vuông (x, y cùng đơn vị) trước khi chuẩn hoá
  +traj   quỹ đạo cổ tay so với vị trí trung bình trong clip, đơn vị = cỡ bàn tay (không cần bộ dò nào thêm)
  +pose   vị trí tay so với vai và mũi, đơn vị = bề ngang vai (cần PoseLandmarker)
  +face   vị trí tay so với mặt, đơn vị = bề ngang mặt (cần FaceDetector, nhẹ hơn nhiều)

Chạy (trong .eval/venv):
  python training/eval/try_models.py --data .eval --all "shape0:lstm,shape:lstm,traj:lstm,pose:lstm,face:lstm" --jobs 5
  python training/eval/try_models.py --data .eval --summary
  python training/eval/try_models.py --data .eval --feat face --arch lstm --final public/models/vsl   # model cuối, toàn bộ dữ liệu
"""
import argparse, collections, json, os, subprocess, sys, time
import numpy as np

SEQ = 30
THR = 0.6
WRIST, MID_MCP, MID_TIP = 0, 9, 12
# rich.npz pose: mũi, vai T/P, khuỷu T/P, cổ tay T/P, hông T/P
P_NOSE, P_LSH, P_RSH = 0, 1, 2
LOC = {"shape0": 0, "shape": 0, "traj": 4, "pose": 6, "face": 4}


# ---------------- chia dữ liệu (y hệt retrain_clean.py), lưu lại để mọi tiến trình dùng chung ----------------
def make_split(data):
    from sklearn.cluster import AgglomerativeClustering
    z = np.load(os.path.join(data, "landmarks_raw.npz"))
    lens = z["lens"]
    A = json.load(open(os.path.join(data, "audit.json")))
    S = {int(k): np.array(v, bool) for k, v in json.load(open(os.path.join(data, "solid_frames.json"))).items()}
    P = json.load(open(os.path.join(data, "padded_src.json")))
    T = np.load(os.path.join(data, "thumbs16.npz"))
    clean = sorted(int(i) for i in A["group"])
    par = {i: int(A["group"][str(i)]) for i in clean}
    def root(i):
        while par[i] != i: i = par[i]
        return i
    for p, (src, d) in P.items():
        if src is not None and d < 2.0:
            rp, rs = root(int(p)), root(int(src))
            if rp != rs: par[rp] = rs
    groups = collections.defaultdict(list)
    for i in clean: groups[root(i)].append(i)
    conflict = set(A["drop_conflict"]); bad = conflict | set(A["drop_few"])
    padded = {i for i in clean if S[i].any()}
    reps = []
    for g, mem in groups.items():
        if any(i in conflict for i in mem): continue
        mem = [i for i in mem if i not in bad]
        if mem: reps.append(max(mem, key=lambda i: (i not in padded, lens[i], -i)))
    reps = np.array(sorted(reps))
    F = [(T[str(i)][~S[i]] if (~S[i]).any() else T[str(i)]).astype(np.float32).mean(0).ravel() / 255 for i in reps]
    sess = AgglomerativeClustering(n_clusters=None, distance_threshold=12.0, linkage="ward").fit(np.array(F)).labels_
    np.savez(os.path.join(data, "split.npz"), reps=reps, sess=sess, padded=np.array([r in padded for r in reps]))


def load(data):
    if not os.path.exists(os.path.join(data, "split.npz")): make_split(data)
    sp = np.load(os.path.join(data, "split.npz"))
    z = np.load(os.path.join(data, "rich.npz"))
    cut = np.cumsum(z["lens"])[:-1]
    vid = lambda k: np.split(z[k], cut)
    import unicodedata
    nfc = lambda t: unicodedata.normalize("NFC", t)
    labels = json.load(open(os.path.join(data, "labels.json"), encoding="utf-8"))
    app = json.load(open("public/labels.json", encoding="utf-8")); idx = {nfc(l): i for i, l in enumerate(app)}
    y = np.array([idx[nfc(labels[c])] for c in z["y"]])
    return dict(hands=vid("hands"), pose=vid("pose"), face=vid("face"), aspect=z["aspect"], lens=z["lens"], names=z["names"], y=y, nc=len(app), **{k: sp[k] for k in sp.files})


# ---------------- đặc trưng ----------------
def featurize(D, i, feat):
    """→ (T, 2*(63+LOC)+2). Mỗi tay: 63 số hình dạng + LOC số vị trí; cuối cùng 2 số: vector tay phải − tay trái.
    PHẢI khớp y hệt lib/landmarks.ts buildFrameFeatures (feat="face"); kiểm bằng tests/e2e/features.unit.ts."""
    h = D["hands"][i].astype(np.float32).copy()  # (T, 2, 21, 3), toạ độ ảnh 0..1
    T = len(h)
    present = np.abs(h).sum((2, 3)) > 0  # (T, 2)
    asp = 1.0 if feat == "shape0" else float(D["aspect"][i])  # y * (cao/rộng) → x, y cùng đơn vị (bề ngang khung)
    h[..., 1] *= asp
    wrist = h[:, :, WRIST, :2].copy(); tip = h[:, :, MID_TIP, :2].copy()
    rel = h - h[:, :, WRIST:WRIST + 1]
    size = np.linalg.norm(rel[:, :, MID_MCP], axis=-1)  # (T, 2) cỡ bàn tay
    shape = rel / np.where(size > 1e-6, size, 1.0)[..., None, None]
    shape = np.where(present[..., None, None], shape, 0).reshape(T, 2, 63)

    k = LOC[feat]
    loc = np.zeros((T, 2, k), np.float32)
    inter = np.zeros((T, 2), np.float32)
    if k:
        if feat == "traj":
            c = wrist[present].mean(0); u = np.median(size[present])
            loc = np.concatenate([(wrist - c) / u, (tip - c) / u], -1)
        elif feat == "pose":
            p = D["pose"][i].astype(np.float32).copy(); p[..., 1] *= asp
            ok = p[:, P_LSH, 2] > 0
            if not ok.any(): return None
            sc = np.median((p[ok, P_LSH, :2] + p[ok, P_RSH, :2]) / 2, 0)  # người ký đứng yên → lấy trung vị cả clip
            u = np.median(np.linalg.norm(p[ok, P_LSH, :2] - p[ok, P_RSH, :2], axis=-1)); nose = np.median(p[ok, P_NOSE, :2], 0)
            if u < 1e-3: return None
            loc = np.concatenate([(wrist - sc) / u, (wrist - nose) / u, (tip - nose) / u], -1)
        elif feat == "face":
            f = D["face"][i].astype(np.float32).copy(); f[:, 1] *= asp
            ok = f[:, 2] > 0
            if not ok.any(): return None
            c = np.median(f[ok, :2], 0); u = np.median(f[ok, 2])
            loc = np.concatenate([(wrist - c) / u, (tip - c) / u], -1)
        both = present.all(1)
        inter[both] = ((wrist[:, 1] - wrist[:, 0]) / u)[both]
        loc = np.where(present[..., None], loc, 0)
    return np.concatenate([shape, loc], -1).reshape(T, -1) if not k else np.concatenate([np.concatenate([shape, loc], -1).reshape(T, -1), inter], -1)


# ---------------- tăng cường (làm trên vector đặc trưng; mọi cặp (x, y) đều xoay/lật được) ----------------
def make_aug(feat, rng):
    k = LOC[feat]; fh = 63 + k
    def split(fr):
        hands = fr[:, : 2 * fh].reshape(len(fr), 2, fh)
        return hands[..., :63].reshape(len(fr), 2, 21, 3).copy(), hands[..., 63:].reshape(len(fr), 2, k // 2, 2).copy() if k else None, fr[:, 2 * fh:].copy() if k else None
    def join(shape, loc, inter):
        T = len(shape)
        if not k: return shape.reshape(T, -1)
        return np.concatenate([np.concatenate([shape.reshape(T, 2, 63), loc.reshape(T, 2, k)], -1).reshape(T, -1), inter], -1)
    def resample(fr):
        return fr if len(fr) == SEQ else fr[np.linspace(0, len(fr) - 1, SEQ).round().astype(int)]
    def aug(fr):
        if rng.random() < 0.6:  # đứng yên trước & sau khi ký
            n = max(1, int(round(len(fr) * rng.uniform(0, 0.3)))); fr = np.concatenate([np.repeat(fr[:1], n, 0), fr, np.repeat(fr[-1:], n, 0)])
        if rng.random() < 0.4:  # chỉ bắt được phần giữa động tác
            T = len(fr); n = max(2, int(round(T * rng.uniform(0.75, 1.0)))); s = (T - n) // 2; fr = fr[s:s + n]
        shape, loc, inter = split(fr)
        if rng.random() < 0.3:  # thuận tay trái: đổi chỗ hai tay, lật trục x
            shape = shape[:, ::-1].copy(); shape[..., 0] *= -1
            if k: loc = loc[:, ::-1].copy(); loc[..., 0] *= -1; inter[:, 1] *= -1
        if rng.random() < 0.7:  # nghiêng người/máy, tay to nhỏ khác nhau
            t = np.deg2rad(rng.uniform(-15, 15)); c, s = np.cos(t), np.sin(t)
            def rot(a, sc):
                x, y = a[..., 0].copy(), a[..., 1].copy(); a[..., 0] = (c * x - s * y) * sc; a[..., 1] = (s * x + c * y) * sc
            rot(shape, rng.uniform(0.9, 1.1))
            if k:
                sc = rng.uniform(0.85, 1.15); rot(loc, sc); rot(inter, sc)  # vóc người khác nhau, mốc cơ thể lệch
                loc += rng.normal(0, 0.08, (1, 1, 1, 2)).astype(np.float32) * (np.abs(loc).sum((2, 3), keepdims=True) > 0)  # mốc cơ thể dò lệch
        out = resample(join(shape, loc, inter))
        return np.where(out != 0, out + rng.normal(0, 0.02, out.shape), 0).astype(np.float32)
    return aug, resample


# ---------------- kiến trúc (chỉ dùng lớp TF.js đọc được) ----------------
def build(arch, nfeat, nc):
    import tensorflow as tf
    L = tf.keras.layers
    inp = L.Input((SEQ, nfeat))
    if arch == "lstm":  # model đang chạy trong app
        x = L.Masking(0.0)(inp)
        x = L.Dropout(0.3)(L.LSTM(128, return_sequences=True)(x)); x = L.Dropout(0.3)(L.LSTM(64)(x))
        x = L.Dense(64, activation="relu")(x)
    elif arch == "bigru":
        x = L.Dense(160, activation="relu")(inp); x = L.Dropout(0.2)(x)
        x = L.Dropout(0.3)(L.Bidirectional(L.GRU(128, return_sequences=True))(x))
        x = L.Bidirectional(L.GRU(96, return_sequences=True))(x)
        x = L.Concatenate()([L.GlobalAveragePooling1D()(x), L.GlobalMaxPooling1D()(x)])
        x = L.Dropout(0.4)(L.Dense(128, activation="relu")(x))
    elif arch == "cnn":
        x = L.Dense(160, activation="relu")(inp)
        for f, d in ((160, 1), (160, 2), (192, 4)):
            r = x if x.shape[-1] == f else L.Conv1D(f, 1)(x)
            x = L.Conv1D(f, 3, padding="same", dilation_rate=d)(x); x = L.BatchNormalization()(x); x = L.Activation("relu")(x); x = L.Dropout(0.25)(x)
            x = L.Add()([x, r])
        x = L.Concatenate()([L.GlobalAveragePooling1D()(x), L.GlobalMaxPooling1D()(x)])
        x = L.Dropout(0.4)(L.Dense(128, activation="relu")(x))
    else:
        raise SystemExit("arch?")
    m = tf.keras.Model(inp, L.Dense(nc, activation="softmax")(x))
    smooth = 0.0 if arch == "lstm" else 0.1
    m.compile(tf.keras.optimizers.Adam(1e-3), tf.keras.losses.CategoricalCrossentropy(label_smoothing=smooth), metrics=["accuracy"])
    return m


def fit(arch, X, y, tr, nc, sess_of, feat, seed, epochs=150, patience=25):
    """X: dict video → (T, F). Dừng sớm theo 10% BUỔI QUAY của phần train (không rò người ký)."""
    import tensorflow as tf
    rng = np.random.default_rng(seed)
    aug, resample = make_aug(feat, rng)
    ug = np.unique(sess_of[tr]); r = np.random.default_rng(seed); r.shuffle(ug)
    inner_g = set(ug[: max(1, len(ug) // 10)])
    inner = np.array([i for i in tr if sess_of[i] in inner_g]); ft = np.array([i for i in tr if sess_of[i] not in inner_g])
    Xin = np.stack([resample(X[i]) for i in inner]); yin = y[inner]
    tf.keras.utils.set_random_seed(seed)
    m = build(arch, Xin.shape[-1], nc)
    eye = np.eye(nc, dtype=np.float32)
    best, best_acc, wait = None, -1, 0
    for ep in range(epochs):
        m.fit(np.stack([aug(X[i]) for i in ft]), eye[y[ft]], epochs=1, batch_size=32, verbose=0)
        acc = float((m.predict(Xin, verbose=0, batch_size=256).argmax(1) == yin).mean())
        if acc > best_acc: best_acc, best, wait = acc, m.get_weights(), 0
        else: wait += 1
        if wait >= patience: break
    m.set_weights(best)
    return m, resample


def score(p, yt):
    top = np.argsort(-p, 1); t1 = top[:, 0] == yt
    return dict(n=int(len(yt)), top1=float(t1.mean()), top3=float(np.mean([yt[k] in top[k, :3] for k in range(len(yt))])),
                dung_va_chac=float((t1 & (p.max(1) >= THR)).mean()), sai_ma_chac=float((~t1 & (p.max(1) >= THR)).mean()))


def features_of(D, feat):
    X = {}
    for i in D["reps"]:
        if D["lens"][i] > 0:
            f = featurize(D, i, feat)
            if f is not None: X[i] = f
    return X


def run_fold(a):
    from sklearn.model_selection import GroupKFold
    D = load(a.data); reps, sess, padded, y = D["reps"], D["sess"], D["padded"], D["y"]
    X = features_of(D, a.feat)
    keep = np.array([i in X for i in reps])
    sess_of = np.full(len(y), -1); sess_of[reps] = sess
    tri, tei = list(GroupKFold(5).split(reps, groups=sess))[a.fold]
    trv = np.array([i for i in reps[tri] if i in X])
    # Chấm trên MỌI video đầy đủ của phần kiểm tra; video không tính được đặc trưng (không thấy mốc cơ thể) tính là SAI.
    tev_all = np.array([i for i, pd in zip(reps[tei], padded[tei]) if not pd]); tev = np.array([i for i in tev_all if i in X])
    t0 = time.time()
    ps = []
    for s in range(a.ens):
        m, resample = fit(a.arch, X, y, trv, D["nc"], sess_of, a.feat, seed=a.fold + 100 * s)
        ps.append(m.predict(np.stack([resample(X[i]) for i in tev]), verbose=0, batch_size=256))
    p = np.mean(ps, 0)
    full = np.zeros((len(tev_all), D["nc"]), np.float32); pos = {v: k for k, v in enumerate(tev_all)}
    for k, i in enumerate(tev): full[pos[i]] = p[k]
    yt = y[tev_all].copy(); miss = np.array([i not in X for i in tev_all])
    s = score(full, np.where(miss, -1, yt)); s.update(thieu_moc=int(miss.sum()), dung_duoc=float(keep.mean()), phut=round((time.time() - t0) / 60, 1), nfeat=int(next(iter(X.values())).shape[1]))
    # để chọn ngưỡng tin cậy (calibrate_threshold): độ tin cậy cao nhất và đúng/sai của từng video kiểm tra
    s["conf"] = [round(float(c), 4) for c in full.max(1)]; s["hit"] = [bool(h) for h in (full.argmax(1) == np.where(miss, -1, yt))]
    os.makedirs(a.out, exist_ok=True)
    json.dump(s, open(os.path.join(a.out, f"{a.tag}__f{a.fold}.json"), "w"))
    print(a.tag, a.fold, s, flush=True)


def train_final(a):
    """Model cuối: train trên TOÀN BỘ video gốc sạch rồi xuất TF.js (như retrain_clean.py bước 3)."""
    from eval_and_train import export_tfjs
    D = load(a.data); reps, sess, y = D["reps"], D["sess"], D["y"]
    X = features_of(D, a.feat)
    sess_of = np.full(len(y), -1); sess_of[reps] = sess
    tr = np.array([i for i in reps if i in X])
    m, _ = fit(a.arch, X, y, tr, D["nc"], sess_of, a.feat, seed=42)
    export_tfjs(m, a.final)
    json.dump({"features": a.feat, "arch": a.arch, "nfeat": int(next(iter(X.values())).shape[1]), "videos": int(len(tr)), "seq_len": SEQ},
              open(os.path.join(a.final, "info.json"), "w"), indent=1)
    print("Đã xuất →", a.final, flush=True)


def calibrate(out, tag):
    """Với mỗi ngưỡng: tỉ lệ video được báo Đúng khi ký đúng, và tỉ lệ bị báo Đúng dù ký sai (trên người ký lạ)."""
    conf, hit = [], []
    for f in sorted(os.listdir(out)):
        if f.startswith(tag + "__f") and f.endswith(".json"):
            d = json.load(open(os.path.join(out, f)))
            if "conf" in d: conf += d["conf"]; hit += d["hit"]
    conf, hit = np.array(conf), np.array(hit)
    print(f"{tag}: {len(conf)} video · đúng nhãn {hit.mean():.1%}")
    print(f"{'ngưỡng':>7} {'báo Đúng khi đúng':>18} {'báo Đúng khi sai':>17} {'báo Đúng tổng':>14}")
    for t in np.arange(0.30, 0.91, 0.05):
        acc = conf >= t
        print(f"{t:>7.2f} {(acc & hit).sum() / max(1, hit.sum()):>18.1%} {(acc & ~hit).sum() / max(1, (~hit).sum()):>17.1%} {(acc & hit).mean():>14.1%}")


def summary(out):
    rows = collections.defaultdict(list)
    for f in sorted(os.listdir(out)):
        if f.endswith(".json"): rows[f.split("__f")[0]].append(json.load(open(os.path.join(out, f))))
    print(f"{'cấu hình':22} {'phần':>4} {'đúng từ':>8} {'top 3':>7} {'báo Đúng':>9} {'sai mà chắc':>12} {'thấp nhất':>10} {'phút':>6}")
    for tag, fs in sorted(rows.items(), key=lambda kv: -np.mean([f["top1"] for f in kv[1]])):
        mean = lambda k: np.mean([f[k] for f in fs])
        print(f"{tag:22} {len(fs):>4} {mean('top1'):>8.1%} {mean('top3'):>7.1%} {mean('dung_va_chac'):>9.1%} {mean('sai_ma_chac'):>12.1%} {min(f['top1'] for f in fs):>10.1%} {sum(f['phut'] for f in fs):>6.0f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=".eval"); ap.add_argument("--out", default=".eval/exp")
    ap.add_argument("--feat"); ap.add_argument("--arch"); ap.add_argument("--fold", type=int); ap.add_argument("--ens", type=int, default=1)
    ap.add_argument("--final", help="thư mục xuất model cuối (train trên toàn bộ dữ liệu), dùng cùng --feat --arch")
    ap.add_argument("--all"); ap.add_argument("--jobs", type=int, default=5); ap.add_argument("--summary", action="store_true")
    ap.add_argument("--calibrate", help="tên cấu hình, vd face+cnn: in bảng chọn ngưỡng tin cậy")
    a = ap.parse_args()
    if a.summary: return summary(a.out)
    if a.calibrate: return calibrate(a.out, a.calibrate)
    if a.final: return train_final(a)
    if a.all:
        if not os.path.exists(os.path.join(a.data, "split.npz")): make_split(a.data)
        todo = []
        for spec in a.all.split(","):
            feat, arch, *e = spec.split(":"); ens = int(e[0]) if e else 1
            tag = f"{feat}+{arch}" + (f"x{ens}" if ens > 1 else "")
            for k in range(5):
                if not os.path.exists(os.path.join(a.out, f"{tag}__f{k}.json")): todo.append((feat, arch, ens, k))
        env = dict(os.environ, TF_NUM_INTRAOP_THREADS="3", TF_NUM_INTEROP_THREADS="1", OMP_NUM_THREADS="3", TF_CPP_MIN_LOG_LEVEL="3", PYTHONIOENCODING="utf-8")
        running = []
        while todo or running:
            running = [p for p in running if p.poll() is None]
            while todo and len(running) < a.jobs:
                feat, arch, ens, k = todo.pop(0)
                running.append(subprocess.Popen([sys.executable, __file__, "--data", a.data, "--out", a.out, "--feat", feat, "--arch", arch, "--fold", str(k), "--ens", str(ens)], env=env))
            time.sleep(2)
        return summary(a.out)
    a.tag = f"{a.feat}+{a.arch}" + (f"x{a.ens}" if a.ens > 1 else "")
    run_fold(a)


if __name__ == "__main__":
    main()
