import React, { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  CheckCircle2,
  Coins,
  Crown,
  Lock,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  BANK_CUSTOMER_CASES,
  BankThemeColor,
  FINANCIAL_ROLES,
  getBankInterestRate,
  isRoleUnlocked,
  RoleId,
} from "../data/world";
import { soundFx } from "../audio/soundFx";

interface RoleBankModalProps {
  initialTab?: "roles" | "bank";
  walletCoins: number;
  bankVaultCoins: number;
  lifetimeCoinsEarned: number;
  completedLevels: number[];
  activeRoleId: RoleId;
  bankName: string;
  bankColor: BankThemeColor;
  bankCasesSolved: string[];
  onSelectRole: (roleId: RoleId) => void;
  onUpdateBankMeta: (name: string, color: BankThemeColor) => void;
  onDepositToBank: (amount: number) => void;
  onWithdrawFromBank: (amount: number) => void;
  onSolveBankCase: (caseId: string, rewardCoins: number) => void;
  onClose: () => void;
}

const BANK_THEMES: Record<
  BankThemeColor,
  { label: string; headerBg: string; border: string; accent: string }
> = {
  emerald: {
    label: "Verde Bóveda",
    headerBg: "bg-emerald-700",
    border: "border-emerald-300",
    accent: "text-emerald-700",
  },
  amber: {
    label: "Dorado Tesoro",
    headerBg: "bg-amber-600",
    border: "border-amber-300",
    accent: "text-amber-700",
  },
  blue: {
    label: "Azul Futuro",
    headerBg: "bg-sky-700",
    border: "border-sky-300",
    accent: "text-sky-700",
  },
  violet: {
    label: "Morado Estrella",
    headerBg: "bg-violet-700",
    border: "border-violet-300",
    accent: "text-violet-700",
  },
};

