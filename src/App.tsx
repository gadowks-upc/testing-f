import React, { useEffect, useState } from "react";
import {
  Award,
  Play,
  RotateCcw,
  Store,
  Trophy,
  Video,
} from "lucide-react";
import { FINANCIAL_LEVELS, FinancialLevel } from "./data/levels";
import {
  BankThemeColor,
  FINANCIAL_ROLES,
  getBankInterestRate,
  PurchasedVoucher,
  RealStoreProduct,
  RoleId,
} from "./data/world";
import { FirstPersonCourse } from "./components/FirstPersonCourse";
import { QuizModal } from "./components/QuizModal";
import { BossInterviewModal } from "./components/BossInterviewModal";
import { AnimatedCharacter } from "./components/AnimatedCharacter";
import { AdventureRoadMap } from "./components/AdventureRoadMap";
import { RealStoreModal } from "./components/RealStoreModal";
import { RoleBankModal } from "./components/RoleBankModal";
import { soundFx } from "./audio/soundFx";

type ScreenState =
  | "TITLE"
  | "MAP"
  | "PLAYING"
  | "COURSE_FAILED"
  | "COURSE_COMPLETE"
  | "VICTORY";

interface SavedProgress {
  totalCoins: number;
  lifetimeCoinsEarned: number;
  unlockedLevel: number;
  completedLevels: number[];
  achievements: string[];
  activeRoleId: RoleId;
  bankName: string;
  bankColor: BankThemeColor;
  bankVaultCoins: number;
  purchasedVouchers: PurchasedVoucher[];
  bankCasesSolved: string[];
}

const STORAGE_KEY = "mision_ahorro_progress_v1";

function createDefaultProgress(): SavedProgress {
  return {
    totalCoins: 0,
    lifetimeCoinsEarned: 0,
    unlockedLevel: 1,
    completedLevels: [],
    achievements: [],
    activeRoleId: "explorador",
    bankName: "Banco Súper Ahorro",
    bankColor: "emerald",
    bankVaultCoins: 0,
    purchasedVouchers: [],
    bankCasesSolved: [],
  };
}

function loadProgress(): SavedProgress {
  const defaults = createDefaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedProgress>;
      const totalCoins =
        typeof parsed.totalCoins === "number" ? parsed.totalCoins : 0;
      const bankVaultCoins =
        typeof parsed.bankVaultCoins === "number" ? parsed.bankVaultCoins : 0;
      return {
        totalCoins,
        lifetimeCoinsEarned:
          typeof parsed.lifetimeCoinsEarned === "number"
            ? parsed.lifetimeCoinsEarned
            : totalCoins + bankVaultCoins,
        unlockedLevel:
          typeof parsed.unlockedLevel === "number" ? parsed.unlockedLevel : 1,
        completedLevels: Array.isArray(parsed.completedLevels)
          ? parsed.completedLevels
          : [],
        achievements: Array.isArray(parsed.achievements)
          ? parsed.achievements
          : [],
        activeRoleId: parsed.activeRoleId ?? defaults.activeRoleId,
        bankName:
          typeof parsed.bankName === "string" && parsed.bankName.trim()
            ? parsed.bankName
            : defaults.bankName,
        bankColor: parsed.bankColor ?? defaults.bankColor,
        bankVaultCoins,
        purchasedVouchers: Array.isArray(parsed.purchasedVouchers)
          ? parsed.purchasedVouchers
          : [],
        bankCasesSolved: Array.isArray(parsed.bankCasesSolved)
          ? parsed.bankCasesSolved
          : [],
      };
    }
  } catch {
    // ignore storage errors
  }
  return defaults;
}

