import React, { useState } from "react";
import {
  Award,
  Building2,
  Check,
  Coins,
  Crown,
  Lock,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Store,
  Video,
  X,
} from "lucide-react";
import { FINANCIAL_LEVELS, FinancialLevel } from "../data/levels";
import {
  FINANCIAL_ROLES,
  isRoleUnlocked,
  RoleId,
} from "../data/world";
import { AnimatedCharacter } from "./AnimatedCharacter";
import { VoiceTranscribePad } from "./VoiceTranscribePad";
import { MilestoneFocusId, WorldMap3D } from "./WorldMap3D";

interface AdventureRoadMapProps {
  walletCoins: number;
  bankVaultCoins: number;
  lifetimeCoinsEarned: number;
  unlockedLevel: number;
  completedLevels: number[];
  achievements: string[];
  activeRoleId: RoleId;
  bankName: string;
  vouchersCount: number;
  retryNotice: string | null;
  practiceTranscript: string | null;
  onPracticeTranscript: (text: string) => void;
  onBackToTitle: () => void;
  onStartLevelRun: (level: FinancialLevel) => void;
  onLaunchDirectInterview: (level: FinancialLevel) => void;
  onOpenStore: () => void;
  onOpenRoleBank: (tab: "roles" | "bank") => void;
  onResetProgress: () => void;
}

