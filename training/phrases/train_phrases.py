"""Model "Câu giao tiếp" từ dữ liệu Look & Tell (khooinguyeen/Vietnamese-Sign-Language-Translation,
giấy phép Apache-2.0): 60 câu × 60 lần ký × 60 frame, mỗi frame 126 số = [tay trái 63, tay phải 63]
toạ độ THÔ từ MediaPipe Holistic.

Chuyển về đúng định dạng app: chuẩn hoá theo cổ tay, bỏ frame không thấy tay, lấy mẫu 30 frame.
Không biết chắc quy ước trái/phải & lật gương lúc họ quay → tăng cường lật gương 50% để model
không phụ thuộc chuyện đó.

Chạy (trong .eval/venv):
    python training/phrases/train_phrases.py --data "<repo Look & Tell>/Sign Language Translator/Data" --out public/models/phrases
"""
import argparse, json, os, re
# TF 2.15 đã dùng Keras 2 sẵn (không cần TF_USE_LEGACY_KERAS)
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split

SEQ = 30; FEAT = 126
rng = np.random.default_rng(0)

# Tên thư mục (không dấu) → câu hiển thị có dấu
VI = {
    "ban dang lam gi": "Bạn đang làm gì?", "ban di dau the": "Bạn đi đâu thế?",
    "ban hieu ngon ngu ky hieu khong": "Bạn hiểu ngôn ngữ ký hiệu không?", "ban hoc lop may": "Bạn học lớp mấy?",
    "ban khoe khong": "Bạn khỏe không?", "ban muon gio roi": "Bạn muộn giờ rồi",
    "ban phai canh giac": "Bạn phải cảnh giác", "ban ten la gi": "Bạn tên là gì?",
    "ban tien bo day": "Bạn tiến bộ đấy", "ban trong cau co the": "Bạn trông cậu có thể…",
    "bo me toi cung la nguoi Diec": "Bố mẹ tôi cũng là người Điếc", "cai nay bao nhieu tien": "Cái này bao nhiêu tiền?",
    "cai nay la cai gi": "Cái này là cái gì?", "cam on": "Cảm ơn", "cap cuu": "Cấp cứu", "chuc mung": "Chúc mừng",
    "chung toi giao tiep voi nhau bang ngon ngu ky hieu": "Chúng tôi giao tiếp với nhau bằng ngôn ngữ ký hiệu",
    "con yeu me": "Con yêu mẹ", "cong viec cua ban la gi": "Công việc của bạn là gì?",
    "hen gap lai cac ban": "Hẹn gặp lại các bạn", "mon nay khong ngon": "Món này không ngon",
    "toi bi chong mat": "Tôi bị chóng mặt", "toi bi cuop": "Tôi bị cướp", "toi bi dau dau": "Tôi bị đau đầu",
    "toi bi dau hong": "Tôi bị đau họng", "toi bi ket xe": "Tôi bị kẹt xe", "toi bi lac": "Tôi bị lạc",
    "toi bi phan biet doi xu": "Tôi bị phân biệt đối xử", "toi cam thay rat hoi hop": "Tôi cảm thấy rất hồi hộp",
    "toi cam thay rat vui": "Tôi cảm thấy rất vui", "toi can an sang": "Tôi cần ăn sáng",
    "toi can di ve sinh": "Tôi cần đi vệ sinh", "toi can gap bac si": "Tôi cần gặp bác sĩ",
    "toi can phien dich": "Tôi cần phiên dịch", "toi can thuoc": "Tôi cần thuốc", "toi dang an sang": "Tôi đang ăn sáng",
    "toi dang buon": "Tôi đang buồn", "toi dang o ben xe": "Tôi đang ở bến xe", "toi dang o cong vien": "Tôi đang ở công viên",
    "toi dang phai cach ly": "Tôi đang phải cách ly", "toi dang phan van": "Tôi đang phân vân",
    "toi di sieu thi": "Tôi đi siêu thị", "toi di toi Ha Noi": "Tôi đi tới Hà Nội", "toi doc kem": "Tôi đọc kém",
    "toi khoi benh roi": "Tôi khỏi bệnh rồi", "toi khong dem theo tien": "Tôi không đem theo tiền",
    "toi khong hieu": "Tôi không hiểu", "toi khong quan tam": "Tôi không quan tâm", "toi la hoc sinh": "Tôi là học sinh",
    "toi la nguoi Diec": "Tôi là người Điếc", "toi la tho theu": "Tôi là thợ thêu",
    "toi lam viec o cua hang": "Tôi làm việc ở cửa hàng", "toi nham dia chi": "Tôi nhầm địa chỉ",
    "toi song o Ha Noi": "Tôi sống ở Hà Nội", "toi thay doi bung": "Tôi thấy đói bụng", "toi thay nho ban": "Tôi thấy nhớ bạn",
    "toi thich an mi": "Tôi thích ăn mì", "toi thich phim truyen": "Tôi thích phim truyện", "toi viet kem": "Tôi viết kém",
    "xin chao": "Xin chào",
}


