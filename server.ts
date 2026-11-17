import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
  Type,
  FunctionDeclaration,
} from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY en el servidor. Configura tu clave en Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getErrorStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    const n = Number((err as { status?: unknown }).status);
    if (!Number.isNaN(n)) return n;
  }
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/\b503\b|UNAVAILABLE/i.test(msg)) return 503;
  if (/\b429\b|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  if (/\b404\b|NOT_FOUND/i.test(msg)) return 404;
  return undefined;
}

function isModelNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    getErrorStatus(err) === 404 ||
    /404|NOT_FOUND|not found|not supported for generateContent/i.test(msg)
  );
}

function isTransientAiError(err: unknown): boolean {
  const status = getErrorStatus(err);
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    /503|UNAVAILABLE|high demand|overloaded|try again later|temporarily|TIMEOUT/i.test(msg)
  );
}

function formatFriendlyAiError(err: unknown, fallback: string): { status: number; message: string } {
  const status = getErrorStatus(err);
  if (status === 503 || isTransientAiError(err)) {
    return {
      status: 503,
      message:
        "El servidor de voz tiene mucha demanda en este momento. Espera unos segundos e intenta otra vez, o escribe tu respuesta abajo.",
    };
  }
  const raw = err instanceof Error ? err.message : fallback;
  return { status: status && status >= 400 ? status : 500, message: raw };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} superó ${ms}ms`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

let skipPrimaryTranscribeUntil = 0;
let skipHydrogenUntil = 0;

const flagCheatingMomentDecl: FunctionDeclaration = {
  name: "flagCheatingMoment",
  description:
    "Llama a esta herramienta cuando detectes de forma divertida que hay otra voz soplándole respuestas al niño/a o que está mirando/leyendo hacia otro lado fuera de la cámara para hacer trampa.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      cheatType: {
        type: Type.STRING,
        description:
          "Tipo de trampa detectada: 'VOICE_WHISPER' si se escucha otra voz soplando, 'LOOKING_AWAY' si mira hacia un lado/abajo leyendo notas.",
      },
      funnyMessage: {
        type: Type.STRING,
        description:
          "Mensaje corto, chistoso, cariñoso y positivo en español para animar al niño a responder solito sin ayuda.",
      },
    },
    required: ["cheatType", "funnyMessage"],
  },
};

const reportInterviewResultDecl: FunctionDeclaration = {
  name: "reportInterviewResult",
  description:
    "Llama a esta herramienta al finalizar la entrevista (después de 2 preguntas financieras) para entregar el veredicto final, las monedas ganadas o invitar al niño a repetir el reto.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      passed: {
        type: Type.BOOLEAN,
        description:
          "true si el niño respondió con sinceridad y comprendió los conceptos financieros; false si no logró responder correctamente o insistió en hacer trampa.",
      },
      bonusCoins: {
        type: Type.INTEGER,
        description:
          "Cantidad de monedas de premio (300 si passed es true, 0 si passed es false).",
      },
      title: {
        type: Type.STRING,
        description:
          "Título corto de celebración o ánimo en español (ej. '¡Gran Tesorero!' o '¡Casi lo logras!').",
      },
      feedback: {
        type: Type.STRING,
        description:
          "Resumen amable y motivador de 1 a 2 frases en español para el niño.",
      },
    },
    required: ["passed", "bonusCoins", "title", "feedback"],
  },
};

async function startServer() {
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=*, microphone=*");
    next();
  });
  app.use(express.json({ limit: "15mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Audio transcription endpoint (uses fast per-model timeouts + low-latency fallback chain)
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body as {
        audioBase64?: string;
        mimeType?: string;
      };

      if (!audioBase64 || !mimeType) {
        res.status(400).json({
          error: "Se requiere audioBase64 y mimeType para transcribir el audio.",
        });
        return;
      }

      const aiBeta = getAiClient("v1beta");
      const audioContents = {
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: "Transcribe exactamente lo que dice la persona en este audio en español. Si hay silencio o ruido sin palabras, responde exactamente: SILENCIO. Si hay palabras, devuelve solo la transcripción limpia, sin comillas ni explicaciones.",
          },
        ],
      };

      const usePrimaryTranscribe = Date.now() >= skipPrimaryTranscribeUntil;
      const useHydrogen = Date.now() >= skipHydrogenUntil;
      const attempts: Array<{
        model: string;
        timeoutMs: number;
        thinkingLevel?: ThinkingLevel;
      }> = [
        ...(usePrimaryTranscribe
          ? [{ model: "gemini-3.5-transcribe", timeoutMs: 3500 }]
          : []),
        {
          model: "gemini-3.1-flash-lite",
          timeoutMs: 6000,
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
        ...(useHydrogen
          ? [
              {
                model: "gemini-4-hydrogen",
                timeoutMs: 5000,
                thinkingLevel: ThinkingLevel.LOW,
              },
            ]
          : []),
      ];

      let transcript = "";
      let lastErr: unknown = null;

      for (const item of attempts) {
        const started = Date.now();
        try {
          const response = await withTimeout(
            aiBeta.models.generateContent({
              model: item.model,
              contents: audioContents,
              ...(item.thinkingLevel
                ? { config: { thinkingConfig: { thinkingLevel: item.thinkingLevel } } }
                : {}),
            }),
            item.timeoutMs,
            item.model
          );
          const raw = (response.text ?? "").trim();
          const detectedSilence =
            /^(\[?SILENCIO\]?\.?|\[?inaudible\]?|\d{1,2}:\d{2}(:\d{2})?)$/i.test(
              raw
            );
          transcript = detectedSilence ? "" : raw;
          console.log(
            `[transcribe] ${item.model} responded in ${Date.now() - started}ms (len=${transcript.length}, silence=${detectedSilence})`
          );
          if (transcript.length > 0 || (detectedSilence && item.model !== "gemini-3.5-transcribe")) {
            lastErr = null;
            break;
          }
          // Primary returned empty; short-circuit to fast multimodal fallback
          lastErr = null;
        } catch (err) {
          console.warn(
            `[transcribe] ${item.model} failed in ${Date.now() - started}ms:`,
            err instanceof Error ? err.message : err
          );
          lastErr = err;
          if (item.model === "gemini-3.5-transcribe") {
            skipPrimaryTranscribeUntil = Date.now() + 90_000;
          } else if (item.model === "gemini-4-hydrogen") {
            skipHydrogenUntil = Date.now() + 90_000;
          }
          if (isModelNotFoundError(err) || isTransientAiError(err)) {
            continue;
          }
          throw err;
        }
      }

      if (!transcript && lastErr) {
        throw lastErr;
      }

      res.json({ transcript });
    } catch (err) {
      console.error("Transcribe error:", err);
      const formatted = formatFriendlyAiError(
        err,
        "Error al transcribir el audio."
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Spoken quiz answer evaluation (low-latency ThinkingLevel.LOW on gemini-4-hydrogen + flash-lite fallback)
  app.post("/api/evaluate-spoken-answer", async (req, res) => {
    try {
      const { transcript, question, expectedConcept, levelTitle } = req.body as {
        transcript?: string;
        question?: string;
        expectedConcept?: string;
        levelTitle?: string;
      };

      if (!transcript || !question) {
        res.status(400).json({
          error: "Falta la transcripción o la pregunta para evaluar.",
        });
        return;
      }

      const ai = getAiClient("v1beta");
      const evalPrompt = `Nivel: ${levelTitle ?? "Misión Ahorro"}
