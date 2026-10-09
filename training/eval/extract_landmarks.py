"""Trích landmark cho toàn bộ ViSignLanguage-Video, Y HỆT ô 4 của colab_train_vsl.ipynb
(MediaPipe Tasks, IMAGE mode, lấy mẫu 36 frame/video, bỏ frame không thấy tay).

Khác notebook ở chỗ: lưu cả chuỗi frame GỐC (chưa resample) để thử nghiệm
các điều kiện khác nhau (đệm frame đứng yên, lật gương, …).

Chạy (trong .eval/venv, Python 3.11):
    python training/eval/extract_landmarks.py --zip .eval/dataset.zip --out .eval
"""
import argparse, json, os, unicodedata, urllib.request, zipfile
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision
from tqdm import tqdm

NUM_HANDS = 2; FEAT_HAND = 63; FEAT = 126; WRIST = 0; MIDDLE_MCP = 9; SAMPLE_FRAMES = 36
TASK_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"


def normalize_hand(points):
    pts = points.astype(np.float32).copy(); pts -= pts[WRIST].copy()
    s = np.linalg.norm(pts[MIDDLE_MCP]) or 1.0
    return (pts / s).reshape(-1)


def build_frame(hands):
    f = np.zeros(FEAT, dtype=np.float32); slot = {"Left": 0, "Right": 1}
    for h in hands:
        i = slot.get(h["label"])
        if i is None: continue
        f[i * FEAT_HAND:(i + 1) * FEAT_HAND] = normalize_hand(h["points"])
    return f


def sample_idx(total, k):
    if total <= 0: return None
    if total <= k: return set(range(total))
    return set(np.linspace(0, total - 1, k).round().astype(int))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    vid_dir = os.path.join(a.out, "videos")
    if not os.path.isdir(vid_dir):
        print("Giải nén…")
        with zipfile.ZipFile(a.zip) as z: z.extractall(vid_dir)
    task = os.path.join(a.out, "hand_landmarker.task")
    if not os.path.exists(task): urllib.request.urlretrieve(TASK_URL, task)
    lm = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=task),
        running_mode=vision.RunningMode.IMAGE, num_hands=NUM_HANDS, min_hand_detection_confidence=0.5))

    samples = []
    for root, _, files in os.walk(vid_dir):
        for fn in files:
            if fn.lower().endswith(".mp4"):
                p = os.path.join(root, fn)
                samples.append((p.replace("\\", "/"), unicodedata.normalize("NFC", os.path.basename(root))))
    samples = sorted(samples)  # giống notebook: thứ tự cố định
    labels = sorted({l for _, l in samples}); l2i = {l: i for i, l in enumerate(labels)}
    print(len(samples), "video,", len(labels), "nhãn")

    seqs, ys, names = [], [], []
    for p, lab in tqdm(samples):
        cap = cv2.VideoCapture(p); total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        want = sample_idx(total, SAMPLE_FRAMES); frames = []; i = 0
        while True:
            ok, fr = cap.read()
            if not ok: break
            if want is None or i in want:
                img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)))
                res = lm.detect(img); hl = []
                for lms, hd in zip(res.hand_landmarks, res.handedness):
                    hl.append({"label": hd[0].category_name, "points": np.array([[q.x, q.y, q.z] for q in lms], dtype=np.float32)})
                if hl: frames.append(build_frame(hl))
            i += 1
        cap.release()
        if frames:
            seqs.append(np.array(frames, dtype=np.float32)); ys.append(l2i[lab]); names.append(p)

    lens = np.array([len(s) for s in seqs])
    np.savez_compressed(os.path.join(a.out, "landmarks_raw.npz"),
                        data=np.concatenate(seqs), lens=lens, y=np.array(ys), names=np.array(names))
    json.dump(labels, open(os.path.join(a.out, "labels.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("Xong:", len(seqs), "mẫu, bỏ", len(samples) - len(seqs), "video không thấy tay")


if __name__ == "__main__":
    main()
