import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Download,
  QrCode,
  Receipt,
  ShoppingBag,
  Store,
  Tag,
  X,
} from "lucide-react";
import {
  BRAND_PARTNERS,
  BrandId,
  FINANCIAL_ROLES,
  getStoreDiscountRate,
  PurchasedVoucher,
  REAL_WORLD_PRODUCTS,
  RealStoreProduct,
  RoleId,
} from "../data/world";
import { soundFx } from "../audio/soundFx";

interface RealStoreModalProps {
  walletCoins: number;
  activeRoleId: RoleId;
  vouchers: PurchasedVoucher[];
  onBuyProduct: (
    product: RealStoreProduct,
    finalPrice: number
  ) => PurchasedVoucher | null;
  onClose: () => void;
}

function buildQrPayload(voucher: PurchasedVoucher): string {
  const brand = BRAND_PARTNERS[voucher.brandId];
  return [
    "MISION-AHORRO",
    `TIENDA:${brand.name}`,
    `CODIGO:${voucher.code}`,
    `PRODUCTO:${voucher.productName}`,
    `MONEDAS:${voucher.paidCoins}`,
    `FECHA:${voucher.purchasedAt.slice(0, 10)}`,
  ].join("|");
}

const VoucherQrImage: React.FC<{
  voucher: PurchasedVoucher;
  size: number;
  onDataUrlReady?: (url: string) => void;
}> = ({ voucher, size, onDataUrlReady }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const payload = buildQrPayload(voucher);
    QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (cancelled) return;
        setQrDataUrl(url);
        onDataUrlReady?.(url);
      })
      .catch(() => {
        // Fallback handled gracefully by placeholder box
      });
    return () => {
      cancelled = true;
    };
  }, [voucher, size, onDataUrlReady]);

  if (!qrDataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"
      >
        <QrCode className="w-8 h-8" />
      </div>
    );
  }

  return (
    <img
      src={qrDataUrl}
      alt={`Código QR de compra ${voucher.code}`}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="rounded-xl border-2 border-slate-200 bg-white block"
    />
  );
};