Pregunta para niño de 8 a 10 años: ${question}
Concepto financiero esperado: ${expectedConcept ?? ""}
Respuesta hablada o escrita del niño: "${transcript}"

Evalúa si el niño comprendió la idea principal con sus propias palabras (sé justo y alentador para su edad de 8 a 10 años).`;

      const evalAttempts: Array<{
        model: string;
        timeoutMs: number;
        thinkingLevel: ThinkingLevel;
      }> = [
        ...(Date.now() >= skipHydrogenUntil
          ? [
              {
                model: "gemini-4-hydrogen",
                timeoutMs: 5000,
                thinkingLevel: ThinkingLevel.LOW,
              },
            ]
          : []),
        {
          model: "gemini-3.1-flash-lite",
          timeoutMs: 6000,
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      ];

      let responseText: string | undefined;
      let lastErr: unknown = null;

      for (const item of evalAttempts) {
        const started = Date.now();
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: item.model,
              contents: evalPrompt,
              config: {
                thinkingConfig: { thinkingLevel: item.thinkingLevel },
                systemInstruction:
                  "Eres Tito Alcancía, un cerdito explorador súper amigable que enseña educación financiera a niños de 8 a 10 años en español. Responde en JSON.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    correct: {
                      type: Type.BOOLEAN,
                      description:
                        "true si la respuesta muestra comprensión del concepto financiero.",
                    },
                    encouragement: {
                      type: Type.STRING,
                      description:
                        "Frase alegre y positiva en español celebrando su respuesta o animándole a intentar de nuevo.",
                    },
                    coachTip: {
                      type: Type.STRING,
                      description:
                        "Consejo financiero breve de 1 frase fácil de recordar para un niño de 8 a 10 años.",
                    },
                  },
                  required: ["correct", "encouragement", "coachTip"],
                },
              },
            }),
            item.timeoutMs,
            item.model
          );
          console.log(
            `[evaluate] ${item.model} responded in ${Date.now() - started}ms`
          );
          responseText = response.text;
          lastErr = null;
          break;
        } catch (err) {
          console.warn(
            `[evaluate] ${item.model} failed in ${Date.now() - started}ms:`,
            err instanceof Error ? err.message : err
          );
          lastErr = err;
          if (item.model === "gemini-4-hydrogen") {
            skipHydrogenUntil = Date.now() + 90_000;
          }
          if (isTransientAiError(err) || isModelNotFoundError(err)) {
            continue;
          }
          throw err;
        }
      }

      if (!responseText && lastErr) {
        throw lastErr;
      }

      const jsonText = (responseText ?? "{}").trim();
      const parsed = JSON.parse(jsonText);
      res.json(parsed);
    } catch (err) {
      console.error("Evaluate spoken answer error:", err);
      const formatted = formatFriendlyAiError(
        err,
        "Error al evaluar la respuesta hablada."
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*splat", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`
    );
    if (reqUrl.pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs: WebSocket, request: http.IncomingMessage) => {
    const reqUrl = new URL(
      request.url ?? "/live",
      `http://${request.headers.host ?? "localhost"}`
    );
    const levelTitle = reqUrl.searchParams.get("levelTitle") ?? "El Sendero del Ahorro";
    const levelTopic = reqUrl.searchParams.get("levelTopic") ?? "Ahorro y Necesidades vs Deseos";
    const achievements = reqUrl.searchParams.get("achievements") ?? "Ninguno todavía";
    const coins = reqUrl.searchParams.get("coins") ?? "0";

    let session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
    let isClosed = false;

    const sendToClient = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const ai = getAiClient("v1beta");

      const systemInstruction = `Eres "Don Búho Tesorero", el Jefe Mayor animado, chistoso, sabio y súper positivo de la Bóveda Dorada en un juego educativo financiero para niños de 8 a 10 años.
Hablas SIEMPRE en español neutro amigable, con humor blanco, energía teatral y mucho cariño.

CONTEXTO DEL JUGADOR:
- Nivel completado en la ruta: ${levelTitle}
- Tema aprendido: ${levelTopic}
- Logros ganados en el reto: ${achievements}
- Monedas recolectadas en el camino: ${coins}

TU MISIÓN EN ESTA ENTREVISTA EN VIVO (CÁMARA Y MICRÓFONO ENCENDIDOS):
1. Saluda al campeón o campeona con entusiasmo, menciona específicamente alguno de sus logros ganados (${achievements}) y dile que si responde bien 2 preguntas cortitas sobre "${levelTopic}" ¡ganará el GRAN COFRE DE 300 MONEDAS!
2. Haz UNA pregunta corta a la vez, adaptada a niños de 8-10 años, espera su respuesta hablada y reacciona con alegría.
3. VIGILANCIA DIVERTIDA ANTI-TRAMPAS (MIRA EL VIDEO Y ESCUCHA EL AUDIO):
   - Si escuchas OTRA VOZ distinta susurrando o soplando la respuesta ("otra voz que le sopla"), llama INMEDIATAMENTE a la función flagCheatingMoment(cheatType="VOICE_WHISPER", funnyMessage=...) y dile algo gracioso y positivo como: "¡Ajajá! ¡Mis súper orejas de búho escucharon a un pajarito secreto soplándote la respuesta! Dile al pajarito que descanse, ¡que quiero escuchar TU propio súper cerebro!" y dale otra oportunidad para responder solito.
   - Si ves en los cuadros de la cámara que el niño está mirando repetidamente hacia un lado, leyendo notas fuera de cámara o recibiendo señas de alguien al lado ("leyendo otro lado para hacer trampas"), llama INMEDIATAMENTE a la función flagCheatingMoment(cheatType="LOOKING_AWAY", funnyMessage=...) y dile con humor positivo: "¡Ojo de búho activado! Vi tus ojitos buscando un mapa secreto a un ladito. ¡Mira a la cámara, campeón, que tú ya te lo sabes!" y pídele que responda mirando al frente.
   - Nunca regañes feo: siempre sé chistoso, cálido y motivador.
4. VEREDICTO FINAL:
   - Cuando el niño haya respondido 2 preguntas correctamente sin trampa (o tras corregir una travesura y responder solito), felicítalo muchísimo y llama a reportInterviewResult(passed=true, bonusCoins=300, title="¡Súper Guardián del Tesoro!", feedback=...).
   - Si después de varios intentos no comprende el tema o sigue sin responder por sí mismo, anímalo con mucho cariño a repetir la ruta de obstáculos para practicar un poquito más, y llama a reportInterviewResult(passed=false, bonusCoins=0, title="¡A practicar en la ruta!", feedback=...).
   - Mantén cada intervención hablada breve (2-3 oraciones) para que la charla sea ágil y divertida.`;

      let sessionReady = false;
      const sessionPromise = ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
          },
          tools: [
            {
              functionDeclarations: [
                flagCheatingMomentDecl,
                reportInterviewResultDecl,
              ],
            },
          ],
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            sessionReady = true;
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              sendToClient({
                type: "input_transcript",
                text: content.inputTranscription.text,
              });
            }

            if (content?.outputTranscription?.text) {
              sendToClient({
                type: "output_transcript",
                text: content.outputTranscription.text,
              });
            }

            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendToClient({
                  type: "audio",
                  data: part.inlineData.data,
                });
              }
            }

            if (content?.interrupted) {
              sendToClient({ type: "interrupted" });
            }

            if (content?.turnComplete) {
              sendToClient({ type: "turn_complete" });
            }

            for (const call of message.toolCall?.functionCalls ?? []) {
              const args = (call.args ?? {}) as Record<string, unknown>;
              if (call.name === "flagCheatingMoment") {
                sendToClient({
                  type: "cheat_alert",
                  cheatType: String(args.cheatType ?? "LOOKING_AWAY"),
                  funnyMessage: String(
                    args.funnyMessage ??
                      "¡Ojo de búho activado! ¡Responde solito mirando a la cámara!"
                  ),
                });
                sessionPromise
                  .then((activeSession) =>
                    activeSession.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            acknowledged: true,
                            instruction:
                              "Ya mostraste la alerta graciosa. Ahora anímalo con humor positivo a responder solito.",
                          },
                        },
                      ],
                    })
                  )
                  .catch(() => {});
              } else if (call.name === "reportInterviewResult") {
                sendToClient({
                  type: "interview_result",
                  passed: Boolean(args.passed),
                  bonusCoins: Number(args.bonusCoins ?? (args.passed ? 300 : 0)),
                  title: String(args.title ?? "Resultado de la entrevista"),
                  feedback: String(args.feedback ?? ""),
                });
                sessionPromise
                  .then((activeSession) =>
                    activeSession.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: { recorded: true },
                        },
                      ],
                    })
                  )
                  .catch(() => {});
              }
            }
          },
          onerror: (err: unknown) => {
            console.error("Gemini Live error:", err);
            const formatted = formatFriendlyAiError(
              err,
              "Error de conexión con Don Búho en vivo."
            );
            sendToClient({
              type: "error",
              message: formatted.message,
            });
          },
          onclose: () => {
            if (!isClosed) {
              sendToClient({ type: "closed" });
            }
          },
        },
      });

      session = await sessionPromise;
      if (!isClosed && sessionReady) {
        sendToClient({ type: "ready" });
      } else if (!isClosed) {
        sendToClient({ type: "ready" });
      }
    } catch (err) {
      console.error("Live connect error:", err);
      const formatted = formatFriendlyAiError(
        err,
        "No se pudo iniciar la entrevista en vivo con Don Búho."
      );
      sendToClient({ type: "error", message: formatted.message });
      clientWs.close();
      return;
    }

    clientWs.on("message", (raw) => {
      if (!session || isClosed) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          data?: string;
          text?: string;
        };
        if (msg.type === "audio" && msg.data) {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.type === "video" && msg.data) {
          session.sendRealtimeInput({
            video: { data: msg.data, mimeType: "image/jpeg" },
          });
        } else if (msg.type === "text" && msg.text) {
          session.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: msg.text }],
              },
            ],
            turnComplete: true,
          });
        }
      } catch (err) {
        console.error("Client WS message parse error:", err);
      }
    });

    clientWs.on("close", () => {
      isClosed = true;
      try {
        session?.close();
      } catch {
        // ignore close errors
      }
      session = null;
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Misión Ahorro server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
