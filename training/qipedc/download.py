"""Tải video từ điển QIPEDC (Bộ GD&ĐT) — đã được phép sử dụng.
Lấy danh sách từ POST /dictionary/getAll, tải /videos/<id>.mp4. Chạy lại sẽ bỏ qua file đã có.
Chạy: python training/qipedc/download.py --out .eval/qipedc
"""
import argparse, json, os, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE = "https://qipedc.moet.gov.vn"


def fetch_list(out):
    p = os.path.join(out, "list.json")
    if not os.path.exists(p):
        data = urllib.parse.urlencode({"group": 20, "text": ""}).encode()
        req = urllib.request.Request(BASE + "/dictionary/getAll", data=data, headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"})
        open(p, "wb").write(urllib.request.urlopen(req, timeout=60).read())
    return json.load(open(p, encoding="utf-8"))["data"]


def get(args):
    vid, out = args
    dst = os.path.join(out, "videos", vid + ".mp4")
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return vid, "skip"
    for attempt in range(4):
        try:
            data = urllib.request.urlopen(f"{BASE}/videos/{vid}.mp4", timeout=120).read()
            open(dst + ".part", "wb").write(data); os.replace(dst + ".part", dst)
            return vid, "ok"
        except Exception as e:  # mạng chập chờn → thử lại chậm dần
            time.sleep(2 * (attempt + 1)); err = str(e)
    return vid, "lỗi " + err


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "videos"), exist_ok=True)
    items = fetch_list(a.out)
    ids = [x["_id"] for x in items]
    done = fail = 0
    with ThreadPoolExecutor(a.workers) as ex:
        for k, (vid, st) in enumerate(ex.map(get, [(i, a.out) for i in ids])):
            done += st in ("ok", "skip"); fail += st.startswith("lỗi")
            if st.startswith("lỗi"): print(vid, st, flush=True)
            if k % 200 == 0: print(f"{k}/{len(ids)} · xong {done} · lỗi {fail}", flush=True)
    print(f"Xong: {done}/{len(ids)} video, lỗi {fail}")


if __name__ == "__main__":
    main()
