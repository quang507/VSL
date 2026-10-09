"""Tải MỘT video mẫu cho mỗi nhãn từ ViSignLanguage-Video (CC-BY-4.0, PTIT AI Challenge)
vào public/samples/<nhãn>.mp4 để app hiện video mẫu.

Video nằm trong dataset.zip (~860MB). Script dùng HTTP Range (remotezip) để
chỉ kéo đúng các file cần, không tải cả zip.
Chạy:  pip install remotezip huggingface_hub && python training/fetch_samples.py
"""
import json, os, unicodedata
from collections import defaultdict
from huggingface_hub import hf_hub_url
from remotezip import RemoteZip

REPO = "star092304/ViSignLanguage-Video"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "samples")
LABELS = os.path.join(ROOT, "public", "labels.json")
nfc = lambda s: unicodedata.normalize("NFC", s)

labels = [nfc(x) for x in json.load(open(LABELS, encoding="utf-8"))]
url = hf_hub_url(REPO, "dataset.zip", repo_type="dataset")
os.makedirs(OUT, exist_ok=True)
with RemoteZip(url) as z:
    infos = [i for i in z.infolist() if i.filename.lower().endswith(".mp4")]
    by_label = defaultdict(list)
    for i in infos:
        parts = i.filename.replace("\\", "/").split("/")
        if len(parts) >= 2:
            by_label[nfc(parts[-2])].append(i)
    print(f"{len(infos)} video, {len(by_label)} nhãn trong zip")
    missing = []
    for lab in labels:
        # ưu tiên video trong train/, chọn file nhỏ vừa phải
        cands = sorted(by_label.get(lab, []), key=lambda i: ("train" not in i.filename.lower(), i.file_size))
        if not cands:
            missing.append(lab); continue
        pick = cands[len(cands) // 2]
        dst = os.path.join(OUT, lab + ".mp4")
        if os.path.exists(dst):
            continue
        with z.open(pick) as src, open(dst, "wb") as out:
            out.write(src.read())
        print("ok", lab, pick.file_size // 1024, "KB")
    print("Thiếu:", missing)
