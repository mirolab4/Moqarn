import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { handleFirestoreError, OperationType } from '../lib/errorHandling.ts';
import { Drug, Supplier, CartItem } from '../types/index.ts';
import {
  normalizeArabic, matchDrugSearch, formatArabicTimeAgo, formatCurrency
} from '../lib/arabicUtils.ts';
import {
  Search, X, ShoppingBag, ChevronDown, ChevronUp, Check, Sparkles, Building2,
  Clock, ArrowUpDown, Tag, Percent, Plus, AlertCircle, TrendingDown, HelpCircle
} from 'lucide-react';

interface HomeScreenProps {
  onNavigateToImport?: () => void;
  onNavigateToCart?: () => void;
}

interface GroupedDrugResult {
  groupKey: string;
  displayName: string;
  cheapest: Drug;
  others: Drug[];
  totalSuppliers: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToImport, onNavigateToCart }) => {
  const { currentUser } = useAuth();
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, Supplier>>({});
  const [loading, setLoading] = useState(true);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'cheapest' | 'newest'>('cheapest');

  // Expanded cards: set of groupKeys
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Adding to cart animation feedback: drugId -> boolean
  const [addingDrugId, setAddingDrugId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Load suppliers for WhatsApp info and minOrder
  useEffect(() => {
    if (!currentUser) return;
    const supPath = `users/${currentUser.uid}/suppliers`;
    const unsubscribeSup = onSnapshot(
      collection(db, supPath),
      (snapshot) => {
        const map: Record<string, Supplier> = {};
        snapshot.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as any) };
        });
        setSuppliers(map);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, supPath);
      }
    );

    const drugsPath = `users/${currentUser.uid}/drugs`;
    const unsubscribeDrugs = onSnapshot(
      collection(db, drugsPath),
      (snapshot) => {
        const list: Drug[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setDrugs(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, drugsPath);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeSup();
      unsubscribeDrugs();
    };
  }, [currentUser]);

  // Group and sort drugs by normalized drug name
  const groupedResults = useMemo(() => {
    // 1. Filter drugs by search query and optional supplier filter
    const filtered = drugs.filter((drug) => {
      if (selectedSupplierFilter !== 'all' && drug.supplierId !== selectedSupplierFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const { matches } = matchDrugSearch(drug.name, searchQuery);
      return matches;
    });

    // 2. Group items that represent the same medicine
    const groups: Record<string, Drug[]> = {};

    for (const d of filtered) {
      // Group key uses normalized Arabic name
      const key = normalizeArabic(d.name);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(d);
    }

    // 3. Format into GroupedDrugResult
    const results: GroupedDrugResult[] = [];

    for (const [key, items] of Object.entries(groups)) {
      // Sort items within group: cheapest effective price first
      items.sort((a, b) => a.effectivePrice - b.effectivePrice);

      const cheapest = items[0];
      const others = items.slice(1);

      results.push({
        groupKey: key,
        displayName: cheapest.name,
        cheapest,
        others,
        totalSuppliers: items.length,
      });
    }

    // Sort groups
    if (sortBy === 'cheapest') {
      results.sort((a, b) => a.cheapest.effectivePrice - b.cheapest.effectivePrice);
    } else {
      results.sort((a, b) => (b.cheapest.updatedAt || '').localeCompare(a.cheapest.updatedAt || ''));
    }

    return results;
  }, [drugs, searchQuery, selectedSupplierFilter, sortBy]);

  // Toggle show more suppliers
  const toggleGroupExpand = (key: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Add item to cart
  const handleAddToCart = async (drug: Drug, qty: number = 1) => {
    if (!currentUser) return;
    setAddingDrugId(drug.id);

    try {
      const sup = suppliers[drug.supplierId];
      const cartItemId = `cart_${drug.supplierId}_${drug.id}`;
      const docRef = doc(db, `users/${currentUser.uid}/cart`, cartItemId);

      const snap = await getDoc(docRef);
      const now = new Date().toISOString();

      if (snap.exists()) {
        const currentQty = snap.data().quantity || 1;
        await updateDoc(docRef, {
          quantity: currentQty + qty,
          updatedAt: now,
        });
      } else {
        const newCartItem: CartItem = {
          id: cartItemId,
          userId: currentUser.uid,
          drugId: drug.id,
          drugName: drug.name,
          supplierId: drug.supplierId,
          supplierName: drug.supplierName,
          supplierPhone: sup?.phone || '201000000000',
          supplierMinOrder: sup?.minOrder || 0,
          quantity: qty,
          price: drug.price,
          effectivePrice: drug.effectivePrice,
          bonusText: drug.bonusText,
          discount: drug.discount,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(docRef, newCartItem);
      }

      setToastMsg(`تمت إضافة "${drug.name}" من ${drug.supplierName} إلى السلة!`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/cart`);
    } finally {
      setTimeout(() => setAddingDrugId(null), 400);
    }
  };

  const sampleSearchQueries = ['Panadol', 'Augmentin', 'كونكور', 'أوميجا 3', 'فيتامين سي', 'سيتال'];

  return (
    <div className="pb-28 pt-3 px-4 max-w-4xl mx-auto">
      {/* Toast feedback */}
      {toastMsg && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto bg-emerald-800 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-emerald-600 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          {onNavigateToCart && (
            <button
              onClick={onNavigateToCart}
              className="text-amber-300 hover:text-amber-200 underline text-xs font-semibold mr-2"
            >
              عرض السلة
            </button>
          )}
        </div>
      )}

      {/* Large Search Bar */}
      <div className="relative mb-3">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-slate-400 absolute right-4 pointer-events-none" />
          <input
            type="text"
            placeholder="ابحث باسم الدواء (عربي أو إنجليزي، مثل بنادول أو Panadol)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-10 py-3.5 rounded-2xl bg-white border-2 border-slate-200/90 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 text-sm font-semibold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-normal"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              title="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Search Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
        <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">أمثلة سريعة:</span>
        {sampleSearchQueries.map((q) => (
          <button
            key={q}
            onClick={() => setSearchQuery(q)}
            className="py-1 px-2.5 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 text-xs font-medium whitespace-nowrap transition-colors border border-slate-200/60"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Filter and Sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-white/70 p-2.5 rounded-2xl border border-slate-200/80 text-xs">
        {/* Supplier filter */}
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedSupplierFilter}
            onChange={(e) => setSelectedSupplierFilter(e.target.value)}
            className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">كل الموردين ({Object.keys(suppliers).length})</option>
            {Object.values(suppliers).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="cheapest">الأرخص سعراً أولاً</option>
            <option value="newest">الأحدث تحديثاً</option>
          </select>
        </div>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">جاري تحميل الأسعار...</p>
        </div>
      ) : drugs.length === 0 ? (
        /* No Drugs in Database */
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <Tag className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">لا توجد قوائم أسعار مسجلة بعد</h3>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            ابدأ باستيراد قوائم أسعار الموردين (ملفات إكسل، PDF، أو صور فواتير ورسائل واتساب) للمقارنة الفورية بين الأسعار.
          </p>
          {onNavigateToImport && (
            <button
              onClick={onNavigateToImport}
              className="py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              استيراد أول قائمة أسعار الآن
            </button>
          )}
        </div>
      ) : groupedResults.length === 0 ? (
        /* No match for query */
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">لم يتم العثور على أدوية مطابقة</h3>
          <p className="text-xs text-slate-500 mb-4">
            تأكد من كتابة الاسم بصيغة أخرى، أو جرّب البحث بالاسم العلمي أو بالإنجليزية.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedSupplierFilter('all'); }}
            className="py-2 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
          >
            عرض كافة الأدوية المتاحة
          </button>
        </div>
      ) : (
        /* Drug Results Cards */
        <div className="space-y-3.5">
          <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center justify-between">
            <span>تم العثور على <strong className="text-slate-800">{groupedResults.length}</strong> صنف دوائي:</span>
            {searchQuery && (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                تطابق ذكي عربي / إنجليزي
              </span>
            )}
          </div>

          {groupedResults.map((result) => {
            const isExpanded = Boolean(expandedGroups[result.groupKey]);
            const cheapest = result.cheapest;
            const isAdding = addingDrugId === cheapest.id;

            return (
              <div
                key={result.groupKey}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-emerald-300"
              >
                {/* Main Drug Header & Cheapest Supplier Card */}
                <div className="p-4 sm:p-5">
                  {/* Drug Name Bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {result.displayName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400 font-medium">
                          متوفر لدى {result.totalSuppliers} موردين
                        </span>
                        {cheapest.expiry && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            صلاحية: {cheapest.expiry}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cheapest Supplier Highlighted Box */}
                  <div className="bg-emerald-50/60 rounded-2xl p-3.5 border-2 border-emerald-500/80 shadow-xs relative">
                    {/* Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white flex items-center gap-1 shadow-2xs">
                          <TrendingDown className="w-3 h-3 stroke-[2.5]" />
                          <span>أرخص سعر مورد</span>
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {cheapest.supplierName}
                        </span>
                      </div>

                      {/* Age of price */}
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatArabicTimeAgo(cheapest.updatedAt)}</span>
                      </span>
                    </div>

                    {/* Price & Effective Price */}
                    <div className="flex items-end justify-between gap-2 pt-1">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-emerald-800 font-mono tracking-tight">
                            {formatCurrency(cheapest.effectivePrice)}
                          </span>
                          <span className="text-xs font-bold text-emerald-700">
                            السعر الفعلي
                          </span>
                        </div>

                        {/* Original price & terms */}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                          {cheapest.price > cheapest.effectivePrice && (
                            <span className="text-slate-400 line-through font-mono text-[11px]">
                              الأساسي: {formatCurrency(cheapest.price)}
                            </span>
                          )}
                          {cheapest.discount > 0 && (
                            <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                              خصم {cheapest.discount}%
                            </span>
                          )}
                          {cheapest.bonusText && cheapest.bonusText !== '0' && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                              بونص {cheapest.bonusText}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add to Order button */}
                      <button
                        onClick={() => handleAddToCart(cheapest, 1)}
                        disabled={isAdding}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition-all shrink-0"
                      >
                        {isAdding ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>إضافة للطلب</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Show more toggle button */}
                  {result.others.length > 0 && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={() => toggleGroupExpand(result.groupKey)}
                        className="py-1.5 px-3 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                      >
                        <span>
                          {isExpanded
                            ? 'إخفاء باقي الموردين'
                            : `عرض باقي الموردين لهذا الدواء (${result.others.length})`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Collapsed Other Suppliers Panel */}
                {isExpanded && result.others.length > 0 && (
                  <div className="bg-slate-50/70 border-t border-slate-100 p-4 space-y-2.5 animate-in fade-in">
                    <p className="text-[11px] font-bold text-slate-500 mb-2">
                      مقارنة الأسعار مع الموردين الآخرين:
                    </p>

                    {result.others.map((other) => {
                      const priceDiff = other.effectivePrice - cheapest.effectivePrice;
                      const isOtherAdding = addingDrugId === other.id;

                      return (
                        <div
                          key={other.id}
                          className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                {other.supplierName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatArabicTimeAgo(other.updatedAt)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-sm font-bold text-slate-800 font-mono">
                                {formatCurrency(other.effectivePrice)}
                              </span>
                              {priceDiff > 0 && (
                                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-mono">
                                  + {formatCurrency(priceDiff)} أغلى
                                </span>
                              )}
                              {other.price > other.effectivePrice && (
                                <span className="text-[10px] text-slate-400 line-through font-mono">
                                  الأساسي: {formatCurrency(other.price)}
                                </span>
                              )}
                              {other.bonusText && other.bonusText !== '0' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded">
                                  بونص {other.bonusText}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddToCart(other, 1)}
                            disabled={isOtherAdding}
                            className="py-1.5 px-3 rounded-xl border border-slate-200 hover:border-emerald-600 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 shrink-0"
                          >
                            {isOtherAdding ? (
                              <div className="w-3.5 h-3.5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>طلب من {other.supplierName}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
