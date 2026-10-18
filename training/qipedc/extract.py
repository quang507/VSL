"""Trích landmark bàn tay cho video từ điển QIPEDC, cùng cách chuẩn hoá với ViSignLanguage
(MediaPipe Tasks, IMAGE mode, 36 frame/video, toạ độ tương đối cổ tay).

Video QIPEDC là 1280×720 → thu nhỏ còn rộng 640 trước khi nhận diện cho đỡ tốn RAM/CPU
(landmark là toạ độ chuẩn hoá nên không đổi thang đo). Làm theo từng lô 500 video,
lô nào xong thì lưu lại; chạy lại sẽ bỏ qua lô đã có.

Kết quả dùng làm MẪU để chấm "ký có giống mẫu không" (mỗi từ chỉ có 1 video).

Chạy (trong .eval/venv):
    python training/qipedc/extract.py --dir .eval/qipedc --task .eval/hand_landmarker.task --workers 6
"""
import argparse, glob, json, os, sys
from multiprocessing import Pool
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "eval"))
import extract_landmarks as E  # noqa: E402

CHUNK = 500
WIDTH = 640


def _extract(job):
    k, p = job
    try:
        import cv2
        import mediapipe as mp
        cap = cv2.VideoCapture(p)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        want = E.sample_idx(total, E.SAMPLE_FRAMES)
        frames, i = [], 0
        while True:
            ok = cap.grab()
            if not ok:
                break
            if want is None or i in want:
                ok, fr = cap.retrieve()
                if ok:
                    h, w = fr.shape[:2]
                    if w > WIDTH:
                        fr = cv2.resize(fr, (WIDTH, round(h * WIDTH / w)), interpolation=cv2.INTER_AREA)
                    img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)))
                    res = E._LM.detect(img)
                    hl = [{"label": hd[0].category_name, "score": hd[0].score, "points": np.array([[q.x, q.y, q.z] for q in lms], dtype=np.float32)}
                          for lms, hd in zip(res.hand_landmarks, res.handedness)]
                    if hl:
                        frames.append(E.build_frame(hl))
            i += 1
        cap.release()
        return k, (np.array(frames, dtype=np.float32) if frames else None)
    except Exception as ex:  # một video hỏng không được làm sập cả lượt
        print("lỗi", p, ex, flush=True)
        return k, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--task", required=True)
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    items = json.load(open(os.path.join(a.dir, "list.json"), encoding="utf-8"))["data"]
    vids = os.path.join(a.dir, "videos")
    parts = os.path.join(a.dir, "parts")
    os.makedirs(parts, exist_ok=True)
    jobs = [(k, os.path.join(vids, f"{it['_id']}.mp4")) for k, it in enumerate(items) if os.path.exists(os.path.join(vids, f"{it['_id']}.mp4"))]
    print(len(jobs), "video", flush=True)

    with Pool(a.workers, initializer=E._init, initargs=(a.task,), maxtasksperchild=200) as pool:
        for c in range(0, len(jobs), CHUNK):
            fn = os.path.join(parts, f"{c:05d}.npz")
            if os.path.exists(fn):
                continue
            got = dict(pool.imap_unordered(_extract, jobs[c:c + CHUNK], chunksize=2))
            keep = [k for k, _ in jobs[c:c + CHUNK] if got.get(k) is not None]
            seqs = [got[k] for k in keep]
            np.savez_compressed(fn, data=np.concatenate(seqs) if seqs else np.zeros((0, E.FEAT), np.float32),
                                lens=np.array([len(s) for s in seqs], dtype=np.int32), k=np.array(keep, dtype=np.int32))
            print(f"{min(c + CHUNK, len(jobs))}/{len(jobs)} · lô này {len(keep)} video có tay", flush=True)

    data, lens, ks = [], [], []
    for fn in sorted(glob.glob(os.path.join(parts, "*.npz"))):
        z = np.load(fn)
        data.append(z["data"]); lens.append(z["lens"]); ks.append(z["k"])
    ks = np.concatenate(ks)
    np.savez_compressed(
        os.path.join(a.dir, "landmarks.npz"),
        data=np.concatenate(data), lens=np.concatenate(lens),
        ids=np.array([items[k]["_id"] for k in ks]), words=np.array([items[k]["word"] for k in ks]),
    )
    print(f"Xong: {len(ks)}/{len(jobs)} video có tay", flush=True)


if __name__ == "__main__":
    main()
