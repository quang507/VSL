"""Gom danh sách QIPEDC thành file từ điển gọn cho app: public/data/qipedc.json

Mỗi mục = 1 từ: {w: từ, k: loại (0 từ, 1 số, 2 chữ cái), s: [nghĩa]}, mỗi nghĩa {d: nghĩa, t: từ loại, v: {B|T|N|_: mã video}}
(một từ có thể có 2 nghĩa, mỗi nghĩa một video riêng, vd. "tác động" danh từ / động từ)
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
        e = by.setdefault(w, {"w": w, "k": it["type"], "s": {}})
        vid = it["_id"]
        reg = vid[-1] if vid[-1] in "BTN" else "_"
        base = vid[:-1] if reg != "_" else vid  # cùng mã gốc = cùng nghĩa, khác miền
        sense = e["s"].setdefault(base, {"d": "", "t": "", "v": {}})
        if not sense["d"] and it["description"].strip(): sense["d"] = it["description"].strip()
        if not sense["t"] and it["tl"].strip(): sense["t"] = it["tl"].strip()
        sense["v"].setdefault(reg, vid)
    for e in by.values():
        e["s"] = [e["s"][k] for k in sorted(e["s"])]
    out = sorted(by.values(), key=lambda e: e["w"])
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(out), "từ,", sum(len(x["v"]) for e in out for x in e["s"]), "video,", sum(len(e["s"]) > 1 for e in out), "từ nhiều nghĩa,", os.path.getsize(a.out) // 1024, "KB")


if __name__ == "__main__":
    main()
