"""Trích lại dữ liệu ĐẦY ĐỦ HƠN để thử model mới (xem try_models.py).

extract_landmarks.py chỉ lưu hình dạng bàn tay đã chuẩn hoá theo cổ tay, nên mất hẳn hai thứ ngôn ngữ ký hiệu
dùng để phân biệt từ: tay đang Ở ĐÂU so với cơ thể (trán, cằm, ngực…) và tay DI CHUYỂN thế nào.
Ở đây lưu toạ độ gốc của bàn tay + mốc cơ thể (mũi, vai, khuỷu, hông) + khung mặt, để tính các đặc trưng đó.

Giữ nguyên cách lấy mẫu của extract_landmarks.py (36 frame/video, bỏ frame không thấy tay) và nguyên thứ tự
video của landmarks_raw.npz, để dùng lại audit.json / solid_frames.json / thumbs16.npz.

Chạy (trong .eval/venv):  python training/eval/extract_rich.py --data .eval
"""
import argparse, json, os, sys, urllib.request
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

sys.path.insert(0, os.path.dirname(__file__))
from hand_slots import is_same_label, resolve_same_label  # noqa: E402

SAMPLE_FRAMES = 36
SLOT = {"Left": 0, "Right": 1}
BASE = "https://storage.googleapis.com/mediapipe-models/"
MODELS = {
    "hand_landmarker.task": BASE + "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    "pose_landmarker_lite.task": BASE + "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "blaze_face_short_range.tflite": BASE + "face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
}
# mũi, vai T/P, khuỷu T/P, cổ tay T/P, hông T/P
POSE_IDX = [0, 11, 12, 13, 14, 15, 16, 23, 24]

_H = _P = _F = None


def _init(d):
    global _H, _P, _F
    opt = lambda f: mp_tasks.BaseOptions(model_asset_path=os.path.join(d, f))
    _H = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=opt("hand_landmarker.task"), running_mode=vision.RunningMode.IMAGE, num_hands=2, min_hand_detection_confidence=0.5))
    _P = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=opt("pose_landmarker_lite.task"), running_mode=vision.RunningMode.IMAGE, num_poses=1))
    _F = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(
        base_options=opt("blaze_face_short_range.tflite"), running_mode=vision.RunningMode.IMAGE))


def _extract(job):
    j, path = job
    cap = cv2.VideoCapture(path); total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    want = None if total <= 0 else set(range(total)) if total <= SAMPLE_FRAMES else set(np.linspace(0, total - 1, SAMPLE_FRAMES).round().astype(int))
    hands, world, pose, face, tpos, hlab, hscore = [], [], [], [], [], [], []
    i = 0; same = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        if want is None or i in want:
            h, w = fr.shape[:2]
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)))
            res = _H.detect(img)
            if res.hand_landmarks:
                hd = np.zeros((2, 21, 3), np.float32); wd = np.zeros((2, 21, 3), np.float32)
                # Nhãn GỐC của MediaPipe + điểm tin cậy cho từng ô (-1 = ô trống), để dump_feat_ref.py
                # xuất lại đúng đầu vào app nhận và kiểm được cả trường hợp hai tay cùng nhãn.
                lab = np.full(2, -1, np.int8); sc = np.zeros(2, np.float32)
                hl = [{"label": c[0].category_name, "raw": c[0].category_name, "score": c[0].score, "lms": lms, "wl": wl}
                      for lms, wl, c in zip(res.hand_landmarks, res.hand_world_landmarks, res.handedness)]
                same += is_same_label(hl)
                for x in resolve_same_label(hl):  # hai tay cùng nhãn: không để tay sau ghi đè tay trước
                    s = SLOT.get(x["label"])
                    if s is None: continue
                    hd[s] = [[q.x, q.y, q.z] for q in x["lms"]]; wd[s] = [[q.x, q.y, q.z] for q in x["wl"]]
                    lab[s] = SLOT.get(x["raw"], -1); sc[s] = x["score"]
                pr = _P.detect(img); pd = np.zeros((len(POSE_IDX), 3), np.float32)
                if pr.pose_landmarks:
                    pd[:] = [[pr.pose_landmarks[0][k].x, pr.pose_landmarks[0][k].y, pr.pose_landmarks[0][k].visibility] for k in POSE_IDX]
                fr_ = _F.detect(img); fd = np.zeros(4, np.float32)
                if fr_.detections:
                    b = max(fr_.detections, key=lambda d: d.bounding_box.width * d.bounding_box.height).bounding_box
                    fd[:] = [(b.origin_x + b.width / 2) / w, (b.origin_y + b.height / 2) / h, b.width / w, b.height / h]
                hands.append(hd); world.append(wd); pose.append(pd); face.append(fd); tpos.append(i / max(1, total - 1))
                hlab.append(lab); hscore.append(sc)
        i += 1
    cap.release()
    if not hands: return j, None
    return j, (np.array(hands), np.array(world), np.array(pose), np.array(face), np.array(tpos, np.float32), np.float32(h / w),
               np.array(hlab), np.array(hscore), same)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 6))
    a = ap.parse_args()
    for f, url in MODELS.items():
        p = os.path.join(a.data, f)
        if not os.path.exists(p): print("tải", f, flush=True); urllib.request.urlretrieve(url, p)
    z = np.load(os.path.join(a.data, "landmarks_raw.npz"))
    names = [str(n) for n in z["names"]]
    clean = sorted(int(i) for i in json.load(open(os.path.join(a.data, "audit.json")))["group"])
    print(len(clean), "video sạch /", len(names), flush=True)

    from multiprocessing import Pool
    out = {}
    with Pool(a.workers, initializer=_init, initargs=(a.data,)) as pool:
        for k, (j, r) in enumerate(pool.imap_unordered(_extract, [(j, names[j]) for j in clean], chunksize=4)):
            out[j] = r
            if k % 200 == 0: print(f"{k}/{len(clean)}", flush=True)
    lens = np.zeros(len(names), np.int32); aspect = np.ones(len(names), np.float32)
    parts = [[], [], [], [], [], [], []]  # hands, world, pose, face, tpos, hlab, hscore
    same = {}
    for j in clean:
        r = out.get(j)
        if r is None: continue
        lens[j] = len(r[0]); aspect[j] = r[5]; same[j] = r[8]
        for k, src in enumerate((0, 1, 2, 3, 4, 6, 7)): parts[k].append(r[src])
    np.savez_compressed(os.path.join(a.data, "rich.npz"), lens=lens, aspect=aspect, y=z["y"], names=z["names"],
                        hands=np.concatenate(parts[0]), world=np.concatenate(parts[1]), pose=np.concatenate(parts[2]),
                        face=np.concatenate(parts[3]), tpos=np.concatenate(parts[4]),
                        hlab=np.concatenate(parts[5]), hscore=np.concatenate(parts[6]))
    print("Xong:", int((lens > 0).sum()), "video,", int(lens.sum()), "frame", flush=True)
    print("Frame hai tay CÙNG nhãn (đã xếp lại ô):", sum(same.values()), "frame ở", sum(n > 0 for n in same.values()), "video", flush=True)


if __name__ == "__main__":
    main()