export const RoleBankModal: React.FC<RoleBankModalProps> = ({
  initialTab = "roles",
  walletCoins,
  bankVaultCoins,
  lifetimeCoinsEarned,
  completedLevels,
  activeRoleId,
  bankName,
  bankColor,
  bankCasesSolved,
  onSelectRole,
  onUpdateBankMeta,
  onDepositToBank,
  onWithdrawFromBank,
  onSolveBankCase,
  onClose,
}) => {
  const [tab, setTab] = useState<"roles" | "bank">(initialTab);
  const [draftBankName, setDraftBankName] = useState(bankName);
  const [caseFeedback, setCaseFeedback] = useState<{
    caseId: string;
    ok: boolean;
    text: string;
  } | null>(null);

  const activeRole =
    FINANCIAL_ROLES.find((r) => r.id === activeRoleId) ?? FINANCIAL_ROLES[0];
  const interestRate = getBankInterestRate(activeRoleId);
  const theme = BANK_THEMES[bankColor];

  const bankerUnlocked = isRoleUnlocked(
    FINANCIAL_ROLES[2],
    completedLevels,
    lifetimeCoinsEarned
  );
  const ownerUnlocked = isRoleUnlocked(
    FINANCIAL_ROLES[3],
    completedLevels,
    lifetimeCoinsEarned
  );
  const isBankOwner =
    activeRoleId === "banquero" ||
    activeRoleId === "dueno_banco" ||
    bankerUnlocked;
  const bestUnlockedBankRole = ownerUnlocked
    ? FINANCIAL_ROLES[3]
    : bankerUnlocked
      ? FINANCIAL_ROLES[2]
      : null;
  const canActivateBankerNow =
    bestUnlockedBankRole !== null &&
    activeRoleId !== bestUnlockedBankRole.id &&
    !(activeRoleId === "dueno_banco" && bestUnlockedBankRole.id === "banquero");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-bank-title"
    >
      <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-3xl bg-[#FFFDF7] border-2 border-amber-300 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 bg-white border-b border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
              {tab === "roles" ? (
                <Crown className="w-6 h-6" />
              ) : (
                <Building2 className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">
                Tu Rol Actual: {activeRole.title}
              </p>
              <h2
                id="role-bank-title"
                className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate"
              >
                {tab === "roles" ? "Sube de Rol Financiero" : bankName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar centro de roles y banco"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Switch Tabs */}
        <div className="px-5 sm:px-7 py-3 bg-amber-50/70 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-amber-200">
            <button
              type="button"
              onClick={() => setTab("roles")}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                tab === "roles"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Subir de Rol</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("bank")}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                tab === "bank"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Mi Propio Banco</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="font-mono-num text-amber-800 flex items-center gap-1">
              <Coins className="w-4 h-4" />
              Cartera: {walletCoins}
            </span>
            <span className="font-mono-num text-emerald-800 flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              Bóveda: {bankVaultCoins}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {tab === "roles" && (
            <>
              <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-teal-700">
                    Progreso Acumulado
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    Llevas{" "}
                    <span className="font-mono-num text-amber-700">
                      {lifetimeCoinsEarned} monedas ganadas
                    </span>{" "}
                    y{" "}
                    <span className="font-mono-num text-emerald-700">
                      {completedLevels.length} de 3 rutas
                    </span>{" "}
                    completadas.
                  </p>
                </div>
                <p className="text-xs text-slate-500 max-w-xs">
                  Gastar monedas en la tienda OXXO nunca baja tu progreso para subir de rol.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FINANCIAL_ROLES.map((role, idx) => {
                  const unlocked = isRoleUnlocked(
                    role,
                    completedLevels,
                    lifetimeCoinsEarned
                  );
                  const isActive = activeRoleId === role.id;

                  return (
                    <article
                      key={role.id}
                      className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-transform ${
                        isActive
                          ? `${role.accentBg} ${role.accentBorder} shadow-sm`
                          : unlocked
                            ? "bg-white border-slate-200"
                            : "bg-slate-50 border-slate-200 opacity-80"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                          <span>Rol {idx + 1} de 4</span>
                          {isActive ? (
                            <span className="text-emerald-700 flex items-center gap-1 font-extrabold">
                              <CheckCircle2 className="w-4 h-4" />
                              Rol Activo
                            </span>
                          ) : unlocked ? (
                            <span className="text-teal-700">Desbloqueado</span>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              Bloqueado
                            </span>
                          )}
                        </div>

                        <h3 className="font-display font-extrabold text-lg text-slate-900">
                          {role.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                          {role.description}
                        </p>
                        <p className="mt-3 text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{role.perkLabel}</span>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/70">
                        {unlocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              soundFx.playQuizCorrect();
                              onSelectRole(role.id);
                              if (
                                role.id === "banquero" ||
                                role.id === "dueno_banco"
                              ) {
                                setTab("bank");
                              }
                            }}
                            disabled={isActive}
                            className={`min-h-[44px] w-full rounded-xl font-display font-extrabold text-xs sm:text-sm cursor-pointer ${
                              isActive
                                ? "bg-emerald-600 text-white cursor-default"
                                : "bg-amber-500 hover:bg-amber-600 text-slate-950"
                            }`}
                          >
                            {isActive
                              ? "Tu Rol Actual"
                              : role.id === "banquero" ||
                                  role.id === "dueno_banco"
                                ? "¡Cambiar a Este Rol y Abrir Mi Banco!"
                                : "Activar Este Rol"}
                          </button>
                        ) : (
                          <p className="text-xs font-semibold text-slate-500">
                            Requisito: Completa Ruta {role.minLevelCompleted} o junta{" "}
                            <span className="font-mono-num">
                              {role.minLifetimeCoins}
                            </span>{" "}
                            monedas acumuladas.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {tab === "bank" && (
            <>
              {/* Bank Showcase Banner */}
              <div
                className={`rounded-3xl border-2 ${theme.border} bg-white overflow-hidden shadow-sm`}
              >
                <div
                  className={`${theme.headerBg} text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                >
                  <div>
                    <p className="text-xs font-bold opacity-90">
                      {isBankOwner
                        ? "Sucursal Oficial de Tu Propio Banco"
                        : "Modo Práctica · Completa Ruta 2 o junta 350 monedas para ser Banquero Jr."}
                    </p>
                    <h3 className="text-2xl font-display font-extrabold">
                      {bankName}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {canActivateBankerNow && bestUnlockedBankRole ? (
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playQuizCorrect();
                          onSelectRole(bestUnlockedBankRole.id);
                        }}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
                      >
                        <Crown className="w-4 h-4" />
                        <span>¡Cambiar a {bestUnlockedBankRole.shortTitle}!</span>
                      </button>
                    ) : !isBankOwner ? (
                      <button
                        type="button"
                        onClick={() => setTab("roles")}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Crown className="w-4 h-4" />
                        <span>Ver Requisitos de Banquero</span>
                      </button>
                    ) : null}
                    <div className="text-left sm:text-right">
                      <p className="text-xs opacity-90">Rendimiento al completar rutas</p>
                      <p className="font-mono-num text-xl font-extrabold flex items-center sm:justify-end gap-1">
                        <TrendingUp className="w-5 h-5" />
                        +{Math.round(interestRate * 100)}% ahorro
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Customize Bank */}
                  <div className="space-y-3">
                    <label
                      htmlFor="bank-name-input"
                      className="block text-xs font-bold text-slate-600"
                    >
                      Nombre de tu Banco:
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="bank-name-input"
                        type="text"
                        maxLength={28}
                        value={draftBankName}
                        onChange={(e) => setDraftBankName(e.target.value)}
                        className="flex-1 min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = draftBankName.trim() || "Banco Súper Ahorro";
                          onUpdateBankMeta(clean, bankColor);
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        Guardar
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {(Object.keys(BANK_THEMES) as BankThemeColor[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            onUpdateBankMeta(
                              draftBankName.trim() || bankName,
                              c
                            )
                          }
                          className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-bold border-2 cursor-pointer ${
                            bankColor === c
                              ? "border-slate-900 bg-slate-100 text-slate-900"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {BANK_THEMES[c].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Deposit & Withdraw Vault */}
                  <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900">
                        Bóveda de Tu Banco
                      </span>
                      <span className="font-mono-num text-xl font-extrabold text-emerald-700">
                        {bankVaultCoins} monedas
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Guarda monedas en tu bóveda: cada vez que completes una ruta y pases la entrevista, ¡tu bóveda crece{" "}
                      <strong>+{Math.round(interestRate * 100)}%</strong> automáticamente!
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={walletCoins < 20}
                        onClick={() => {
                          soundFx.playCoin();
                          onDepositToBank(20);
                        }}
                        className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowDownToLine className="w-4 h-4" />
                        <span>Guardar +20</span>
                      </button>
                      <button
                        type="button"
                        disabled={walletCoins < 50}
                        onClick={() => {
                          soundFx.playCoin();
                          onDepositToBank(50);
                        }}
                        className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowDownToLine className="w-4 h-4" />
                        <span>Guardar +50</span>
                      </button>
                      <button
                        type="button"
                        disabled={bankVaultCoins < 20}
                        onClick={() => {
                          soundFx.playCoin();
                          onWithdrawFromBank(Math.min(50, bankVaultCoins));
                        }}
                        className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 disabled:opacity-45 text-amber-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowUpFromLine className="w-4 h-4" />
                        <span>Retirar para Comprar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attend Bank Customers Simulation */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-700" />
                  <h4 className="font-display font-extrabold text-base text-slate-900">
                    Atiende Clientes en Tu Banco (+20 monedas por buen consejo)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BANK_CUSTOMER_CASES.map((c) => {
                    const solved = bankCasesSolved.includes(c.id);
                    const fb =
                      caseFeedback?.caseId === c.id ? caseFeedback : null;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-teal-800">{c.customerName}</span>
                          {solved && (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              Atendido
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                          “{c.question}”
                        </p>

                        {!solved ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                soundFx.playQuizCorrect();
                                setCaseFeedback({
                                  caseId: c.id,
                                  ok: true,
                                  text: c.goodReply,
                                });
                                onSolveBankCase(c.id, c.rewardCoins);
                              }}
                              className="w-full min-h-[44px] text-left px-3.5 py-2 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-xs font-bold text-slate-800 cursor-pointer"
                            >
                              {c.goodChoice}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                soundFx.playQuizWrong();
                                setCaseFeedback({
                                  caseId: c.id,
                                  ok: false,
                                  text: c.badReply,
                                });
                              }}
                              className="w-full min-h-[44px] text-left px-3.5 py-2 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-xs font-bold text-slate-800 cursor-pointer"
                            >
                              {c.badChoice}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                            {c.goodReply}
                          </p>
                        )}

                        {fb && !solved && (
                          <p
                            className={`text-xs font-bold rounded-xl px-3 py-2 ${
                              fb.ok
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-amber-50 text-amber-900"
                            }`}
                          >
                            {fb.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