def normalize(frame):
    out = np.zeros(FEAT, np.float32)
    for k in range(2):
        h = frame[k * 63:(k + 1) * 63].reshape(21, 3)
        if not np.any(h): continue
        h = h - h[0]
        s = np.linalg.norm(h[9]) or 1.0
        out[k * 63:(k + 1) * 63] = (h / s).reshape(-1)
    return out


def load(data_dir):
    seqs, ys, raws = [], [], []
    names = sorted(os.listdir(data_dir))
    for ci, name in enumerate(names):
        for sd in sorted(os.listdir(os.path.join(data_dir, name)), key=lambda x: int(x) if x.isdigit() else 0):
            d = os.path.join(data_dir, name, sd)
            fs = sorted((f for f in os.listdir(d) if f.endswith(".npy")), key=lambda f: int(f[:-4]))
            raw = np.stack([np.load(os.path.join(d, f)) for f in fs]).astype(np.float32)
            keep = np.any(raw != 0, axis=1)            # app bỏ frame không thấy tay
            if keep.sum() < 6: continue
            seqs.append(np.stack([normalize(f) for f in raw[keep]])); ys.append(ci); raws.append(raw)
    return seqs, np.array(ys), names, raws


def resample(fr, n=SEQ):
    return fr[np.linspace(0, len(fr) - 1, n).round().astype(int)]


def mirror(fr):
    o = fr.copy().reshape(len(fr), 2, 21, 3)[:, ::-1].copy()
    nz = np.abs(o).sum(axis=(2, 3), keepdims=True) > 0
    o[..., 0] = np.where(nz[..., 0], -o[..., 0], 0)
    return o.reshape(len(fr), FEAT)