export const RealStoreModal: React.FC<RealStoreModalProps> = ({
  walletCoins,
  activeRoleId,
  vouchers,
  onBuyProduct,
  onClose,
}) => {
  const [tab, setTab] = useState<"catalog" | "vouchers">("catalog");
  const [selectedBrand, setSelectedBrand] = useState<"all" | BrandId>("oxxo");
  const [activeQrVoucher, setActiveQrVoucher] =
    useState<PurchasedVoucher | null>(null);
  const [activeQrDownloadUrl, setActiveQrDownloadUrl] = useState<string>("");

  const discountRate = getStoreDiscountRate(activeRoleId);
  const activeRole =
    FINANCIAL_ROLES.find((r) => r.id === activeRoleId) ?? FINANCIAL_ROLES[0];

  const visibleProducts =
    selectedBrand === "all"
      ? REAL_WORLD_PRODUCTS
      : REAL_WORLD_PRODUCTS.filter((p) => p.brandId === selectedBrand);

  const getFinalPrice = (price: number) =>
    Math.max(10, Math.round(price * (1 - discountRate)));

  const handlePurchase = (product: RealStoreProduct) => {
    const finalPrice = getFinalPrice(product.priceCoins);
    if (walletCoins < finalPrice) return;
    const created = onBuyProduct(product, finalPrice);
    if (!created) return;
    soundFx.playQuizCorrect();
    setActiveQrDownloadUrl("");
    setActiveQrVoucher(created);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="real-store-title"
    >
      <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-3xl bg-[#FFFDF7] border-2 border-amber-300 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 bg-white border-b border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#D92323] text-[#FACC15] flex items-center justify-center shrink-0 border-2 border-[#FACC15]">
              <Store className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">
                Tiendas Reales · Canje con QR y Supervisión Familiar
              </p>
              <h2
                id="real-store-title"
                className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate"
              >
                {selectedBrand === "oxxo"
                  ? "Tienda OXXO · Productos Reales"
                  : "Tienda de Marcas Reales"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[11px] font-bold text-slate-500">Tu Cartera</p>
              <p className="font-mono-num text-base sm:text-lg font-extrabold text-amber-700 flex items-center justify-end gap-1">
                <Coins className="w-4 h-4" />
                {walletCoins}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar tienda"
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subbar: Tabs + Role Discount Info */}
        <div className="px-5 sm:px-7 py-3 bg-amber-50/70 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-amber-200">
            <button
              type="button"
              onClick={() => {
                setActiveQrVoucher(null);
                setTab("catalog");
              }}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                tab === "catalog" && !activeQrVoucher
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Productos Reales</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveQrVoucher(null);
                setTab("vouchers");
              }}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                tab === "vouchers" && !activeQrVoucher
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Mis QR y Vales ({vouchers.length})</span>
            </button>
          </div>

          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Tag className="w-4 h-4 text-teal-700" />
            <span>
              Rol: <strong>{activeRole.shortTitle}</strong>
              {discountRate > 0
                ? ` · ${Math.round(discountRate * 100)}% dto.`
                : " · Sube a Comprador para 10% dto."}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          {/* Active Purchase QR Ticket View */}
          {activeQrVoucher ? (
            (() => {
              const brand = BRAND_PARTNERS[activeQrVoucher.brandId];
              return (
                <div className="max-w-lg mx-auto rounded-3xl bg-white border-2 border-emerald-400 shadow-lg overflow-hidden">
                  <div
                    className={`px-5 py-4 ${brand.badgeBg} ${brand.badgeText} flex items-center justify-between`}
                    style={{ borderBottom: `4px solid ${brand.stripeColor}` }}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span className="font-display font-black text-base">
                        {brand.name} · Ticket QR de Compra
                      </span>
                    </div>
                    <span className="font-mono-num text-xs font-bold">
                      {activeQrVoucher.paidCoins} mon.
                    </span>
                  </div>

                  <div className="p-6 flex flex-col items-center text-center space-y-4">
                    {(() => {
                      const prodImg = REAL_WORLD_PRODUCTS.find(
                        (p) => p.id === activeQrVoucher.productId
                      )?.imageSrc;
                      return (
                        <div className="flex items-center gap-3 text-left w-full rounded-2xl bg-amber-50/50 border border-amber-200 p-2.5">
                          {prodImg && (
                            <img
                              src={prodImg}
                              alt={activeQrVoucher.productName}
                              referrerPolicy="no-referrer"
                              className="w-16 h-12 rounded-xl object-cover shrink-0 border border-amber-200"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-emerald-700">
                              ¡Compra confirmada! Muestra este QR en tienda
                            </p>
                            <h3 className="text-base sm:text-lg font-display font-extrabold text-slate-900 truncate">
                              {activeQrVoucher.productName}
                            </h3>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="p-3 rounded-2xl bg-amber-50/70 border-2 border-amber-200">
                      <VoucherQrImage
                        voucher={activeQrVoucher}
                        size={220}
                        onDataUrlReady={setActiveQrDownloadUrl}
                      />
                    </div>

                    <div className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-500">
                        Código de folio:
                      </span>
                      <span className="font-mono-num text-base font-black text-slate-950 tracking-wider">
                        {activeQrVoucher.code}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                      {activeQrVoucher.realWorldNote}
                    </p>

                    <div className="w-full flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      {activeQrDownloadUrl && (
                        <a
                          href={activeQrDownloadUrl}
                          download={`QR-${activeQrVoucher.code}.png`}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-extrabold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-4 h-4" />
                          <span>Descargar QR</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQrVoucher(null);
                          setTab("vouchers");
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>Ver Mis Vales</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQrVoucher(null);
                          setTab("catalog");
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Seguir Comprando</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : tab === "catalog" ? (
            <>
              {/* Brand filter row with OXXO first */}
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(BRAND_PARTNERS) as BrandId[]).map((bId) => {
                  const brand = BRAND_PARTNERS[bId];
                  const active = selectedBrand === bId;
                  return (
                    <button
                      key={bId}
                      type="button"
                      onClick={() => setSelectedBrand(bId)}
                      className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-extrabold border-2 cursor-pointer whitespace-nowrap flex items-center gap-2 transition-transform active:scale-[0.98] ${
                        active
                          ? `${brand.badgeBg} ${brand.badgeText} ${brand.badgeBorder}`
                          : "bg-white text-slate-800 border-slate-200 hover:border-amber-400"
                      }`}
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-black tracking-tight ${brand.badgeBg} ${brand.badgeText}`}
                      >
                        {brand.name}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSelectedBrand("all")}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold border cursor-pointer whitespace-nowrap ${
                    selectedBrand === "all"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  Todas las Marcas
                </button>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleProducts.map((product) => {
                  const brand = BRAND_PARTNERS[product.brandId];
                  const finalPrice = getFinalPrice(product.priceCoins);
                  const canAfford = walletCoins >= finalPrice;

                  return (
                    <article
                      key={product.id}
                      className="group rounded-2xl bg-white border-2 border-slate-200 overflow-hidden flex flex-col justify-between shadow-sm hover:border-amber-400 transition-colors"
                    >
                      <div>
                        <div
                          className={`px-4 py-2.5 ${brand.badgeBg} ${brand.badgeText} flex items-center justify-between gap-2`}
                          style={{
                            borderBottom: `4px solid ${brand.stripeColor}`,
                          }}
                        >
                          <span className="font-display font-black text-base tracking-tight">
                            {brand.name}
                          </span>
                          <span className="text-[11px] font-bold opacity-90">
                            {product.category}
                          </span>
                        </div>

                        <div className="relative aspect-[4/3] w-full bg-amber-50 overflow-hidden border-b border-slate-100">
                          <img
                            src={product.imageSrc}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        <div className="p-4">
                          <h3 className="font-display font-extrabold text-base text-slate-900 leading-snug">
                            {product.name}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                            {product.description}
                          </p>
                          <p className="text-[11px] text-teal-800 font-semibold mt-2.5">
                            {product.realWorldNote}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div>
                          {discountRate > 0 && (
                            <p className="text-[11px] line-through text-slate-400 font-mono-num">
                              {product.priceCoins} monedas
                            </p>
                          )}
                          <p className="font-mono-num text-base font-extrabold text-amber-700 flex items-center gap-1">
                            <Coins className="w-4 h-4" />
                            <span>{finalPrice}</span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePurchase(product)}
                          disabled={!canAfford}
                          className={`min-h-[44px] px-4 py-2 rounded-xl font-display font-extrabold text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                            canAfford
                              ? "bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {canAfford && <QrCode className="w-3.5 h-3.5" />}
                          <span>
                            {canAfford
                              ? "Comprar + QR"
                              : `Faltan ${finalPrice - walletCoins}`}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {vouchers.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center">
                  <QrCode className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                  <h3 className="font-display font-extrabold text-lg text-slate-900">
                    Todavía no tienes códigos QR de compra
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                    Compra cualquier producto de OXXO o marcas aliadas con tus monedas para generar su código QR canjeable en tienda.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vouchers.map((v) => {
                    const brand = BRAND_PARTNERS[v.brandId];
                    return (
                      <div
                        key={v.voucherId}
                        className="rounded-2xl bg-white border-2 border-emerald-300 overflow-hidden shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div
                            className={`px-4 py-2.5 ${brand.badgeBg} ${brand.badgeText} flex items-center justify-between`}
                          >
                            <span className="font-display font-black text-sm">
                              {brand.name} · Vale QR
                            </span>
                            <span className="font-mono-num text-xs font-bold">
                              {v.paidCoins} monedas
                            </span>
                          </div>
                          <div className="p-4 flex items-center gap-3.5">
                            <div className="shrink-0">
                              <VoucherQrImage voucher={v} size={88} />
                            </div>
                            <div className="min-w-0 space-y-1.5">
                              <h4 className="font-display font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                                {v.productName}
                              </h4>
                              <p className="font-mono-num text-xs font-black text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 inline-block">
                                {v.code}
                              </p>
                              <p className="text-[11px] text-slate-600 line-clamp-2">
                                {v.realWorldNote}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="px-4 pb-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveQrDownloadUrl("");
                              setActiveQrVoucher(v);
                            }}
                            className="w-full min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Abrir QR Grande para Caja</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
