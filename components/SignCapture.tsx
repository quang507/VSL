"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Info, RotateCcw, Sparkles } from "lucide-react";
import CameraStage from "@/components/CameraStage";
import CameraError from "@/components/CameraError";
import { Btn } from "@/components/ui";
import { useSignPractice } from "@/lib/useSignPractice";
import { useContinuousSign } from "@/lib/useContinuousSign";
import { loadProfile } from "@/lib/profile";
import type { Prediction } from "@/lib/classifier";
import type { FeatureKind } from "@/lib/constants";

interface Props {
  modelUrl: string;
  labelsUrl: string;
  /** Đặc trưng model cần ("face" = cần thấy cả mặt trong khung) */
  features?: FeatureKind;
  /** Kết quả một lần ký. null = không thấy tay (chỉ ở chế độ bấm nút). */
  onResult: (pred: Prediction | null) => void;
  /** Ngừng chấm (đã đúng, hoặc đang chờ sang câu khác). */
  locked?: boolean;
  /** Đã ký ít nhất một lần → nút ghi "Thử lại" (chế độ bấm nút). */
  attempted?: boolean;
  errorNote?: string;
  manualLabel?: string;
  /** Hiện ở góc khung camera (video mẫu thu nhỏ). */
  corner?: React.ReactNode;
}

/**
 * Khung camera + chấm ký hiệu, hai chế độ theo Cài đặt → "Tự chấm khi ký":
 *  - Tự chấm (mặc định): không cần bấm gì. App thấy tay chuyển động thì ghi, tay dừng ~0,5 giây
 *    hoặc hạ xuống thì chấm, rồi tự chờ lần ký tiếp theo.
 *  - Bấm nút: đếm ngược 3-2-1 rồi ghi 2,5 giây (cho người muốn có thời gian vào vị trí).
 * Mỗi chế độ là một component riêng để chỉ mở MỘT luồng camera.
 */
export default function SignCapture(props: Props) {
  const [auto, setAuto] = useState<boolean | null>(null);
  useEffect(() => setAuto(loadProfile().autoSign), []);
  if (auto === null) return <div className="cam skeleton" aria-hidden />;
  return auto ? <AutoCapture {...props} /> : <ManualCapture {...props} />;
}

const COOLDOWN_MS = 1500; // nghỉ sau mỗi lần chấm để đọc kết quả và hạ tay
const MIN_CONF = 0.25; // dưới mức này coi là cử động vu vơ, không tính là một lần ký (model face+cnn có label smoothing nên độ tin cậy thấp hơn model cũ)

function AutoCapture({ modelUrl, labelsUrl, features = "hands", onResult, locked, errorNote, corner }: Props) {
  const cb = useRef(onResult);
  cb.current = onResult;
  const lockedRef = useRef(!!locked);
  lockedRef.current = !!locked;
  const [cooling, setCooling] = useState(false);
  const [unclear, setUnclear] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const { videoRef, canvasRef, status, handsVisible, hint, faceSeen, modelReady, modelFailed, cameraError, setPaused } = useContinuousSign(modelUrl, labelsUrl, (top) => {
    if (lockedRef.current) return;
    const best = top[0];
    if (!best || best.confidence < MIN_CONF) {
      setUnclear(true);
      return;
    }
    setUnclear(false);
    cb.current(best);
    setCooling(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCooling(false), COOLDOWN_MS);
  }, features);

  useEffect(() => setPaused(!!locked || cooling), [locked, cooling, setPaused]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const phase = status === "loading" ? "loading" : status === "watching" && !locked ? "recording" : "ready";
  const msg = cameraError
    ? ""
    : status === "loading"
      ? "Đang mở camera…"
      : modelFailed
        ? "Chưa tải được bộ chấm nên chưa chấm điểm. Khung xương tay vẫn hoạt động."
        : !modelReady
        ? "Đang tải bộ chấm…"
        : locked
          ? ""
          : status === "thinking"
            ? "Đang chấm…"
            : status === "watching"
              ? "Đang xem bạn ký. Ký xong thì giữ yên tay hoặc hạ tay xuống."
              : unclear
                ? "Chưa nhìn rõ động tác. Ký lại chậm hơn một chút nhé."
                : "Cứ ký theo mẫu, app tự chấm. Không cần bấm nút.";

  return (
    <>
      <CameraStage videoRef={videoRef} canvasRef={canvasRef} phase={phase} count={0} handsVisible={handsVisible} hint={features === "face" && !faceSeen && status !== "loading" ? "noface" : hint} error={!!cameraError} corner={corner} />
      {cameraError && <CameraError note={errorNote} />}
      {msg && (
        <p className="row" role="status" aria-live="polite" style={{ margin: 0, gap: 8, justifyContent: "center", textAlign: "center", fontWeight: 700, color: "var(--ink)" }}>
          <Sparkles size={18} aria-hidden style={{ flex: "none" }} />
          {msg}
        </p>
      )}
    </>
  );
}

function ManualCapture({ modelUrl, labelsUrl, features = "hands", onResult, locked, attempted, errorNote, manualLabel, corner }: Props) {
  const { videoRef, canvasRef, phase, count, handsVisible, hint, faceSeen, modelReady, cameraError, wavingDetected, start } = useSignPractice(modelUrl, labelsUrl, features);
  const [noHands, setNoHands] = useState(false);
  const busy = phase === "loading" || phase === "countdown" || phase === "recording";

  const go = async () => {
    setNoHands(false);
    const r = await start();
    if (!r) setNoHands(true);
    onResult(r);
  };

  // Kích hoạt rảnh tay (Hands-free Gesture): Giơ bàn tay xòe vẫy chào trước camera thì tự bắt đầu đếm nhịp
  useEffect(() => {
    if (wavingDetected && phase === "ready" && !busy && !locked) {
      void go();
    }
  }, [wavingDetected, phase, busy, locked]);

  return (
    <>
      <CameraStage videoRef={videoRef} canvasRef={canvasRef} phase={phase} count={count} handsVisible={handsVisible} hint={features === "face" && !faceSeen && phase !== "loading" ? "noface" : hint} error={!!cameraError} corner={corner} />
      {cameraError && <CameraError note={errorNote} />}
      {!modelReady && !cameraError && phase !== "loading" && (
        <div className="tile t-yel" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Info size={22} color="var(--yel-txt)" aria-hidden />
          <span className="bm" style={{ color: "var(--txt)" }}>
            Chưa tải được bộ chấm nên chưa chấm điểm. Khung xương tay vẫn hoạt động.
          </span>
        </div>
      )}
      {noHands && modelReady && !busy && (
        <section className="tile t-org" role="status" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Info size={22} color="var(--org-txt)" aria-hidden />
          <span className="bm" style={{ color: "var(--txt)" }}>
            Không thấy tay trong lúc ghi. Đưa tay vào khung rồi thử lại.
          </span>
        </section>
      )}
      {!locked && (
        <Btn icon={attempted ? RotateCcw : Camera} onClick={go} disabled={busy || !!cameraError}>
          {cameraError ? "Chưa mở được camera" : phase === "loading" ? "Đang mở camera…" : phase === "countdown" ? `Chuẩn bị… ${count}` : phase === "recording" ? "Đang ghi…" : attempted ? "Thử lại" : manualLabel ?? "Bắt đầu ký"}
        </Btn>
      )}
    </>
  );
}
