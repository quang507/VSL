"""Xếp hai bàn tay vào ô [Trái, Phải] khi MediaPipe gán CÙNG nhãn cho cả hai tay.

Lúc hai tay bắt chéo / chồng nhau, HandLandmarker đôi khi trả hai tay cùng "Left" (hoặc cùng "Right").
Trước đây tay sau ghi đè tay trước vào cùng một ô → mất hẳn một bàn tay trong frame đó.
Quy tắc: giữ nhãn của tay chắc hơn (điểm handedness cao hơn), chuyển tay kia sang ô còn lại;
bằng điểm thì giữ tay đứng trước.

PHẢI khớp y hệt resolveSameLabel trong lib/landmarks.ts (kiểm bằng tests/e2e/features.unit.ts).
File này cố ý không import gì nặng (mediapipe, cv2) để dump_feat_ref.py chạy được không cần chúng.
"""

OTHER = {"Left": "Right", "Right": "Left"}


def resolve_same_label(hands):
    """hands: danh sách dict có "label" ("Left"/"Right") và "score" (tuỳ chọn, mặc định 0).
    Trả về danh sách mới; dict của tay bị chuyển ô là bản sao (không sửa dict gốc)."""
    if len(hands) != 2 or hands[0]["label"] != hands[1]["label"]:
        return hands
    a, b = hands
    hi, lo = (a, b) if (a.get("score") or 0) >= (b.get("score") or 0) else (b, a)
    return [hi, {**lo, "label": OTHER.get(hi["label"], lo["label"])}]


def is_same_label(hands):
    return len(hands) == 2 and hands[0]["label"] == hands[1]["label"]
