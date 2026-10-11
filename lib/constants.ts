// Hằng số dùng chung — PHẢI khớp y hệt training/config.py
export const NUM_HANDS = 2;
export const NUM_LANDMARKS = 21;
export const COORDS = 3;
export const FEATURES_PER_HAND = NUM_LANDMARKS * COORDS; // 63
export const FEATURES_PER_FRAME = NUM_HANDS * FEATURES_PER_HAND; // 126

export const SEQ_LEN = 30;

/** Đặc trưng mỗi frame mà model cần (phải khớp training/eval/try_models.py):
 *  "hands" = 126 số hình dạng hai bàn tay (model câu giao tiếp, model từ cũ)
 *  "face"  = 136 số: thêm vị trí cổ tay và đầu ngón giữa so với MẶT, cộng vector giữa hai cổ tay */
export type FeatureKind = "hands" | "face";
export const FACE_LOC = 4;
export const FEATURES_PER_FRAME_FACE = FEATURES_PER_FRAME + 2 * FACE_LOC + 2; // 136
export const MIDDLE_TIP = 12;

export const WRIST = 0;
export const MIDDLE_MCP = 9;

// Ngưỡng tin cậy để coi là "đúng" (model từ đơn). Chọn bằng training/eval/try_models.py --calibrate
// trên người ký lạ (12/10/2026, face+cnn): 0,4 → 89% lần ký đúng được báo Đúng, 40% lần ký sai lọt (= 8% tổng);
// 0,6 → 75% / 18%. Model này train với label smoothing nên độ tin cậy thấp hơn model cũ.
export const CONFIDENCE_THRESHOLD = 0.4;
// Model câu giao tiếp vẫn là model cũ (không smoothing) → giữ ngưỡng cũ
export const PHRASE_CONFIDENCE_THRESHOLD = 0.6;

// Đường dẫn model & nhãn (đặt trong public/)
import { asset } from "./base";

export const MODEL_URL = asset("/models/vsl/model.json");
export const LABELS_URL = asset("/labels.json");
/** Đặc trưng của model từ đơn hiện tại (đổi sang "face" khi thay model) */
export const WORD_FEATURES: FeatureKind = "face";