def augment(fr):
    if rng.random() < 0.5: fr = mirror(fr)
    T = len(fr)
    if rng.random() < 0.5:  # cắt bớt đầu/cuối
        a = rng.integers(0, max(1, T // 6)); b = T - rng.integers(0, max(1, T // 6)); fr = fr[a:b]
    o = fr.reshape(len(fr), 2, 21, 3).copy()
    t = np.deg2rad(rng.uniform(-15, 15)); c, s = np.cos(t), np.sin(t); sc = rng.uniform(0.9, 1.1)
    nz = np.abs(o).sum(axis=3) > 0
    x, y = o[..., 0].copy(), o[..., 1].copy()
    o[..., 0] = np.where(nz, (c * x - s * y) * sc, 0); o[..., 1] = np.where(nz, (s * x + c * y) * sc, 0)
    fr = resample(o.reshape(len(fr), FEAT))
    return np.where(fr != 0, fr + rng.normal(0, 0.02, fr.shape), 0).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=int, default=200)
    a = ap.parse_args()
    cache = os.path.join(os.path.dirname(a.out.rstrip("/\\")) or ".", "phrases_cache.npz")
    if os.path.exists(cache):  # đọc 216.000 file .npy rất chậm → lưu tạm sau lần đầu
        z = np.load(cache, allow_pickle=True)
        seqs, y, names, raws = list(z["seqs"]), z["y"], list(z["names"]), list(z["raws"])
    else:
        seqs, y, names, raws = load(a.data)
        np.savez(cache, seqs=np.array(seqs, dtype=object), y=y, names=np.array(names), raws=np.array(raws, dtype=object))
    labels = [VI.get(n, n) for n in names]
    print(len(seqs), "chuỗi,", len(labels), "câu")
    idx = np.arange(len(y))
    tr, te = train_test_split(idx, test_size=0.2, random_state=42, stratify=y)
    tr2, inner = train_test_split(tr, test_size=0.1, random_state=7, stratify=y[tr])
    Xin = np.stack([resample(seqs[i]) for i in inner]); yin = y[inner]

    tf.keras.utils.set_random_seed(0)
    m = tf.keras.Sequential([
        tf.keras.layers.Input((SEQ, FEAT)), tf.keras.layers.Masking(0.0),
        tf.keras.layers.LSTM(128, return_sequences=True), tf.keras.layers.Dropout(0.3),
        tf.keras.layers.LSTM(64), tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(64, activation="relu"), tf.keras.layers.Dense(len(labels), activation="softmax")])
    m.compile("adam", "sparse_categorical_crossentropy", metrics=["accuracy"])
    best, best_acc, wait = None, -1, 0
    for ep in range(a.epochs):
        m.fit(np.stack([augment(seqs[i]) for i in tr2]), y[tr2], epochs=1, batch_size=32, verbose=0)
        acc = float((m.predict(Xin, verbose=0).argmax(1) == yin).mean())
        if acc > best_acc: best_acc, best, wait = acc, m.get_weights(), 0
        else: wait += 1
        if ep % 10 == 0: print(f"  epoch {ep:3d} · inner val {acc:.3f} (tốt nhất {best_acc:.3f})", flush=True)
        if wait >= 30: break
    m.set_weights(best)

    rep = {}
    for cname, fn in {"chuẩn": lambda f: f, "lật gương": mirror}.items():
        X = np.stack([resample(fn(seqs[i])) for i in te]); p = m.predict(X, verbose=0)
        rep[cname] = dict(top1=float((p.argmax(1) == y[te]).mean()), app_pass=float(((p.argmax(1) == y[te]) & (p.max(1) >= 0.6)).mean()))
        print(f"  {cname:10s} top1 {rep[cname]['top1']:.1%} · đúng & ≥60% {rep[cname]['app_pass']:.1%}")

    # Xuất TF.js (cùng bộ chuyển thủ công với model từ đơn)
    os.makedirs(a.out, exist_ok=True)
    topo = json.loads(m.to_json()); cell = re.compile(r"/(?:lstm|gru|simple_rnn)_cell(?:_\d+)?/")
    wn, wa = [], []
    for w in m.weights: wn.append(cell.sub("/", w.name.split(":")[0])); wa.append(np.asarray(w.numpy(), "<f4"))
    open(os.path.join(a.out, "group1-shard1of1.bin"), "wb").write(b"".join(x.tobytes() for x in wa))
    json.dump({"format": "layers-model", "generatedBy": "keras", "convertedBy": "manual-numpy-converter",
               "modelTopology": {"keras_version": topo.get("keras_version"), "backend": topo.get("backend"),
                                 "model_config": {"class_name": topo["class_name"], "config": topo["config"]}},
               "weightsManifest": [{"paths": ["group1-shard1of1.bin"], "weights": [{"name": n, "shape": list(x.shape), "dtype": "float32"} for n, x in zip(wn, wa)]}]},
              open(os.path.join(a.out, "model.json"), "w"))
    json.dump(labels, open(os.path.join(a.out, "labels.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"test": rep, "n_test": int(len(te)), "n_train": int(len(tr))}, open(os.path.join(a.out, "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # Mẫu khung xương cho từng câu (dùng làm "video mẫu" vẽ bằng canvas trong app):
    # lấy 1 lần ký đầu tiên của mỗi câu, toạ độ thô x,y (2 tay × 21 điểm), làm tròn 3 số
    demo = {}
    for ci, lab in enumerate(labels):
        i = int(np.where(y == ci)[0][0]); raw = raws[i]
        demo[lab] = [[round(float(v), 3) for v in f.reshape(2, 21, 3)[:, :, :2].reshape(-1)] for f in raw]
    json.dump(demo, open(os.path.join(a.out, "demo.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("Đã xuất →", a.out)


if __name__ == "__main__":
    main()
