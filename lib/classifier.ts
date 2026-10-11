// Load model TF.js + dự đoán nhãn từ chuỗi landmark.
// Hỗ trợ nhiều model (từ đơn, câu giao tiếp…) — mỗi model nạp 1 lần rồi dùng lại.
import * as tf from "@tensorflow/tfjs";
import { MODEL_URL, LABELS_URL, SEQ_LEN } from "./constants";

export interface Prediction {
  label: string;
  confidence: number;
}

interface Loaded {
  model: tf.LayersModel;
  labels: string[];
}

const cache = new Map<string, Promise<Loaded>>();
const ready = new Map<string, Loaded>();

export async function loadModel(modelUrl: string, labelsUrl: string): Promise<Loaded> {
  let p = cache.get(modelUrl);
  if (!p) {
    p = (async () => {
      const [m, res] = await Promise.all([tf.loadLayersModel(modelUrl), fetch(labelsUrl)]);
      const labels: string[] = await res.json();
      // Khởi động: lần predict đầu trên WebGL mất vài giây (biên dịch shader).
      // Chạy trước 1 lần với input rỗng để lúc người dùng ký xong có kết quả ngay.
      const nfeat = Number(m.inputs[0].shape[2]);
      const zero = tf.zeros([1, SEQ_LEN, nfeat]);
      const warm = m.predict(zero) as tf.Tensor;
      await warm.data();
      zero.dispose();
      warm.dispose();
      const l = { model: m, labels };
      ready.set(modelUrl, l);
      return l;
    })();
    cache.set(modelUrl, p);
    p.catch(() => cache.delete(modelUrl)); // lỗi mạng thì cho thử lại
  }
  return p;
}

/** Trả về top-k nhãn kèm độ tin cậy, sắp giảm dần */
export async function predictTopK(modelUrl: string, sequence: Float32Array, k = 3): Promise<Prediction[]> {
  const l = ready.get(modelUrl);
  if (!l) throw new Error("Model chưa load");
  const nfeat = Number(l.model.inputs[0].shape[2]);
  if (sequence.length !== SEQ_LEN * nfeat) throw new Error(`Model cần ${nfeat} số/frame, nhận ${sequence.length / SEQ_LEN}`);
  const input = tf.tensor(sequence, [1, SEQ_LEN, nfeat]);
  const output = l.model.predict(input) as tf.Tensor;
  const probs = (await output.data()) as Float32Array;
  input.dispose();
  output.dispose();
  return Array.from(probs)
    .map((c, i) => ({ label: l.labels[i] ?? "?", confidence: c }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, k);
}

// ---- API cũ cho model từ đơn mặc định (practice / quiz đang dùng) ----
export async function loadClassifier(): Promise<void> {
  await loadModel(MODEL_URL, LABELS_URL);
}

export function getLabels(): string[] {
  return ready.get(MODEL_URL)?.labels ?? [];
}

export function isReady(): boolean {
  return ready.has(MODEL_URL);
}

export async function predict(sequence: Float32Array): Promise<Prediction> {
  return (await predictTopK(MODEL_URL, sequence, 1))[0];
}
