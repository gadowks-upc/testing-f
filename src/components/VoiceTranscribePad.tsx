import React, { useRef, useState, useEffect } from "react";
import { Mic, Square, Loader2, Upload, ExternalLink } from "lucide-react";

interface VoiceTranscribePadProps {
  onTranscriptReady: (transcript: string) => void;
  disabled?: boolean;
  label?: string;
}

export const VoiceTranscribePad: React.FC<VoiceTranscribePadProps> = ({
  onTranscriptReady,
  disabled = false,
  label = "Responder hablando con el micrófono",
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const peakHeardRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopMeter = () => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      meterCtxRef.current.close().catch(() => {});
      meterCtxRef.current = null;
    }
    setMicLevel(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      stopMeter();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result ?? "");
        const commaIdx = result.indexOf(",");
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error("No se pudo leer el audio grabado."));
      reader.readAsDataURL(blob);
    });

  const encodeMonoWav16k = (
    audioBuffer: AudioBuffer
  ): { wavBlob: Blob; isSilent: boolean } => {
    const numChannels = audioBuffer.numberOfChannels;
    const srcRate = audioBuffer.sampleRate;
    const srcLen = audioBuffer.length;
    const mono = new Float32Array(srcLen);

    for (let ch = 0; ch < numChannels; ch++) {
      const chData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < srcLen; i++) {
        mono[i] += chData[i] / numChannels;
      }
    }

    let maxAbs = 0;
    for (let i = 0; i < mono.length; i++) {
      const a = Math.abs(mono[i]);
      if (a > maxAbs) maxAbs = a;
    }

    if (maxAbs < 0.002) {
      return { wavBlob: new Blob(), isSilent: true };
    }

    // Gentle auto-gain for soft laptop/tablet microphones
    const gain = maxAbs < 0.45 ? Math.min(5, 0.8 / maxAbs) : 1;
    const targetRate = 16000;
    const targetLen = Math.max(1, Math.round((srcLen * targetRate) / srcRate));
    const ratio = srcLen / targetLen;

    const wavBuffer = new ArrayBuffer(44 + targetLen * 2);
    const view = new DataView(wavBuffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + targetLen * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, targetLen * 2, true);

    let offset = 44;
    for (let i = 0; i < targetLen; i++) {
      const pos = i * ratio;
      const idx0 = Math.min(srcLen - 1, Math.floor(pos));
      const idx1 = Math.min(srcLen - 1, idx0 + 1);
      const frac = pos - idx0;
      const sample = (mono[idx0] * (1 - frac) + mono[idx1] * frac) * gain;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }

    return {
      wavBlob: new Blob([wavBuffer], { type: "audio/wav" }),
      isSilent: false,
    };
  };

  const prepareAudioForUpload = async (
    blob: Blob,
    fallbackMime: string
  ): Promise<{ uploadBlob: Blob; uploadMime: string; isSilent: boolean }> => {
    try {
      const arrayBuf = await blob.arrayBuffer();
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      try {
        const decoded = await Promise.race([
          ctx.decodeAudioData(arrayBuf.slice(0)),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("decode timeout")), 2000)
          ),
        ]);
        const { wavBlob, isSilent } = encodeMonoWav16k(decoded);
        if (isSilent) {
          return { uploadBlob: blob, uploadMime: fallbackMime, isSilent: true };
        }
        return { uploadBlob: wavBlob, uploadMime: "audio/wav", isSilent: false };
      } finally {
        ctx.close().catch(() => {});
      }
    } catch {
      return { uploadBlob: blob, uploadMime: fallbackMime, isSilent: false };
    }
  };

  const transcribeBlob = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    setErrorMsg(null);
    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), 18000);
    try {
      const prepared = await prepareAudioForUpload(blob, mimeType);
      if (prepared.isSilent) {
        setErrorMsg(
          "Tu micrófono no captó sonido (nivel en silencio). Revisa que no esté en silencio y habla cerca del micrófono."
        );
        return;
      }

      const audioBase64 = await blobToBase64(prepared.uploadBlob);
      const resp = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          audioBase64,
          mimeType: prepared.uploadMime,
        }),
      });
      const data = (await resp.json()) as {
        transcript?: string;
        error?: string;
      };
      if (!resp.ok) {
        throw new Error(data.error ?? "No se pudo transcribir tu voz.");
      }
      const clean = (data.transcript ?? "").trim();
      if (!clean) {
        setErrorMsg(
          "No logramos entender palabras en ese audio. Prueba hablar más claro o escribe tu respuesta abajo."
        );
      } else {
        onTranscriptReady(clean);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMsg(
          "La transcripción tardó demasiado porque el servicio está ocupado. Intenta hablar de nuevo en unos segundos."
        );
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : "Error al transcribir el audio."
        );
      }
    } finally {
      window.clearTimeout(abortTimer);
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    setPermissionBlocked(false);
    peakHeardRef.current = 0;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionBlocked(true);
      setErrorMsg(
        "Este navegador o ventana no permite abrir el micrófono directamente."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Live mic level meter
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const meterCtx = new AudioCtx();
        meterCtxRef.current = meterCtx;
        const source = meterCtx.createMediaStreamSource(stream);
        const analyser = meterCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const updateMeter = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs((data[i] - 128) / 128);
            if (v > peak) peak = v;
          }
          if (peak > peakHeardRef.current) peakHeardRef.current = peak;
          setMicLevel(Math.min(100, Math.round(peak * 220)));
          meterRafRef.current = requestAnimationFrame(updateMeter);
        };
        meterRafRef.current = requestAnimationFrame(updateMeter);
      } catch {
        // Ignore if meter context cannot start
      }

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ];
      const supportedType = preferredTypes.find(
        (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
      );

      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      const cleanMime = (
        recorder.mimeType ||
        supportedType ||
        "audio/webm"
      ).split(";")[0];
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopMeter();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: cleanMime });
        if (blob.size < 250) {
          setErrorMsg("El audio fue muy cortito. ¡Intenta hablar un poco más fuerte!");
          return;
        }
        await transcribeBlob(blob, cleanMime);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      stopMeter();
      const errName = err instanceof DOMException ? err.name : "";
      const rawMsg = err instanceof Error ? err.message : "";
      const isDenied =
        errName === "NotAllowedError" ||
        errName === "PermissionDeniedError" ||
        /permission|denied|not allowed/i.test(rawMsg);

      if (isDenied) {
        setPermissionBlocked(true);
        setErrorMsg(
          "El navegador o el marco de vista previa bloqueó el permiso del micrófono (Permission denied)."
        );
      } else {
        setErrorMsg(
          rawMsg
            ? `No pudimos abrir el micrófono: ${rawMsg}`
            : "Permite el acceso al micrófono para responder hablando."
        );
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await transcribeBlob(file, file.type || "audio/mp3");
  };

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-teal-900">{label}</p>
          <p className="text-xs text-teal-700 mt-0.5">
            {recording
              ? `Grabando tu respuesta... ${seconds}s (toca Detener al terminar)`
              : transcribing
                ? "Escuchando y transcribiendo tu respuesta..."
                : "Toca el botón y explica tu respuesta con tus palabras"}
          </p>
          {recording && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-teal-800 whitespace-nowrap">
                Nivel de voz:
              </span>
              <div className="flex-1 h-2 rounded-full bg-teal-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-75 rounded-full"
                  style={{ width: `${Math.max(4, micLevel)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled || transcribing}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
            >
              {transcribing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Transcribiendo</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>Hablar Ahora</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Detener ({seconds}s)</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {errorMsg && (
        <div className="mt-3 text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
          <p className="font-bold">{errorMsg}</p>
          {permissionBlocked && (
            <div className="text-rose-800 space-y-1.5">
              <p>
                <strong>Cómo solucionarlo:</strong> Haz clic en el icono del candado o micrófono arriba en la barra del navegador, cambia <strong>Micrófono</strong> a <strong>Permitir</strong> y recarga la vista previa.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 font-bold text-rose-900 hover:bg-rose-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en pestaña nueva</span>
                </a>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || transcribing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>O subir audio grabado</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
