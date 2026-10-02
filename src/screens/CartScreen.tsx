import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { handleFirestoreError, OperationType } from '../lib/errorHandling.ts';
import { CartItem } from '../types/index.ts';
import { formatCurrency } from '../lib/arabicUtils.ts';
import {
  ShoppingBag, Trash2, Plus, Minus, MessageCircle, AlertCircle, CheckCircle,
  Building2, ArrowRight, ShieldAlert, Sparkles
} from 'lucide-react';

interface CartScreenProps {
  onNavigateToSearch?: () => void;
  onNavigateToImport?: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({ onNavigateToSearch, onNavigateToImport }) => {
  const { currentUser, profile } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Two-tap delete confirmation state: key is itemId
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Auto-reset delete confirmation after 3 seconds
  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => {
      setConfirmDeleteId(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  useEffect(() => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/cart`;
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: CartItem[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setCartItems(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Update quantity
  const handleUpdateQuantity = async (item: CartItem, delta: number) => {
    if (!currentUser) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      handleDeleteItem(item.id);
      return;
    }

    try {
      const docRef = doc(db, `users/${currentUser.uid}/cart`, item.id);
      await updateDoc(docRef, {
        quantity: newQty,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}/cart/${item.id}`);
    }
  };

  // Two-tap delete handler:
  // First tap sets confirmDeleteId. Second tap deletes!
  const handleDeleteItem = async (itemId: string) => {
    if (!currentUser) return;

    if (confirmDeleteId !== itemId) {
      // First tap: prompt confirmation
      setConfirmDeleteId(itemId);
      return;
    }

    // Second tap: perform deletion
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/cart`, itemId));
      setConfirmDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/cart/${itemId}`);
    }
  };

  // Group items by supplier
  const groupedBySupplier: Record<string, { supplierName: string; supplierPhone: string; minOrder?: number; items: CartItem[] }> = {};

  for (const item of cartItems) {
    if (!groupedBySupplier[item.supplierId]) {
      groupedBySupplier[item.supplierId] = {
        supplierName: item.supplierName,
        supplierPhone: item.supplierPhone,
        minOrder: item.supplierMinOrder,
        items: [],
      };
    }
    groupedBySupplier[item.supplierId].items.push(item);
  }

  // Generate formatted Arabic WhatsApp order message
  const generateWhatsAppLink = (supplierName: string, phone: string, items: CartItem[], total: number) => {
    const pharmacyName = profile?.pharmacyName || 'الصيدلية';
    const today = new Date().toLocaleDateString('ar-EG');

    let text = `*طلب أدوية جديد*\n`;
    text += `*من صيدلية:* ${pharmacyName}\n`;
    text += `*إلى السادة:* ${supplierName}\n`;
    text += `*التاريخ:* ${today}\n`;
    text += `----------------------------------------\n`;
    text += `*الأصناف والكميات المطلوبة:*\n`;

    items.forEach((it, idx) => {
      text += `${idx + 1}. *${it.drugName}*\n`;
      text += `   - الكمية: ${it.quantity} علبة\n`;
      text += `   - السعر الفعلي المتوقع: ${formatCurrency(it.effectivePrice)}\n`;
      if (it.bonusText && it.bonusText !== '0') {
        text += `   - شروط البونص: ${it.bonusText}\n`;
      }
      text += `   - الإجمالي للصنف: ${formatCurrency(it.quantity * it.effectivePrice)}\n`;
    });

    text += `----------------------------------------\n`;
    text += `*إجمالي قيمة الطلبية:* ${formatCurrency(total)}\n`;
    text += `----------------------------------------\n`;
    text += `يرجى تأكيد استلام الطلبية والتوافر وتجهيزها في أقرب وقت.\nشكراً جزيلاً لتعاونكم.`;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div className="pb-24 pt-16 text-center">
        <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">جاري تحميل سلة الطلبات...</p>
      </div>
    );
  }

  const supplierEntries = Object.entries(groupedBySupplier);

  return (
    <div className="pb-28 pt-4 px-4 max-w-4xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-600" />
            <span>سلة الطلبات المجمعة</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            الأصناف مقسمة تلقائياً حسب المورد لإرسال كل طلبية بضغطة واحدة عبر واتساب
          </p>
        </div>

        {cartItems.length > 0 && (
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
            {cartItems.length} صنف مضاف
          </span>
        )}
      </div>

      {cartItems.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <ShoppingBag className="w-8 h-8 stroke-[1.8]" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">سلة الطلبات فارغة حالياً</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            ابحث عن الأدوية التي تحتاجها وقارن بين أسعار الموردين، ثم أضفها إلى السلة لتجهيز طلبيات الواتساب بسهولة.
          </p>
          <div className="space-y-2">
            {onNavigateToSearch && (
              <button
                onClick={onNavigateToSearch}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-colors"
              >
                الانتقال للبحث عن الأدوية ومقارنة الأسعار
              </button>
            )}
            {onNavigateToImport && (
              <button
                onClick={onNavigateToImport}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                استيراد قوائم أسعار جديدة
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Grouped Suppliers Orders */
        <div className="space-y-5">
          {supplierEntries.map(([supplierId, group]) => {
            const supplierTotal = group.items.reduce(
              (acc, it) => acc + (it.quantity * it.effectivePrice),
              0
            );
            const minOrder = group.minOrder || 0;
            const isMinOrderMet = minOrder <= 0 || supplierTotal >= minOrder;
            const diffMinOrder = minOrder - supplierTotal;

            const waLink = generateWhatsAppLink(
              group.supplierName,
              group.supplierPhone,
              group.items,
              supplierTotal
            );

            return (
              <div
                key={supplierId}
                className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4"
              >
                {/* Supplier Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 leading-tight">
                        {group.supplierName}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 dir-ltr text-right inline-block">
                        واتساب: {group.supplierPhone}
                      </p>
                    </div>
                  </div>

                  {/* Supplier Subtotal Badge */}
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 block">إجمالي طلبية المورد:</span>
                    <span className="text-base font-extrabold text-emerald-700 font-mono">
                      {formatCurrency(supplierTotal)}
                    </span>
                  </div>
                </div>

                {/* Minimum order indicator */}
                {minOrder > 0 && (
                  <div
                    className={`p-2.5 rounded-2xl text-xs flex items-center gap-2 ${
                      isMinOrderMet
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                        : 'bg-amber-50 text-amber-900 border border-amber-200/70'
                    }`}
                  >
                    {isMinOrderMet ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>تم الوصول للحد الأدنى للطلب ({formatCurrency(minOrder)}) ✅</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          متبقي <strong>{formatCurrency(diffMinOrder)}</strong> للوصول للحد الأدنى للطلب ({formatCurrency(minOrder)})
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Items in this group */}
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => {
                    const isConfirming = confirmDeleteId === item.id;
                    const itemTotal = item.quantity * item.effectivePrice;

                    return (
                      <div
                        key={item.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Drug Name & Price details */}
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-800 leading-tight">
                            {item.drugName}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-emerald-700 font-mono">
                              {formatCurrency(item.effectivePrice)} / علبة
                            </span>
                            {item.price > item.effectivePrice && (
                              <span className="text-[11px] text-slate-400 line-through font-mono">
                                {formatCurrency(item.price)}
                              </span>
                            )}
                            {item.bonusText && item.bonusText !== '0' && (
                              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                                بونص {item.bonusText}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Controls & Delete & Subtotal */}
                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          {/* Quantity stepper */}
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                              onClick={() => handleUpdateQuantity(item, -1)}
                              className="w-8 h-8 rounded-lg bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center font-bold active:scale-95 shadow-2xs"
                              title="تقليل الكمية"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-10 text-center text-xs font-bold font-mono text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item, 1)}
                              className="w-8 h-8 rounded-lg bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center font-bold active:scale-95 shadow-2xs"
                              title="زيادة الكمية"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Item Subtotal */}
                          <div className="min-w-[80px] text-left">
                            <span className="text-xs font-bold text-slate-800 font-mono block">
                              {formatCurrency(itemTotal)}
                            </span>
                          </div>

                          {/* Two-Tap Delete Button */}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                              isConfirming
                                ? 'bg-rose-600 text-white shadow-sm animate-pulse'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isConfirming ? 'انقر مجدداً لتأكيد الحذف' : 'حذف الصنف (يتطلب نقرتين)'}
                          >
                            <Trash2 className="w-4 h-4" />
                            {isConfirming && <span>تأكيد؟</span>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* WhatsApp Send Button */}
                <div className="pt-2">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>إرسال طلبية {group.supplierName} عبر واتساب ({formatCurrency(supplierTotal)})</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