export const AdventureRoadMap: React.FC<AdventureRoadMapProps> = ({
  walletCoins,
  bankVaultCoins,
  lifetimeCoinsEarned,
  unlockedLevel,
  completedLevels,
  achievements,
  activeRoleId,
  bankName,
  vouchersCount,
  retryNotice,
  practiceTranscript,
  onPracticeTranscript,
  onBackToTitle,
  onStartLevelRun,
  onLaunchDirectInterview,
  onOpenStore,
  onOpenRoleBank,
  onResetProgress,
}) => {
  const defaultFocus =
    FINANCIAL_LEVELS.find((l) => l.id === unlockedLevel) ?? FINANCIAL_LEVELS[0];
  const [selectedLevel, setSelectedLevel] =
    useState<FinancialLevel>(defaultFocus);
  const [focusedMilestone, setFocusedMilestone] = useState<MilestoneFocusId>(
    defaultFocus.id === 1 ? "r1" : defaultFocus.id === 2 ? "r2" : "r3"
  );
  const [showVoicePracticeModal, setShowVoicePracticeModal] = useState(false);
  const [showMedalsModal, setShowMedalsModal] = useState(false);

  const activeRole =
    FINANCIAL_ROLES.find((r) => r.id === activeRoleId) ?? FINANCIAL_ROLES[0];
  const upgradeReadyRole = FINANCIAL_ROLES.find(
    (r) =>
      r.id !== activeRoleId &&
      FINANCIAL_ROLES.findIndex((x) => x.id === r.id) >
        FINANCIAL_ROLES.findIndex((x) => x.id === activeRoleId) &&
      isRoleUnlocked(r, completedLevels, lifetimeCoinsEarned)
  );

  const level1 = FINANCIAL_LEVELS[0];
  const level2 = FINANCIAL_LEVELS[1];
  const level3 = FINANCIAL_LEVELS[2];

  const handleSelectMilestone = (id: MilestoneFocusId) => {
    setFocusedMilestone(id);
    if (id === "r1") setSelectedLevel(level1);
    else if (id === "r2") setSelectedLevel(level2);
    else if (id === "r3") setSelectedLevel(level3);
  };

  const handleStartLevelById = (lvlId: 1 | 2 | 3) => {
    const lvl = FINANCIAL_LEVELS.find((l) => l.id === lvlId);
    if (!lvl) return;
    setSelectedLevel(lvl);
    setFocusedMilestone(`r${lvlId}` as MilestoneFocusId);
    if (lvl.id <= unlockedLevel) {
      onStartLevelRun(lvl);
    }
  };

  const isMilestoneDone = (id: MilestoneFocusId) => {
    if (id === "r1") return completedLevels.includes(1);
    if (id === "r2") return completedLevels.includes(2);
    if (id === "r3") return completedLevels.includes(3);
    if (id === "oxxo") return vouchersCount > 0;
    if (id === "roles") return activeRoleId !== "explorador";
    if (id === "bank") return bankVaultCoins > 0;
    return false;
  };

  const isMilestoneNext = (id: MilestoneFocusId) => {
    if (id === "r1") return unlockedLevel === 1 && !completedLevels.includes(1);
    if (id === "r2") return unlockedLevel === 2 && !completedLevels.includes(2);
    if (id === "r3") return unlockedLevel === 3 && !completedLevels.includes(3);
    if (id === "roles") return Boolean(upgradeReadyRole);
    return false;
  };

  const milestoneSteps: {
    id: MilestoneFocusId;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { id: "r1", label: "Ruta 1", icon: <Play className="w-3.5 h-3.5" /> },
    { id: "oxxo", label: "OXXO", icon: <Store className="w-3.5 h-3.5" /> },
    { id: "r2", label: "Ruta 2", icon: <Play className="w-3.5 h-3.5" /> },
    { id: "roles", label: "Roles", icon: <Crown className="w-3.5 h-3.5" /> },
    { id: "r3", label: "Ruta 3", icon: <Play className="w-3.5 h-3.5" /> },
    { id: "bank", label: "Mi Banco", icon: <Building2 className="w-3.5 h-3.5" /> },
  ];

  const isLandedOnSpecialStop =
    focusedMilestone === "oxxo" ||
    focusedMilestone === "roles" ||
    focusedMilestone === "bank";

  return (
    <main className="h-[100dvh] flex flex-col bg-[#E8F5DF] text-slate-900 overflow-hidden">
      {/* Compact Single-Row Top HUD */}
      <header className="bg-white border-b border-emerald-200 px-3 sm:px-6 py-2 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToTitle}
              className="text-base sm:text-lg font-display font-extrabold text-slate-900 hover:text-amber-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              Misión Ahorro
            </button>
            <button
              type="button"
              onClick={() => onOpenRoleBank("roles")}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-xs font-extrabold text-amber-950 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              <span>{activeRole.shortTitle}</span>
              {upgradeReadyRole && (
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold">
            <span className="font-mono-num text-amber-800 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 whitespace-nowrap">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              {walletCoins}
            </span>

            <button
              type="button"
              onClick={() => onOpenRoleBank("bank")}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span className="font-mono-num">{bankVaultCoins}</span>
            </button>

            <button
              type="button"
              onClick={onOpenStore}
              className="min-h-[36px] px-3 py-1 rounded-xl bg-[#D92323] hover:bg-[#b91c1c] text-[#FACC15] font-display font-black text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap border border-[#FACC15]"
            >
              <Store className="w-3.5 h-3.5" />
              <span>OXXO</span>
            </button>

            <button
              type="button"
              onClick={() => setShowVoicePracticeModal(true)}
              aria-label="Practicar voz"
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Mic className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Voz</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMedalsModal(true)}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-mono-num">{achievements.length}/9</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive 3D Map Container */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col gap-2.5">
        {retryNotice && (
          <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 px-3 py-2 flex items-center gap-2.5 shrink-0">
            <AnimatedCharacter character="buho" mood="idle" size="sm" />
            <p className="text-xs font-bold text-slate-900 line-clamp-2">
              {retryNotice}
            </p>
          </div>
        )}

        {/* Interactive Milestone Stepper ("Hitos por Llegar") */}
        <nav
          aria-label="Hitos del camino"
          className="rounded-2xl bg-white border border-emerald-200 px-2.5 py-1.5 shadow-sm overflow-x-auto shrink-0"
        >
          <ol className="flex items-center justify-between gap-1 min-w-[490px]">
            {milestoneSteps.map((step, idx) => {
              const done = isMilestoneDone(step.id);
              const next = isMilestoneNext(step.id);
              const active = focusedMilestone === step.id;
              return (
                <React.Fragment key={step.id}>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleSelectMilestone(step.id)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-display font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? "bg-slate-900 border-slate-900 text-white"
                          : done
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                            : next
                              ? "bg-amber-100 border-amber-400 text-amber-950"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-300"
                      }`}
                    >
                      {done ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        step.icon
                      )}
                      <span>{step.label}</span>
                    </button>
                  </li>
                  {idx < milestoneSteps.length - 1 && (
                    <li
                      aria-hidden="true"
                      className={`flex-1 h-1 rounded-full min-w-[10px] ${
                        done ? "bg-emerald-400" : "bg-slate-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </ol>
        </nav>

        {/* Interactive 3D Adventure Valley Map */}
        <WorldMap3D
          focusedMilestone={focusedMilestone}
          unlockedLevel={unlockedLevel}
          completedLevels={completedLevels}
          vouchersCount={vouchersCount}
          bankVaultCoins={bankVaultCoins}
          bankName={bankName}
          activeRoleShortTitle={activeRole.shortTitle}
          upgradeReadyTitle={upgradeReadyRole?.shortTitle ?? null}
          levelRewards={{
            1: level1.routeBonusCoins + level1.bossJackpotCoins,
            2: level2.routeBonusCoins + level2.bossJackpotCoins,
            3: level3.routeBonusCoins + level3.bossJackpotCoins,
          }}
          onSelectMilestone={handleSelectMilestone}
          onOpenStore={onOpenStore}
          onOpenRoleBank={onOpenRoleBank}
          onStartLevel={handleStartLevelById}
        />

        {/* Compact Bottom Action Dock (Solid Surface, Zero Paragraphs) */}
        <div className="rounded-2xl bg-white border-2 border-amber-400 px-3.5 py-2.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          {isLandedOnSpecialStop ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    focusedMilestone === "oxxo"
                      ? "bg-[#D92323] text-[#FACC15]"
                      : focusedMilestone === "roles"
                        ? "bg-amber-400 text-slate-950"
                        : "bg-emerald-700 text-white"
                  }`}
                >
                  {focusedMilestone === "oxxo" ? (
                    <Store className="w-5 h-5" />
                  ) : focusedMilestone === "roles" ? (
                    <Crown className="w-5 h-5" />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                    {focusedMilestone === "oxxo"
                      ? "Tienda Real"
                      : focusedMilestone === "roles"
                        ? "Rango Actual"
                        : "Tu Banco"}
                  </p>
                  <h2 className="text-base font-display font-extrabold text-slate-900 truncate">
                    {focusedMilestone === "oxxo"
                      ? "OXXO y Tiendas"
                      : focusedMilestone === "roles"
                        ? activeRole.title
                        : bankName}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (focusedMilestone === "oxxo") onOpenStore();
                    else if (focusedMilestone === "roles")
                      onOpenRoleBank("roles");
                    else onOpenRoleBank("bank");
                  }}
                  className={`min-h-[44px] px-5 py-2 rounded-xl font-display font-black text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm ${
                    focusedMilestone === "oxxo"
                      ? "bg-[#D92323] hover:bg-[#b91c1c] text-[#FACC15] border-2 border-[#FACC15]"
                      : focusedMilestone === "roles"
                        ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  <span>
                    {focusedMilestone === "oxxo"
                      ? "Entrar a OXXO"
                      : focusedMilestone === "roles"
                        ? "Ver Roles"
                        : "Abrir Mi Banco"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartLevelById(selectedLevel.id as 1 | 2 | 3)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-display font-extrabold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Correr Ruta {selectedLevel.id}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <AnimatedCharacter character="tito" mood="happy" size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-display font-black text-teal-700 whitespace-nowrap">
                      Ruta {selectedLevel.id}
                    </span>
                    <span className="font-mono-num text-xs font-extrabold text-amber-700 whitespace-nowrap">
                      +{selectedLevel.routeBonusCoins + selectedLevel.bossJackpotCoins} mon.
                    </span>
                  </div>
                  <h2 className="text-base font-display font-extrabold text-slate-900 truncate">
                    {selectedLevel.title}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {selectedLevel.id <= unlockedLevel ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onStartLevelRun(selectedLevel)}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-display font-black text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {completedLevels.includes(selectedLevel.id)
                          ? "¡Correr Otra Vez!"
                          : "¡Correr Ruta 3D!"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onLaunchDirectInterview(selectedLevel)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border-2 border-slate-200 hover:border-amber-400 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Video className="w-4 h-4 text-amber-600" />
                      <span>Don Búho</span>
                    </button>
                  </>
                ) : (
                  <div className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    <span>Completa Ruta {selectedLevel.id - 1}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Voice Practice Modal */}
      {showVoicePracticeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-practice-title"
        >
          <div className="w-full max-w-xl rounded-3xl bg-[#FFFDF7] border-2 border-teal-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Mic className="w-5 h-5 text-teal-600" />
                <h2
                  id="voice-practice-title"
                  className="text-xl font-display font-extrabold text-slate-900"
                >
                  Practica tu Voz
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowVoicePracticeModal(false)}
                aria-label="Cerrar práctica de voz"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <VoiceTranscribePad
              onTranscriptReady={onPracticeTranscript}
              label="Graba un consejo de ahorro"
            />
            {practiceTranscript && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-sm">
                <p className="font-semibold text-slate-900">
                  “{practiceTranscript}”
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Medals & Reset Modal */}
      {showMedalsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medals-modal-title"
        >
          <div className="w-full max-w-xl rounded-3xl bg-[#FFFDF7] border-2 border-amber-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="medals-modal-title"
                className="text-xl font-display font-extrabold text-slate-900"
              >
                Medallas ({achievements.length} / 9)
              </h2>
              <button
                type="button"
                onClick={() => setShowMedalsModal(false)}
                aria-label="Cerrar medallas"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {achievements.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {achievements.map((ach) => (
                  <div
                    key={ach}
                    className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2 flex items-center gap-2.5"
                  >
                    <img
                      src="/src/assets/images/badge_ahorro_maestro_1794942044146.jpg"
                      alt={ach}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <span className="text-xs sm:text-sm font-bold text-slate-800">
                      {ach}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-4">
                Aún no tienes medallas. ¡Completa la Ruta 1!
              </p>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setShowMedalsModal(false);
                }}
                className="min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar Progreso</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
