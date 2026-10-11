"""Rà dữ liệu ViSignLanguage-Video (thư mục train, nhãn sạch) trước khi train lại.

Tìm:
  1. bản sao: file trùng byte (md5) và file "<id>_1/_2/_3" nhân bản từ "<id>"
  2. trùng nội dung khác tên: chuỗi landmark gần như y hệt → gom chung một nhóm
  3. trùng nội dung nhưng KHÁC nhãn (mâu thuẫn nhãn)
  4. video quá ít frame thấy tay
Ra: .eval/audit.json (nhóm cho từng mẫu, danh sách loại bỏ) + training/eval/report_audit.json (tóm tắt)

Chạy (venv): python training/eval/audit_data.py --data .eval
"""
import argparse, collections, hashlib, json, os, re
import numpy as np

SEQ = 30
MIN_HAND_FRAMES = 6
NEAR = 0.02  # khoảng cách trung bình/toạ độ dưới mức này coi như cùng một video


def resample(fr, n=SEQ):
    return fr[np.linspace(0, len(fr) - 1, n).round().astype(int)]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True)
    a = ap.parse_args()
    z = np.load(os.path.join(a.data, "landmarks_raw.npz"))
    seqs = np.split(z["data"], np.cumsum(z["lens"])[:-1]); y = z["y"]; names = [str(n) for n in z["names"]]
    labels = json.load(open(os.path.join(a.data, "labels.json"), encoding="utf-8"))
    clean = [i for i in range(len(y)) if "private_test" not in names[i]]
    print(len(clean), "video sạch (thư mục train)")

    # 1. md5 + nhóm theo tên gốc
    md5 = {}
    for i in clean:
        p = names[i] if os.path.isabs(names[i]) or os.path.exists(names[i]) else os.path.join(a.data, names[i])
        md5[i] = hashlib.md5(open(p, "rb").read()).hexdigest() if os.path.exists(p) else f"?{i}"
    stem = {i: re.sub(r"_\d+$", "", os.path.splitext(os.path.basename(names[i]))[0]) for i in clean}

    # union-find để gom nhóm
    par = {i: i for i in clean}
    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj: par[rj] = ri

    by_md5 = collections.defaultdict(list)
    for i in clean: by_md5[md5[i]].append(i)
    n_md5 = sum(len(v) - 1 for v in by_md5.values())
    for v in by_md5.values():
        for j in v[1:]: union(v[0], j)
    by_stem = collections.defaultdict(list)
    for i in clean: by_stem[stem[i]].append(i)
    for v in by_stem.values():
        for j in v[1:]: union(v[0], j)

    # 2. trùng nội dung: so chuỗi landmark (đã lấy mẫu lại) giữa mọi cặp
    X = np.stack([resample(seqs[i]).ravel() for i in clean]).astype(np.float32)
    nz = np.maximum((X != 0).sum(1), 1)
    near_pairs = []
    for k in range(len(clean)):
        d = np.abs(X[k + 1:] - X[k]).sum(1) / np.maximum(nz[k + 1:], nz[k])
        for off in np.nonzero(d < NEAR)[0]:
            near_pairs.append((clean[k], clean[k + 1 + off], float(d[off])))
    for i, j, _ in near_pairs: union(i, j)

    groups = collections.defaultdict(list)
    for i in clean: groups[find(i)].append(i)

    # 3. nhóm có nhiều nhãn khác nhau
    conflicts = [sorted({labels[y[i]] for i in g}) for g in groups.values() if len({y[i] for i in g}) > 1]
    conflict_idx = {i for g in groups.values() if len({y[i] for i in g}) > 1 for i in g}

    # 4. ít frame thấy tay
    few = [i for i in clean if len(seqs[i]) < MIN_HAND_FRAMES]

    # Giữ 1 đại diện mỗi nhóm (mẫu có nhiều frame thấy tay nhất), bỏ nhóm mâu thuẫn và video ít tay
    keep = []
    for g in groups.values():
        if any(i in conflict_idx for i in g): continue
        g = [i for i in g if i not in set(few)]
        if g: keep.append(max(g, key=lambda i: (len(seqs[i]), -i)))
    keep.sort()
    per_class = collections.Counter(int(y[i]) for i in keep)

    summary = {
        "video_sach": len(clean),
        "trung_md5": n_md5,
        "nhan_ban_theo_ten": sum(len(v) - 1 for v in by_stem.values()),
        "cap_trung_noi_dung": len(near_pairs),
        "so_nhom_video_goc": len(groups),
        "nhom_mau_thuan_nhan": len(conflicts),
        "vi_du_mau_thuan": conflicts[:15],
        "it_frame_thay_tay": len(few),
        "giu_lai": len(keep),
        "mau_moi_lop_min_max": [min(per_class.values()), max(per_class.values())],
        "lop_it_mau_nhat": [(labels[c], n) for c, n in sorted(per_class.items(), key=lambda t: t[1])[:8]],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    group_of = {i: find(i) for i in clean}
    json.dump({"keep": [int(i) for i in keep], "group": {str(i): int(g) for i, g in group_of.items()},
               "drop_conflict": sorted(int(i) for i in conflict_idx), "drop_few": [int(i) for i in few]},
              open(os.path.join(a.data, "audit.json"), "w"))
    json.dump(summary, open(os.path.join(os.path.dirname(__file__), "report_audit.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