export default function App() {
  const [screen, setScreen] = useState<ScreenState>("TITLE");
  const [progress, setProgress] = useState<SavedProgress>(() => loadProgress());

  // Active level & run state
  const [activeLevel, setActiveLevel] = useState<FinancialLevel>(
    FINANCIAL_LEVELS[0]
  );
  const [runKey, setRunKey] = useState(1);
  const [manualPaused, setManualPaused] = useState(false);
  const [activeQuizIdx, setActiveQuizIdx] = useState<number | null>(null);
  const [completedCheckpoints, setCompletedCheckpoints] = useState(0);
  const [runCoins, setRunCoins] = useState(0);
  const [runAchievements, setRunAchievements] = useState<string[]>([]);
  const [showBossInterview, setShowBossInterview] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [roleBankModalTab, setRoleBankModalTab] = useState<
    "roles" | "bank" | null
  >(null);
  const [victoryInfo, setVictoryInfo] = useState<{
    bonusCoins: number;
    bankInterestEarned: number;
    feedback: string;
  } | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [practiceTranscript, setPracticeTranscript] = useState<string | null>(
    null
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore
    }
  }, [progress]);

  // Enter / Space shortcut on Title Screen
  useEffect(() => {
    if (screen !== "TITLE") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.code === "Space") {
        e.preventDefault();
        setScreen("MAP");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  const startLevelRun = (level: FinancialLevel) => {
    setActiveLevel(level);
    setRunKey((k) => k + 1);
    setManualPaused(false);
    setActiveQuizIdx(null);
    setCompletedCheckpoints(0);
    setRunCoins(0);
    setRunAchievements([]);
    setRetryNotice(null);
    setShowBossInterview(false);
    setScreen("PLAYING");
  };

  const handleCoinPickup = (amount: number) => {
    setRunCoins((c) => c + amount);
  };

  const handleCheckpointReached = (idx: number) => {
    setActiveQuizIdx(idx);
  };

  const handleQuizPassed = (achievementTitle: string, bonusCoins: number) => {
    setRunCoins((c) => c + bonusCoins);
    setCompletedCheckpoints((n) => n + 1);
    setRunAchievements((prev) =>
      prev.includes(achievementTitle) ? prev : [...prev, achievementTitle]
    );
    setProgress((prev) => ({
      ...prev,
      achievements: prev.achievements.includes(achievementTitle)
        ? prev.achievements
        : [...prev.achievements, achievementTitle],
    }));
    setActiveQuizIdx(null);
  };

  const handleCourseFinished = () => {
    const earned = runCoins + activeLevel.routeBonusCoins;
    setRunCoins(earned);
    setProgress((prev) => ({
      ...prev,
      totalCoins: prev.totalCoins + earned,
      lifetimeCoinsEarned: prev.lifetimeCoinsEarned + earned,
    }));
    setShowBossInterview(true);
    setScreen("COURSE_COMPLETE");
  };

  const handleCourseFailed = () => {
    setActiveQuizIdx(null);
    setManualPaused(false);
    setScreen("COURSE_FAILED");
  };

  const handleInterviewPassed = (bonusCoins: number, feedback: string) => {
    setShowBossInterview(false);
    soundFx.playFanfare();
    const interestRate = getBankInterestRate(progress.activeRoleId);
    const interestGain =
      progress.bankVaultCoins > 0
        ? Math.max(5, Math.round(progress.bankVaultCoins * interestRate))
        : 0;

    setProgress((prev) => {
      const nextUnlocked = Math.min(
        FINANCIAL_LEVELS.length,
        Math.max(prev.unlockedLevel, activeLevel.id + 1)
      );
      const completed = prev.completedLevels.includes(activeLevel.id)
        ? prev.completedLevels
        : [...prev.completedLevels, activeLevel.id];
      return {
        ...prev,
        totalCoins: prev.totalCoins + bonusCoins,
        bankVaultCoins: prev.bankVaultCoins + interestGain,
        lifetimeCoinsEarned:
          prev.lifetimeCoinsEarned + bonusCoins + interestGain,
        unlockedLevel: nextUnlocked,
        completedLevels: completed,
      };
    });
    setVictoryInfo({
      bonusCoins,
      bankInterestEarned: interestGain,
      feedback,
    });
    setScreen("VICTORY");
  };

  const handleInterviewFailedRetry = (feedback: string) => {
    setShowBossInterview(false);
    setRetryNotice(feedback);
    setScreen("MAP");
  };

  const handleBuyProduct = (
    product: RealStoreProduct,
    finalPrice: number
  ): PurchasedVoucher | null => {
    if (progress.totalCoins < finalPrice) return null;
    const codeSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const voucher: PurchasedVoucher = {
      voucherId: `${product.id}-${Date.now()}`,
      code: `${product.brandId.toUpperCase()}-${codeSuffix}`,
      productId: product.id,
      productName: product.name,
      brandId: product.brandId,
      paidCoins: finalPrice,
      purchasedAt: new Date().toISOString(),
      realWorldNote: product.realWorldNote,
    };
    setProgress((prev) => {
      if (prev.totalCoins < finalPrice) return prev;
      return {
        ...prev,
        totalCoins: prev.totalCoins - finalPrice,
        purchasedVouchers: [voucher, ...prev.purchasedVouchers],
      };
    });
    return voucher;
  };

  const handleSelectRole = (roleId: RoleId) => {
    setProgress((prev) => ({ ...prev, activeRoleId: roleId }));
  };

  const handleUpdateBankMeta = (bankName: string, bankColor: BankThemeColor) => {
    setProgress((prev) => ({ ...prev, bankName, bankColor }));
  };

  const handleDepositToBank = (amount: number) => {
    setProgress((prev) => {
      const actual = Math.min(amount, prev.totalCoins);
      if (actual <= 0) return prev;
      return {
        ...prev,
        totalCoins: prev.totalCoins - actual,
        bankVaultCoins: prev.bankVaultCoins + actual,
      };
    });
  };

  const handleWithdrawFromBank = (amount: number) => {
    setProgress((prev) => {
      const actual = Math.min(amount, prev.bankVaultCoins);
      if (actual <= 0) return prev;
      return {
        ...prev,
        bankVaultCoins: prev.bankVaultCoins - actual,
        totalCoins: prev.totalCoins + actual,
      };
    });
  };

  const handleSolveBankCase = (caseId: string, rewardCoins: number) => {
    setProgress((prev) => {
      if (prev.bankCasesSolved.includes(caseId)) return prev;
      return {
        ...prev,
        totalCoins: prev.totalCoins + rewardCoins,
        lifetimeCoinsEarned: prev.lifetimeCoinsEarned + rewardCoins,
        bankCasesSolved: [...prev.bankCasesSolved, caseId],
      };
    });
  };

  const resetAllProgress = () => {
    setProgress(createDefaultProgress());
    setRetryNotice(null);
    setPracticeTranscript(null);
  };

  const activeRole =
    FINANCIAL_ROLES.find((r) => r.id === progress.activeRoleId) ??
    FINANCIAL_ROLES[0];

  // 1. FULL-VIEWPORT TITLE SCREEN (Game Shell)
  if (screen === "TITLE") {
    return (
      <main className="relative w-full min-h-[100dvh] overflow-hidden flex flex-col justify-between bg-[#FFFDF7]">
        {/* Key-art backdrop */}
        <img
          src="/src/assets/images/title_key_art_1794942044084.jpg"
          alt="Sendero de aventura hacia la Bóveda Dorada"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Measured scrim keeping left 40% readable while leaving the treehouse bank crisp */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-transparent"
        />

        {/* Top perimeter readout */}
        <div className="relative z-10 flex items-center justify-between px-5 sm:px-10 pt-5 text-white/90 text-xs sm:text-sm font-bold">
          <span>
            Aventura Financiera · Rol: {activeRole.shortTitle}
          </span>
          <span className="font-mono-num">
            {progress.totalCoins} monedas · {progress.achievements.length} logros
          </span>
        </div>

        {/* Hero Title Lockup over calm left negative space */}
        <div className="relative z-10 max-w-xl px-5 sm:px-10 my-auto py-8">
          {/* Bespoke inline SVG crest lockup */}
          <div className="inline-flex items-center gap-3 mb-4">
            <svg
              viewBox="0 0 64 64"
              className="w-12 h-12 shrink-0 drop-shadow-md"
              aria-hidden="true"
            >
              <circle cx="32" cy="32" r="29" fill="#F59E0B" stroke="#FFFBEB" strokeWidth="4" />
              <circle cx="32" cy="32" r="21" fill="#FBBF24" stroke="#B45309" strokeWidth="2.5" />
              <path
                d="M32 18v28M25 25c0-3 3.2-5 7-5s7 2 7 5-3 4.5-7 5.5-7 2.5-7 5.5 3.2 5 7 5 7-2 7-5"
                fill="none"
                stroke="#78350F"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-amber-300 font-display font-bold text-sm tracking-wide">
              Escuela de Pequeños Tesoreros
            </span>
          </div>

          <h1
            className="text-4xl sm:text-6xl font-display font-extrabold text-white tracking-tight leading-[1.05]"
            style={{ textWrap: "balance" }}
          >
            Misión Ahorro
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-100 font-medium leading-relaxed max-w-md">
            Corre rutas en primera persona, esquiva compras impulsivas, supera retos
            con Tito Alcancía y convence en vivo a{" "}
            <strong className="text-amber-300">Don Búho Tesorero</strong> para ganar
            el gran cofre de monedas.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setScreen("MAP")}
              className="min-h-[54px] px-7 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-display font-extrabold text-lg flex items-center gap-2.5 shadow-xl cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>¡Comenzar Aventura!</span>
            </button>
          </div>
        </div>

        {/* Single flat control-hint line */}
        <div className="relative z-10 px-5 sm:px-10 pb-5 text-xs font-semibold text-white/80">
          WASD / Flechas o Desliza Mover · Espacio Saltar · Esc Pausa · Cámara y Micrófono para Entrevista Final
        </div>
      </main>
    );
  }

  // 2. PLAYING 3D FIRST-PERSON COURSE (+ optional Quiz Checkpoint overlay)
  if (screen === "PLAYING") {
    return (
      <div className="relative w-full h-[100dvh] overflow-hidden">
        <FirstPersonCourse
          key={`${activeLevel.id}-${runKey}`}
          level={activeLevel}
          paused={manualPaused || activeQuizIdx !== null}
          onPauseToggle={() => {
            if (activeQuizIdx === null) {
              setManualPaused((p) => !p);
            }
          }}
          onCoinPickup={handleCoinPickup}
          onCheckpointReached={handleCheckpointReached}
          onCourseFinished={handleCourseFinished}
          onCourseFailed={handleCourseFailed}
          completedCheckpoints={completedCheckpoints}
        />

        {activeQuizIdx !== null && activeLevel.questions[activeQuizIdx] && (
          <QuizModal
            levelTitle={activeLevel.title}
            question={activeLevel.questions[activeQuizIdx]}
            questionIndex={activeQuizIdx}
            totalQuestions={activeLevel.questions.length}
            onPassed={handleQuizPassed}
          />
        )}
      </div>
    );
  }

  // 3. COURSE FAILED RETRY MODAL
  if (screen === "COURSE_FAILED") {
    return (
      <main className="min-h-[100dvh] bg-[#FFFDF7] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg rounded-3xl bg-white border-2 border-amber-300 shadow-xl p-6 sm:p-8 text-center">
          <AnimatedCharacter
            character="tito"
            mood="talking"
            size="md"
            speechText="¡Casi llegamos! Esas trampas de dulces son traviesas, pero cada intento te hace más ágil."
          />
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-5">
            ¡Intentémoslo otra vez!
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2 mb-6">
            Esquiva los obstáculos con las flechas o botones y salta sobre los más
            bajos para cuidar tus 3 corazones.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => startLevelRun(activeLevel)}
              className="min-h-[50px] px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Repetir la Ruta</span>
            </button>
            <button
              type="button"
              onClick={() => setScreen("MAP")}
              className="min-h-[50px] px-6 py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm cursor-pointer"
            >
              Ir al Mapa
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 4. COURSE COMPLETE -> LAUNCH BOSS INTERVIEW
  if (screen === "COURSE_COMPLETE") {
    return (
      <main className="min-h-[100dvh] bg-[#FFFDF7] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl rounded-3xl bg-white border-2 border-amber-300 shadow-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <AnimatedCharacter character="buho" mood="happy" size="lg" />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-bold text-teal-700">
                ¡Ruta Superada! · Nivel {activeLevel.id}
              </p>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
                ¡Llegaste ante Don Búho Tesorero!
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">
                Ganaste <strong className="font-mono-num text-amber-700">{runCoins} monedas</strong>{" "}
                en el camino. Ahora pasa la entrevista con tu cámara prendida para
                ganar el gran cofre de{" "}
                <strong className="font-mono-num text-emerald-700">
                  +{activeLevel.bossJackpotCoins} monedas
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs font-bold text-amber-900 mb-2">
              Logros conseguidos en esta ruta:
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold text-slate-800">
              {runAchievements.length > 0 ? (
                runAchievements.map((ach, i) => (
                  <span key={ach} className="inline-flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    {ach}
                    {i < runAchievements.length - 1 && (
                      <span className="text-amber-300 ml-1">·</span>
                    )}
                  </span>
                ))
              ) : (
                <span>Explorador Financiero</span>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setShowBossInterview(true)}
              className="min-h-[54px] flex-1 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2.5 shadow-md cursor-pointer"
            >
              <Video className="w-5 h-5" />
              <span>Entrar a la Entrevista en Vivo</span>
            </button>
            <button
              type="button"
              onClick={() => setScreen("MAP")}
              className="min-h-[54px] px-5 py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm cursor-pointer"
            >
              Volver al Mapa
            </button>
          </div>
        </div>

        {showBossInterview && (
          <BossInterviewModal
            level={activeLevel}
            earnedAchievements={runAchievements}
            routeCoins={runCoins}
            onInterviewPassed={handleInterviewPassed}
            onInterviewFailedRetry={handleInterviewFailedRetry}
            onClose={() => setShowBossInterview(false)}
          />
        )}
      </main>
    );
  }

  // 5. VICTORY CELEBRATION AFTER PASSING BOSS INTERVIEW
  if (screen === "VICTORY" && victoryInfo) {
    return (
      <main className="relative min-h-[100dvh] bg-[#FFFDF7] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <div className="w-full max-w-xl rounded-3xl bg-white border-2 border-emerald-400 shadow-2xl p-6 sm:p-8 text-center">
          <div className="w-24 h-24 mx-auto rounded-3xl overflow-hidden border-4 border-amber-400 shadow-lg mb-4">
            <img
              src="/src/assets/images/badge_ahorro_maestro_1794942044146.jpg"
              alt="Medalla de Gran Tesorero"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <p className="text-xs font-bold text-emerald-700">
            Entrevista Aprobada · Nivel {activeLevel.id} Completado
          </p>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 mt-1">
            ¡Cofre Dorado Desbloqueado!
          </h2>
          <p className="text-base text-slate-600 mt-3 leading-relaxed">
            {victoryInfo.feedback}
          </p>

          <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-wrap items-center justify-around gap-3">
            <div>
              <p className="text-xs font-bold text-amber-800">Premio Jefe Mayor</p>
              <p className="font-mono-num text-2xl font-extrabold text-amber-700">
                +{victoryInfo.bonusCoins}
              </p>
            </div>
            {victoryInfo.bankInterestEarned > 0 && (
              <>
                <div className="h-10 w-px bg-amber-200" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">
                    Interés de Tu Banco
                  </p>
                  <p className="font-mono-num text-2xl font-extrabold text-emerald-700">
                    +{victoryInfo.bankInterestEarned}
                  </p>
                </div>
              </>
            )}
            <div className="h-10 w-px bg-amber-200" />
            <div>
              <p className="text-xs font-bold text-teal-800">Tu Cartera Lista</p>
              <p className="font-mono-num text-2xl font-extrabold text-teal-700">
                {progress.totalCoins}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setScreen("MAP")}
              className="min-h-[54px] flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Trophy className="w-5 h-5" />
              <span>Seguir en el Mapa</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScreen("MAP");
                setShowStoreModal(true);
              }}
              className="min-h-[54px] px-5 rounded-2xl bg-[#D92323] hover:bg-[#b91c1c] text-[#FACC15] border-2 border-[#FACC15] font-display font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer whitespace-nowrap"
            >
              <Store className="w-4 h-4" />
              <span>Ir a OXXO y Tiendas</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 6. INTERACTIVE ROAD MAP, ROLE PROGRESSION, OWN BANK & BRANDED REAL STORE
  return (
    <>
      <AdventureRoadMap
        walletCoins={progress.totalCoins}
        bankVaultCoins={progress.bankVaultCoins}
        lifetimeCoinsEarned={progress.lifetimeCoinsEarned}
        unlockedLevel={progress.unlockedLevel}
        completedLevels={progress.completedLevels}
        achievements={progress.achievements}
        activeRoleId={progress.activeRoleId}
        bankName={progress.bankName}
        vouchersCount={progress.purchasedVouchers.length}
        retryNotice={retryNotice}
        practiceTranscript={practiceTranscript}
        onPracticeTranscript={(text) => setPracticeTranscript(text)}
        onBackToTitle={() => setScreen("TITLE")}
        onStartLevelRun={startLevelRun}
        onLaunchDirectInterview={(lvl) => {
          setActiveLevel(lvl);
          setRunAchievements(
            progress.achievements.length > 0
              ? progress.achievements
              : [lvl.questions[0].achievementTitle]
          );
          setRunCoins(lvl.routeBonusCoins);
          setShowBossInterview(true);
        }}
        onOpenStore={() => setShowStoreModal(true)}
        onOpenRoleBank={(tab) => setRoleBankModalTab(tab)}
        onResetProgress={resetAllProgress}
      />

      {showStoreModal && (
        <RealStoreModal
          walletCoins={progress.totalCoins}
          activeRoleId={progress.activeRoleId}
          vouchers={progress.purchasedVouchers}
          onBuyProduct={handleBuyProduct}
          onClose={() => setShowStoreModal(false)}
        />
      )}

      {roleBankModalTab && (
        <RoleBankModal
          initialTab={roleBankModalTab}
          walletCoins={progress.totalCoins}
          bankVaultCoins={progress.bankVaultCoins}
          lifetimeCoinsEarned={progress.lifetimeCoinsEarned}
          completedLevels={progress.completedLevels}
          activeRoleId={progress.activeRoleId}
          bankName={progress.bankName}
          bankColor={progress.bankColor}
          bankCasesSolved={progress.bankCasesSolved}
          onSelectRole={handleSelectRole}
          onUpdateBankMeta={handleUpdateBankMeta}
          onDepositToBank={handleDepositToBank}
          onWithdrawFromBank={handleWithdrawFromBank}
          onSolveBankCase={handleSolveBankCase}
          onClose={() => setRoleBankModalTab(null)}
        />
      )}

      {showBossInterview && (
        <BossInterviewModal
          level={activeLevel}
          earnedAchievements={runAchievements}
          routeCoins={runCoins}
          onInterviewPassed={handleInterviewPassed}
          onInterviewFailedRetry={handleInterviewFailedRetry}
          onClose={() => setShowBossInterview(false)}
        />
      )}
    </>
  );
}
