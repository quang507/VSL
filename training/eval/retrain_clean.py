"""Train lại model 100 từ trên dữ liệu ĐÃ RÀ (xem audit_data.py, scan_frames.py) và đo trung thực.

Vấn đề tìm thấy trong thư mục train của ViSignLanguage-Video:
  - ~28% là bản sao (trùng byte, "<id>_1/_2/_3", trùng nội dung khác tên)
  - 717 video bị chèn frame đơn sắc; 269 trong số đó là đoạn cắt từ video khác cùng nhãn
  - 1 video nằm ở cả "Chào" lẫn "Chậm lại"; 98 video gần như không thấy tay
Cách chia cũ (ngẫu nhiên theo video) để bản sao của video kiểm tra nằm trong tập train → điểm bị thổi phồng.

Ở đây:
  - mỗi video gốc giữ 1 bản; bỏ nhóm mâu thuẫn nhãn và video ít tay
  - gom video theo "buổi quay" (người + phông + áo) bằng ảnh thu nhỏ → đo khi NGƯỜI KÝ CHƯA GẶP (5 phần)
  - chỉ kiểm tra trên video đầy đủ (không bị đệm/cắt)
  - so thêm: cách chia ngẫu nhiên kiểu cũ trên dữ liệu chưa rà (để thấy mức thổi phồng)
  - cuối cùng train trên toàn bộ dữ liệu sạch và xuất TF.js

Chạy (venv): python training/eval/retrain_clean.py --data .eval --app-labels public/labels.json --out .eval/model_clean
"""
import argparse, collections, json, os, sys, unicodedata
import numpy as np
import tensorflow as tf
from sklearn.cluster import AgglomerativeClustering
from sklearn.model_selection import GroupKFold, train_test_split

sys.path.insert(0, os.path.dirname(__file__))
from eval_and_train import resample, augment, build, export_tfjs, pad_static  # noqa: E402

nfc = lambda t: unicodedata.normalize("NFC", t)
THR = 0.6  # lib/constants.ts CONFIDENCE_THRESHOLD


