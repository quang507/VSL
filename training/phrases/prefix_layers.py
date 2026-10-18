"""Đổi tên mọi layer/weight trong model.json TF.js bằng tiền tố (vd. "phr_").

TF.js đăng ký biến toàn cục theo tên ("lstm/kernel"…). Hai model cùng tên layer nạp
trong cùng một trang sẽ lỗi "Variable with name lstm/kernel was already registered".
Chạy: python training/phrases/prefix_layers.py public/models/phrases/model.json phr_
"""
import json, sys

path, pre = sys.argv[1], sys.argv[2]
mj = json.load(open(path, encoding="utf-8"))
cfg = mj["modelTopology"]["model_config"]["config"]
cfg["name"] = pre + cfg.get("name", "model")
for layer in cfg["layers"]:
    n = layer["config"].get("name")
    if n and not n.startswith(pre):
        layer["config"]["name"] = pre + n
for w in mj["weightsManifest"][0]["weights"]:
    if not w["name"].startswith(pre):
        w["name"] = pre + w["name"]
json.dump(mj, open(path, "w", encoding="utf-8"))
print("Đã thêm tiền tố", pre, "cho", len(cfg["layers"]), "layer")
