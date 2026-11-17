import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  ExternalLink,
  Mic,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Trophy,
  Video,
  X,
} from "lucide-react";
import { FinancialLevel } from "../data/levels";
import { AnimatedCharacter, CharacterMood } from "./AnimatedCharacter";
import { soundFx } from "../audio/soundFx";

interface BossInterviewModalProps {
  level: FinancialLevel;
  earnedAchievements: string[];
  routeCoins: number;
  onInterviewPassed: (bonusCoins: number, feedback: string) => void;
  onInterviewFailedRetry: (feedback: string) => void;
  onClose: () => void;
}

interface InterviewResultState {
  passed: boolean;
  bonusCoins: number;
  title: string;
  feedback: string;
}

function pcmToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

export const BossInterviewModal: React.FC<BossInterviewModalProps> = ({
  level,
  earnedAchievements,
  routeCoins,
  onInterviewPassed,
  onInterviewFailedRetry,
  onClose,
}) => {
  const [status, setStatus] = useState<
    "intro" | "connecting" | "live" | "finished" | "error"
  >("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bossMood, setBossMood] = useState<CharacterMood>("idle");
  const [bossCaption, setBossCaption] = useState(
    "¡Hola, campeón! Prende tu cámara y tu micrófono para nuestra entrevista mágica. ¡Si respondes solito sin hacer trampa, te llevas 300 monedas!"
  );
  const [childCaption, setChildCaption] = useState("");
  const [cheatAlert, setCheatAlert] = useState<{
    type: string;
    message: string;
  } | null>(null);
  const [result, setResult] = useState<InterviewResultState | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [typedReply, setTypedReply] = useState("");
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const mountedRef = useRef(true);

  const cleanupMediaAndSocket = () => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
    } catch {
      // ignore
    }
    processorRef.current = null;

    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    inputAudioCtxRef.current?.close().catch(() => {});
    inputAudioCtxRef.current = null;

    outputAudioCtxRef.current?.close().catch(() => {});
    outputAudioCtxRef.current = null;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupMediaAndSocket();
    };
  }, []);

  const playPcmChunk = (base64Audio: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const samples = base64ToFloat32(base64Audio);
    const buffer = ctx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0 && mountedRef.current) {
        setBossMood((m) => (m === "alert" ? "alert" : "idle"));
      }
    };
  };

  const stopQueuedAudio = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  };

  const startLiveInterview = async (forceTextFallback = false) => {
    setErrorMsg(null);
    setPermissionNotice(null);
    setResult(null);
    setCheatAlert(null);
    setStatus("connecting");

    try {
      let stream: MediaStream | null = null;
      let camActive = false;
      let micActive = false;

      if (!forceTextFallback && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          camActive = stream.getVideoTracks().length > 0;
          micActive = stream.getAudioTracks().length > 0;
        } catch {
          // Try audio-only or video-only if combined request was rejected
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            micActive = stream.getAudioTracks().length > 0;
            setPermissionNotice(
              "No pudimos abrir la cámara, pero tu micrófono sí está activo."
            );
          } catch (micErr) {
            const msg = micErr instanceof Error ? micErr.message : "Permission denied";
            setPermissionNotice(
              `El navegador o marco de vista previa bloqueó el micrófono/cámara (${msg}). Puedes responder escribiendo mientras escuchas la voz de Don Búho, o abrir el juego en una pestaña nueva para activar la cámara.`
            );
          }
        }
      }

      streamRef.current = stream;
      setHasCamera(camActive);
      setHasMic(micActive);

      if (videoRef.current && stream && camActive) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const inputCtx = micActive ? new AudioContext({ sampleRate: 16000 }) : null;
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtx?.resume().catch(() => {});
      outputCtx.resume().catch(() => {});
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const params = new URLSearchParams({
        levelTitle: level.title,
        levelTopic: level.topic,
        achievements:
          earnedAchievements.length > 0
            ? earnedAchievements.join(", ")
            : "Explorador Valiente",
        coins: String(routeCoins),
      });
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/live?${params}`);
      wsRef.current = ws;

      let bossTurnBuffer = "";
      let childTurnBuffer = "";

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        const msg = JSON.parse(event.data) as {
          type: string;
          data?: string;
          text?: string;
          cheatType?: string;
          funnyMessage?: string;
          passed?: boolean;
          bonusCoins?: number;
          title?: string;
          feedback?: string;
          message?: string;
        };

        if (msg.type === "ready") {
          setStatus("live");
          setBossMood("talking");

          // Start 16kHz mic streaming if mic permission granted
          if (stream && micActive && inputCtx) {
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(2048, 1, 1);
            processorRef.current = processor;
            source.connect(processor);
            processor.connect(inputCtx.destination);

            processor.onaudioprocess = (ev) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const channel = ev.inputBuffer.getChannelData(0);
              const b64 = pcmToBase64(channel);
              ws.send(JSON.stringify({ type: "audio", data: b64 }));
            };
          }

          // Start 1 FPS JPEG webcam streaming if camera granted
          if (stream && camActive) {
            const offscreen =
              captureCanvasRef.current ?? document.createElement("canvas");
            captureCanvasRef.current = offscreen;
            offscreen.width = 320;
            offscreen.height = 240;
            const ctx2d = offscreen.getContext("2d");

            videoIntervalRef.current = window.setInterval(() => {
              if (
                ws.readyState !== WebSocket.OPEN ||
                !videoRef.current ||
                !ctx2d ||
                videoRef.current.readyState < 2
              ) {
                return;
              }
              ctx2d.drawImage(videoRef.current, 0, 0, 320, 240);
              const dataUrl = offscreen.toDataURL("image/jpeg", 0.72);
              const base64Jpeg = dataUrl.split(",")[1];
              if (base64Jpeg) {
                ws.send(JSON.stringify({ type: "video", data: base64Jpeg }));
              }
            }, 1200);
          }

          // Nudge Don Búho to begin his greeting right away
          ws.send(
            JSON.stringify({
              type: "text",
              text: camActive
                ? "¡Hola Don Búho! Ya encendí mi cámara y mi micrófono para empezar la entrevista."
                : "¡Hola Don Búho! Ya estoy listo para empezar la entrevista.",
            })
          );
        } else if (msg.type === "audio" && msg.data) {
          setBossMood((m) => (m === "alert" ? "alert" : "talking"));
          playPcmChunk(msg.data);
        } else if (msg.type === "output_transcript" && msg.text) {
          bossTurnBuffer += msg.text;
          setBossCaption(bossTurnBuffer.trim());
        } else if (msg.type === "input_transcript" && msg.text) {
          childTurnBuffer += msg.text;
          setChildCaption(childTurnBuffer.trim());
        } else if (msg.type === "turn_complete") {
          bossTurnBuffer = "";
          childTurnBuffer = "";
        } else if (msg.type === "interrupted") {
          stopQueuedAudio();
          bossTurnBuffer = "";
        } else if (msg.type === "cheat_alert") {
          soundFx.playCheatAlert();
          setBossMood("alert");
          setCheatAlert({
            type: msg.cheatType ?? "LOOKING_AWAY",
            message:
              msg.funnyMessage ??
              "¡Ojo de búho activado! ¡Mira a la cámara y responde tú solito!",
          });
          window.setTimeout(() => {
            if (mountedRef.current) {
              setCheatAlert(null);
              setBossMood("idle");
            }
          }, 5500);
        } else if (msg.type === "interview_result") {
          const passed = Boolean(msg.passed);
          const finalResult: InterviewResultState = {
            passed,
            bonusCoins: Number(msg.bonusCoins ?? (passed ? 300 : 0)),
            title: msg.title ?? (passed ? "¡Entrevista Superada!" : "¡A practicar de nuevo!"),
            feedback: msg.feedback ?? "",
          };
          setResult(finalResult);
          setBossMood(passed ? "happy" : "idle");
          setStatus("finished");
          if (passed) {
            soundFx.playFanfare();
          } else {
            soundFx.playQuizWrong();
          }
          // Keep audio playing briefly so Don Búho finishes his sentence, then stop mic/cam stream
          if (videoIntervalRef.current) {
            window.clearInterval(videoIntervalRef.current);
            videoIntervalRef.current = null;
          }
          streamRef.current?.getTracks().forEach((t) => t.stop());
        } else if (msg.type === "error") {
          setErrorMsg(
            msg.message ?? "No pudimos conectar con Don Búho en este momento."
          );
          setStatus("error");
          cleanupMediaAndSocket();
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setErrorMsg("Error de conexión en vivo con el servidor.");
        setStatus("error");
        cleanupMediaAndSocket();
      };
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Necesitamos tu cámara y micrófono para la entrevista: ${err.message}`
          : "Permite el acceso a la cámara y micrófono para hablar con Don Búho."
      );
      setStatus("error");
      cleanupMediaAndSocket();
    }
  };

  const sendTextReply = () => {
    const clean = typedReply.trim();
    if (!clean || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setChildCaption(clean);
    wsRef.current.send(JSON.stringify({ type: "text", text: clean }));
    setTypedReply("");
  };

  const handleFinishAction = () => {
    cleanupMediaAndSocket();
    if (result?.passed) {
      onInterviewPassed(result.bonusCoins, result.feedback);
    } else {
      onInterviewFailedRetry(result?.feedback ?? "Vamos a repetir el reto para volver más fuertes.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boss-interview-title"
    >
      <div className="w-full max-w-4xl max-h-[94dvh] overflow-y-auto rounded-3xl bg-[#FFFDF7] border-2 border-amber-400 shadow-2xl p-5 sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-amber-200">
          <div>
            <p className="text-xs font-bold text-amber-700">
              Gran Entrevista Final · Nivel {level.id}: {level.title}
            </p>
            <h2
              id="boss-interview-title"
              className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-0.5"
            >
              Entrevista con Don Búho Tesorero
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              cleanupMediaAndSocket();
              onClose();
            }}
            aria-label="Cerrar entrevista"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-column stage: Don Búho (Left) & Child Camera + Transcript (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          {/* Left Column: Animated Boss Owl + Speech & Cheat Alert */}
          <div className="rounded-3xl bg-amber-50/70 border border-amber-200 p-5 flex flex-col items-center justify-between gap-4">
            <div className="w-full flex items-center justify-between text-xs font-bold text-amber-900">
              <span>Jefe Mayor · Bóveda Dorada</span>
              <span className="font-mono-num">Premio: +{level.bossJackpotCoins} monedas</span>
            </div>

            <AnimatedCharacter
              character="buho"
              mood={bossMood}
              size="lg"
            />

            {cheatAlert && (
              <div className="w-full rounded-2xl bg-orange-100 border-2 border-orange-400 p-3.5 text-orange-950 flex items-start gap-2.5 shadow-sm">
                <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-extrabold text-orange-800">
                    {cheatAlert.type === "VOICE_WHISPER"
                      ? "¡Súper Orejas de Búho! (Voz detectada)"
                      : "¡Ojo de Búho Activado! (Mirada detectada)"}
                  </p>
                  <p className="text-sm font-bold leading-snug mt-0.5">
                    {cheatAlert.message}
                  </p>
                </div>
              </div>
            )}

            <div className="w-full rounded-2xl bg-white border border-amber-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-400 mb-1">
                Don Búho dice:
              </p>
              <p className="text-sm sm:text-base font-semibold text-slate-800 leading-snug">
                {bossCaption}
              </p>
            </div>
          </div>

          {/* Right Column: Live Camera Feed, Earned Logros & Controls */}
          <div className="flex flex-col gap-4">
            {/* Webcam frame */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900 aspect-[4/3] border-2 border-slate-300 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full h-full object-cover scale-x-[-1] ${
                  status === "live" || status === "connecting"
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              />

              {status === "intro" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-3">
                    <Video className="w-7 h-7 text-amber-300" />
                  </div>
                  <p className="font-display font-bold text-lg">
                    Prende tu Cámara y Micrófono
                  </p>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xs">
                    Don Búho te verá y escuchará en vivo. ¡Recuerda mirar a la cámara y responder sin que nadie te sople!
                  </p>
                </div>
              )}

              {status === "connecting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 text-white p-4">
                  <p className="font-display font-bold text-base">
                    Conectando con la Bóveda Dorada...
                  </p>
                </div>
              )}

              {status === "live" && hasCamera && (
                <div className="absolute top-3 left-3 rounded-xl bg-slate-950/75 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Cámara y Voz Activas</span>
                </div>
              )}

              {status === "live" && !hasCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center text-white bg-slate-900">
                  <Mic className="w-8 h-8 text-amber-300 mb-2" />
                  <p className="font-display font-bold text-base">
                    {hasMic ? "Modo Voz Activo (Sin Cámara)" : "Modo Texto con Voz de Don Búho"}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 max-w-xs">
                    {hasMic
                      ? "Don Búho te escucha por micrófono."
                      : "Escribe tus respuestas abajo y escucha a Don Búho hablar en vivo."}
                  </p>
                </div>
              )}
            </div>

            {permissionNotice && (
              <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 space-y-1.5">
                <p className="font-bold">{permissionNotice}</p>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-amber-900 hover:bg-amber-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en pestaña nueva para permitir cámara y micrófono</span>
                </a>
              </div>
            )}

            {/* Child spoken transcript preview */}
            {childCaption && (
              <div className="rounded-2xl bg-teal-50 border border-teal-200 px-4 py-2.5">
                <p className="text-xs font-bold text-teal-800">Tu respuesta enviada a Don Búho:</p>
                <p className="text-sm font-medium text-teal-950 mt-0.5">“{childCaption}”</p>
              </div>
            )}

            {/* Earned achievements summary */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-500 mb-2">
                Tus Logros para mostrarle al Jefe Mayor:
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm font-bold text-teal-800">
                {earnedAchievements.length > 0 ? (
                  earnedAchievements.map((ach, i) => (
                    <span key={ach} className="inline-flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {ach}
                      {i < earnedAchievements.length - 1 && (
                        <span className="text-slate-300 ml-2">·</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span>Explorador en Camino</span>
                )}
              </div>
            </div>

            {/* Action / Result controls */}
            {status === "intro" && (
              <button
                type="button"
                onClick={() => startLiveInterview(false)}
                className="min-h-[54px] w-full rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2.5 shadow-md cursor-pointer"
              >
                <Mic className="w-5 h-5" />
                <span>¡Iniciar Entrevista con Cámara!</span>
              </button>
            )}

            {status === "live" && (
              <div className="space-y-2.5">
                {!hasMic && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={typedReply}
                      onChange={(e) => setTypedReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendTextReply();
                      }}
                      placeholder="Escribe tu respuesta para Don Búho..."
                      className="flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={sendTextReply}
                      className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span>Enviar</span>
                    </button>
                  </div>
                )}

                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-emerald-900">
                    {hasMic
                      ? "Habla claro mirando a la cámara. Don Búho decidirá cuando termines tus respuestas."
                      : "Escucha a Don Búho y responde arriba para recibir tu veredicto."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                          JSON.stringify({
                            type: "text",
                            text: "Don Búho, por favor dame mi veredicto final de la entrevista con reportInterviewResult.",
                          })
                        );
                      }
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Pedir Veredicto
                  </button>
                </div>
              </div>
            )}

            {status === "error" && errorMsg && (
              <div className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-4 text-rose-900">
                <p className="text-sm font-bold">{errorMsg}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startLiveInterview(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Intentar de Nuevo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      cleanupMediaAndSocket();
                      onClose();
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-800 font-bold text-xs cursor-pointer"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}

            {status === "finished" && result && (
              <div
                className={`rounded-2xl border-2 p-5 ${
                  result.passed
                    ? "bg-emerald-50 border-emerald-400 text-emerald-950"
                    : "bg-amber-50 border-amber-400 text-amber-950"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  {result.passed ? (
                    <Trophy className="w-6 h-6 text-amber-600 shrink-0" />
                  ) : (
                    <RotateCcw className="w-6 h-6 text-amber-700 shrink-0" />
                  )}
                  <h3 className="text-lg font-display font-extrabold">
                    {result.title}
                  </h3>
                </div>
                <p className="text-sm font-medium leading-snug mb-4">
                  {result.feedback}
                </p>

                {result.passed ? (
                  <button
                    type="button"
                    onClick={handleFinishAction}
                    className="min-h-[50px] w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>¡Reclamar +{result.bonusCoins} Monedas y Avanzar!</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishAction}
                    className="min-h-[50px] w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>Repetir el Reto para Volver a Entrevistarme</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
