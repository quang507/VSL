"""Gom danh sách QIPEDC thành file từ điển gọn cho app: public/data/qipedc.json

Mỗi mục = 1 từ: {w: từ, d: nghĩa, t: từ loại, k: loại (0 từ, 1 số, 2 chữ cái), v: {B|T|N|_: mã video}}
B/T/N = biến thể miền Bắc/Trung/Nam, "_" = dùng chung. Video phát từ
https://qipedc.moet.gov.vn/videos/<mã>.mp4 (không đóng gói vào app).

Chạy: python training/qipedc/build_dict.py --list .eval/qipedc/list.json --out public/data/qipedc.json
"""
import argparse, json, os, unicodedata


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    items = json.load(open(a.list, encoding="utf-8"))["data"]
    by = {}
    for it in items:
        w = unicodedata.normalize("NFC", it["word"].strip())
        e = by.setdefault(w, {"w": w, "d": "", "t": it["tl"].strip(), "k": it["type"], "v": {}})
        if not e["d"] and it["description"].strip():
            e["d"] = it["description"].strip()
        if not e["t"] and it["tl"].strip():
            e["t"] = it["tl"].strip()
        vid = it["_id"]
        reg = vid[-1] if vid[-1] in "BTN" else "_"
        e["v"].setdefault(reg, vid)
    out = sorted(by.values(), key=lambda e: e["w"])
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(out), "từ,", sum(len(e["v"]) for e in out), "video,", os.path.getsize(a.out) // 1024, "KB")


if __name__ == "__main__":
    main()
