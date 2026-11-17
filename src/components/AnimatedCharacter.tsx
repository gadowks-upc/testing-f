import React from "react";

export type CharacterId = "tito" | "buho";
export type CharacterMood = "idle" | "talking" | "happy" | "alert" | "thinking";

interface AnimatedCharacterProps {
  character: CharacterId;
  mood?: CharacterMood;
  size?: "sm" | "md" | "lg";
  speechText?: string;
}

const CHARACTER_ASSETS: Record<
  CharacterId,
  { src: string; name: string; role: string; ringColor: string }
> = {
  tito: {
    src: "/src/assets/images/guide_tito_alcancia_1794942042635.jpg",
    name: "Tito Alcancía",
    role: "Guía Explorador",
    ringColor: "border-teal-500",
  },
  buho: {
    src: "/src/assets/images/boss_buho_tesorero_1794942041900.jpg",
    name: "Don Búho Tesorero",
    role: "Jefe Mayor de la Bóveda",
    ringColor: "border-amber-500",
  },
};

export const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({
  character,
  mood = "idle",
  size = "md",
  speechText,
}) => {
  const info = CHARACTER_ASSETS[character];

  const sizeClass =
    size === "sm"
      ? "w-16 h-16"
      : size === "lg"
        ? "w-32 h-32 sm:w-40 sm:h-40"
        : "w-24 h-24 sm:w-28 sm:h-28";

  const animClass =
    mood === "talking"
      ? "animate-character-talk"
      : mood === "happy"
        ? "animate-float-slow"
        : "animate-character-idle";

  const moodAccent =
    mood === "alert"
      ? "border-orange-500 shadow-orange-500/25"
      : mood === "happy"
        ? "border-emerald-500 shadow-emerald-500/25"
        : mood === "talking"
          ? "border-amber-500 shadow-amber-500/25"
          : `${info.ringColor} shadow-slate-900/10`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${animClass}`}>
        <div
          className={`${sizeClass} rounded-3xl overflow-hidden border-4 ${moodAccent} shadow-lg bg-amber-50 transition-transform duration-200`}
        >
          <img
            src={info.src}
            alt={info.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Expressive animated SVG reaction icon when talking or alert */}
        {mood === "talking" && (
          <div
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center shadow"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-900" fill="currentColor">
              <path d="M12 3a9 9 0 0 0-9 9c0 1.8.53 3.47 1.44 4.88L3 21l4.29-1.39A8.96 8.96 0 0 0 12 21a9 9 0 0 0 0-18Zm-3 10a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm3 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm3 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
            </svg>
          </div>
        )}

        {mood === "alert" && (
          <div
            aria-hidden="true"
            className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center shadow text-white font-display font-extrabold text-lg"
          >
            !
          </div>
        )}

        {mood === "happy" && (
          <div
            aria-hidden="true"
            className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow text-white"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {speechText && (
        <div className="max-w-md rounded-2xl bg-white border border-slate-200 px-4 py-2.5 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-500 mb-0.5">{info.name}</p>
          <p className="text-sm font-medium text-slate-800 leading-snug">{speechText}</p>
        </div>
      )}
    </div>
  );
};