def train(seqs, y, tr, nc, epochs=150, seed=0, groups=None):
    """Train với tăng cường; dừng sớm theo 10% nhóm (không phải 10% video) để không rò bản sao."""
    if groups is not None:
        ug = np.unique(groups[tr]); r = np.random.default_rng(seed); r.shuffle(ug)
        inner_g = set(ug[: max(1, len(ug) // 10)])
        inner = np.array([i for i in tr if groups[i] in inner_g]); fit = np.array([i for i in tr if groups[i] not in inner_g])
    else:
        fit, inner = train_test_split(tr, test_size=0.1, random_state=seed)
    Xin = np.stack([resample(seqs[i]) for i in inner]); yin = y[inner]
    tf.keras.utils.set_random_seed(seed)
    m = build(nc)
    best, best_acc, wait = None, -1, 0
    for ep in range(epochs):
        m.fit(np.stack([augment(seqs[i]) for i in fit]), y[fit], epochs=1, batch_size=32, verbose=0)
        acc = float((m.predict(Xin, verbose=0).argmax(1) == yin).mean())
        if acc > best_acc: best_acc, best, wait = acc, m.get_weights(), 0
        else: wait += 1
        if wait >= 25: break
    m.set_weights(best)
    return m


def score(m, seqs, y, te):
    p = m.predict(np.stack([resample(seqs[i]) for i in te]), verbose=0, batch_size=256)
    top = np.argsort(-p, 1)
    t1 = top[:, 0] == y[te]
    return dict(n=int(len(te)), top1=float(t1.mean()), top3=float(np.mean([y[te][k] in top[k, :3] for k in range(len(te))])),
                dung_va_chac=float((t1 & (p.max(1) >= THR)).mean()),  # đúng VÀ vượt ngưỡng app → được báo "Đúng"
                sai_ma_chac=float((~t1 & (p.max(1) >= THR)).mean()))  # sai mà vẫn vượt ngưỡng


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--app-labels", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--folds", type=int, default=5)
    a = ap.parse_args()
    z = np.load(os.path.join(a.data, "landmarks_raw.npz"))
    seqs = np.split(z["data"], np.cumsum(z["lens"])[:-1]); names = [str(n) for n in z["names"]]
    labels = json.load(open(os.path.join(a.data, "labels.json"), encoding="utf-8"))
    app = json.load(open(a.app_labels, encoding="utf-8")); app_idx = {nfc(l): i for i, l in enumerate(app)}
    y = np.array([app_idx[nfc(labels[c])] for c in z["y"]])  # theo thứ tự nhãn của app
    nc = len(app)

    A = json.load(open(os.path.join(a.data, "audit.json")))
    S = {int(k): np.array(v, bool) for k, v in json.load(open(os.path.join(a.data, "solid_frames.json"))).items()}
    P = json.load(open(os.path.join(a.data, "padded_src.json")))
    T = np.load(os.path.join(a.data, "thumbs16.npz"))
    clean = sorted(int(i) for i in A["group"])

    # --- gom nhóm: nhóm trùng của audit + bản cắt/đệm về video gốc ---
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
    bad = set(A["drop_conflict"]) | set(A["drop_few"])
    padded = {i for i in clean if S[i].any()}
    reps, gid = [], {}
    for g, mem in groups.items():
        if any(i in set(A["drop_conflict"]) for i in mem): continue
        mem = [i for i in mem if i not in bad]
        if not mem: continue
        r = max(mem, key=lambda i: (i not in padded, len(seqs[i]), -i))
        reps.append(r); gid[r] = g
    reps = np.array(sorted(reps))
    print(f"{len(clean)} video sạch → {len(reps)} video gốc dùng được ({sum(r in padded for r in reps)} bị cụt/đệm)", flush=True)

    # --- buổi quay: ảnh trung bình các frame thật, làm mờ ---
    F = []
    for i in reps:
        t = T[str(i)][~S[i]] if (~S[i]).any() else T[str(i)]
        F.append(t.astype(np.float32).mean(0).ravel() / 255)
    sess = AgglomerativeClustering(n_clusters=None, distance_threshold=12.0, linkage="ward").fit(np.array(F)).labels_
    print("số buổi quay ước lượng:", sess.max() + 1, flush=True)
    sess_of = np.full(len(y), -1); sess_of[reps] = sess
    grp_of = np.full(len(y), -1)
    for r in reps: grp_of[r] = gid[r]

    report = {"video_sach": len(clean), "video_goc": int(len(reps)), "buoi_quay": int(sess.max() + 1), "nguong_app": THR}

    # --- 1) cách chia kiểu cũ: ngẫu nhiên theo video, CHƯA rà (để so) ---
    tr, te = train_test_split(np.array(clean), test_size=0.15, random_state=42, stratify=y[clean])
    m = train(seqs, y, tr, nc)
    report["chia_ngau_nhien_chua_ra"] = score(m, seqs, y, te)
    print("Chia ngẫu nhiên, dữ liệu chưa rà:", report["chia_ngau_nhien_chua_ra"], flush=True)

    # --- 2) người ký chưa gặp: GroupKFold theo buổi quay ---
    folds = []
    for k, (tri, tei) in enumerate(GroupKFold(a.folds).split(reps, groups=sess)):
        trv, tev = reps[tri], reps[tei]
        tev = np.array([i for i in tev if i not in padded])  # chỉ chấm trên video đầy đủ
        m = train(seqs, y, trv, nc, seed=k, groups=sess_of)
        s = score(m, seqs, y, tev); folds.append(s)
        print(f"  phần {k+1}: {s}", flush=True)
    report["nguoi_ky_chua_gap"] = {key: float(np.mean([f[key] for f in folds])) for key in ("top1", "top3", "dung_va_chac", "sai_ma_chac")}
    report["nguoi_ky_chua_gap"]["tung_phan"] = folds
    print("Người ký chưa gặp (trung bình):", report["nguoi_ky_chua_gap"], flush=True)

    # --- 3) model cuối: toàn bộ dữ liệu sạch ---
    m = train(seqs, y, reps, nc, seed=42, groups=sess_of)
    export_tfjs(m, a.out)
    json.dump(report, open(os.path.join(os.path.dirname(__file__), "report_clean.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Đã xuất →", a.out)


if __name__ == "__main__":
    main()
