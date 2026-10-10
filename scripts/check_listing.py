"""Kiểm số ký tự các trường trong docs/store/STORE_LISTING.md so với giới hạn của cửa hàng.
Mỗi trường đánh dấu bằng <!-- field:<tên> max=<N> --> và khối ```text ngay sau đó.
Chạy: python scripts/check_listing.py   (thoát mã 1 nếu có trường vượt giới hạn)
"""
import os, re, sys

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "store", "STORE_LISTING.md")
s = open(p, encoding="utf-8").read()
bad = 0
for m in re.finditer(r"<!-- field:(\w+) max=(\d+) -->.*?```text\n(.*?)\n```", s, re.S):
    name, mx, body = m.group(1), int(m.group(2)), m.group(3)
    n = len(body)
    flag = "OK " if n <= mx else "VUOT"
    bad += n > mx
    sys.stdout.buffer.write(f"{flag} {name:22s} {n:5d}/{mx}\n".encode("utf-8"))
sys.exit(1 if bad else 0)
