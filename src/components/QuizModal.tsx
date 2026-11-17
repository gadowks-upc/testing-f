import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { QuizOption, QuizQuestion } from "../data/levels";
import { AnimatedCharacter } from "./AnimatedCharacter";
import { VoiceTranscribePad } from "./VoiceTranscribePad";
import { soundFx } from "../audio/soundFx";

interface QuizModalProps {
  levelTitle: string;
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  onPassed: (achievementTitle: string, bonusCoins: number) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  levelTitle,
  question,
  questionIndex,
  totalQuestions,
  onPassed,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [openAnswer, setOpenAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [evaluatingOpen, setEvaluatingOpen] = useState(false);

  const handleSelectOption = (opt: QuizOption) => {
    if (isCorrect) return;
    setSelectedId(opt.id);
    setFeedback(opt.feedback);
    if (opt.isCorrect) {
      soundFx.playQuizCorrect();
      setIsCorrect(true);
    } else {
      soundFx.playQuizWrong();
      setIsCorrect(false);
    }
  };

  const evaluateOpenResponse = async (answerText: string) => {
    const clean = answerText.trim();
    if (clean.length < 4) {
      setFeedback("Escribe o di una idea un poquito más completa para Tito.");
      return;
    }

    setEvaluatingOpen(true);
    setFeedback(null);
    try {
      const resp = await fetch("/api/evaluate-spoken-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: clean,
          question: question.question,
          expectedConcept: question.expectedConcept,
          levelTitle,
        }),
      });
      const data = (await resp.json()) as {
        correct?: boolean;
        encouragement?: string;
        coachTip?: string;
        error?: string;
      };
      if (!resp.ok) {
        throw new Error(data.error ?? "No se pudo evaluar tu respuesta.");
      }

      const ok = Boolean(data.correct);
      setFeedback(
        `${data.encouragement ?? ""} ${data.coachTip ? `Tip: ${data.coachTip}` : ""}`.trim()
      );
      if (ok) {
        soundFx.playQuizCorrect();
        setIsCorrect(true);
      } else {
        soundFx.playQuizWrong();
        setIsCorrect(false);
      }
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Hubo un problema al revisar tu respuesta. Intenta de nuevo."
      );
    } finally {
      setEvaluatingOpen(false);
    }
  };

  const handleVoiceTranscript = async (transcript: string) => {
    setOpenAnswer(transcript);
    await evaluateOpenResponse(transcript);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-title"
    >
      <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-3xl bg-[#FFFDF7] border-2 border-amber-300 shadow-2xl p-5 sm:p-7">
        {/* Clean unboxed metadata header */}
        <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-500 mb-3">
          <span>
            Reto {questionIndex + 1} de {totalQuestions} · {levelTitle}
          </span>
          <span className="font-mono-num text-amber-700">+25 monedas al pasar</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-5">
          <AnimatedCharacter
            character="tito"
            mood={isCorrect ? "happy" : feedback ? "alert" : "talking"}
            size="sm"
          />
          <div className="flex-1 text-center sm:text-left">
            <h2
              id="quiz-title"
              className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 leading-tight"
            >
              {question.checkpointTitle}
            </h2>
            <p className="text-xs sm:text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 mt-2">
              <strong className="font-bold">Sabiduría financiera:</strong>{" "}
              {question.lessonTip}
            </p>
          </div>
        </div>

        <p className="text-base sm:text-lg font-bold text-slate-900 mb-4 leading-snug">
          {question.question}
        </p>

        {/* MODE 1: VISUAL IMAGE SELECTION CARDS */}
        {question.mode === "image_choice" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {question.options.map((opt) => {
              const isSelected = selectedId === opt.id;
              const showRight = isCorrect && opt.isCorrect;
              const showWrong = isSelected && !opt.isCorrect;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt)}
                  disabled={isCorrect}
                  className={`group rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.98] flex flex-col gap-2.5 cursor-pointer ${
                    showRight
                      ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                      : showWrong
                        ? "bg-rose-50 border-rose-400 text-rose-900"
                        : "bg-white border-slate-200 hover:border-amber-400 text-slate-900"
                  }`}
                >
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-amber-50 border border-amber-100">
                    {opt.imageSrc ? (
                      <img
                        src={opt.imageSrc}
                        alt={opt.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-700 font-bold text-sm p-4 text-center">
                        {opt.label}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="font-display font-bold text-sm sm:text-base leading-tight">
                      {opt.label}
                    </span>
                    {showRight && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* MODE 2: TEXT MULTIPLE-CHOICE */}
        {question.mode === "choice" && (
          <div className="space-y-2.5">
            {question.options.map((opt) => {
              const isSelected = selectedId === opt.id;
              const showRight = isCorrect && opt.isCorrect;
              const showWrong = isSelected && !opt.isCorrect;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt)}
                  disabled={isCorrect}
                  className={`w-full min-h-[52px] text-left px-4 py-3 rounded-2xl border-2 font-semibold text-sm sm:text-base flex items-center justify-between gap-3 transition-transform active:scale-[0.99] cursor-pointer ${
                    showRight
                      ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                      : showWrong
                        ? "bg-rose-50 border-rose-400 text-rose-900"
                        : "bg-white border-slate-200 hover:border-amber-400 text-slate-800"
                  }`}
                >
                  <span>{opt.label}</span>
                  {showRight && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {!showRight && !showWrong && (
                    <HelpCircle className="w-5 h-5 text-slate-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* MODE 3: TRUE OPEN-ENDED CHALLENGE (TEXT OR VOICE, NO SPOILERS) */}
        {question.mode === "open_ended" && (
          <div className="space-y-3.5">
            {!isCorrect && (
              <VoiceTranscribePad
                onTranscriptReady={handleVoiceTranscript}
                disabled={evaluatingOpen || isCorrect}
                label="Opción A: Responde hablando con tu voz"
              />
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <label
                htmlFor="open-answer-box"
                className="block text-xs font-bold text-slate-600 mb-1.5"
              >
                {isCorrect
                  ? "Tu respuesta abierta:"
                  : "Opción B: O escribe tu respuesta con tus propias palabras"}
              </label>
              <textarea
                id="open-answer-box"
                rows={3}
                value={openAnswer}
                onChange={(e) => setOpenAnswer(e.target.value)}
                disabled={isCorrect || evaluatingOpen}
                placeholder="Escribe aquí qué harías tú..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-amber-500 resize-none"
              />

              {!isCorrect && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  {question.openHint ? (
                    <button
                      type="button"
                      onClick={() => setShowHint((h) => !h)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lightbulb className="w-4 h-4" />
                      <span>{showHint ? "Ocultar Pista" : "Pedir una Pista"}</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={() => evaluateOpenResponse(openAnswer)}
                    disabled={evaluatingOpen || openAnswer.trim().length < 4}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-display font-extrabold text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {evaluatingOpen ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Revisando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar Respuesta</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {showHint && question.openHint && !isCorrect && (
                <p className="mt-2.5 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {question.openHint}
                </p>
              )}
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`mt-4 rounded-2xl p-4 border-2 ${
              isCorrect
                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                : "bg-amber-50 border-amber-300 text-amber-950"
            }`}
          >
            <p className="text-sm font-bold leading-snug">{feedback}</p>
            {isCorrect && (
              <div className="mt-3 pt-3 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Logro desbloqueado: {question.achievementTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onPassed(question.achievementTitle, 25)}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Seguir en la Ruta</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
