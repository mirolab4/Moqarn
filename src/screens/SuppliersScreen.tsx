import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { handleFirestoreError, OperationType } from '../lib/errorHandling.ts';
import { Supplier } from '../types/index.ts';
import { formatArabicTimeAgo, formatCurrency } from '../lib/arabicUtils.ts';
import { Building2, Plus, Phone, Edit2, Trash2, MessageCircle, AlertCircle, Check, Package, X } from 'lucide-react';

interface SuppliersScreenProps {
  onSelectSupplierForImport?: (supplierId: string) => void;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ onSelectSupplierForImport }) => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [minOrder, setMinOrder] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/suppliers`;
    const colRef = collection(db, path);

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setSuppliers(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setMinOrder('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setPhone(supplier.phone);
    setMinOrder(supplier.minOrder ? String(supplier.minOrder) : '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError(null);

    const cleanName = name.trim();
    let cleanPhone = phone.trim().replace(/[\s-]/g, '');

    if (!cleanName) {
      setFormError('يرجى إدخال اسم المورد أو الشركة');
      return;
    }
    if (!cleanPhone) {
      setFormError('يرجى إدخال رقم هاتف واتساب للمورد');
      return;
    }

    // Ensure phone has country code or standard format (e.g. +201... or 01...)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '2' + cleanPhone; // default Egypt +20 prefix for local mobile numbers if missing
    }

    setSaving(true);
    const now = new Date().toISOString();
    const minOrderVal = minOrder ? Math.max(0, parseFloat(minOrder) || 0) : 0;

    try {
      if (editingSupplier) {
        const docRef = doc(db, `users/${currentUser.uid}/suppliers`, editingSupplier.id);
        await updateDoc(docRef, {
          name: cleanName,
          phone: cleanPhone,
          minOrder: minOrderVal,
          updatedAt: now,
        });
      } else {
        const id = 'sup_' + Date.now();
        const docRef = doc(db, `users/${currentUser.uid}/suppliers`, id);
        const newSupplier: Supplier = {
          id,
          userId: currentUser.uid,
          name: cleanName,
          phone: cleanPhone,
          minOrder: minOrderVal,
          itemCount: 0,
          lastUploadAt: null as any,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(docRef, newSupplier);
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingSupplier ? OperationType.UPDATE : OperationType.CREATE, `users/${currentUser.uid}/suppliers`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/suppliers`, id));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/suppliers/${id}`);
    }
  };

  // Seed standard Egyptian / Arab pharmaceutical distributors for quick setup
  const seedDemoSuppliers = async () => {
    if (!currentUser) return;
    setSaving(true);
    const demos = [
      { name: 'الشركة المتحدة للصيادلة (UCP)', phone: '201012345678', minOrder: 1500 },
      { name: 'فارما أوفرسيز (Pharma Overseas)', phone: '201098765432', minOrder: 1000 },
      { name: 'ابن سينا فارما (Ibnsina Pharma)', phone: '201123456789', minOrder: 2000 },
    ];
    const now = new Date().toISOString();

    try {
      for (let i = 0; i < demos.length; i++) {
        const d = demos[i];
        const id = 'sup_demo_' + (Date.now() + i);
        await setDoc(doc(db, `users/${currentUser.uid}/suppliers`, id), {
          id,
          userId: currentUser.uid,
          name: d.name,
          phone: d.phone,
          minOrder: d.minOrder,
          itemCount: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}/suppliers`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-4xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-600" />
            <span>شركات ومستودعات التوزيع</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة الموردين وأرقام هواتفهم لإرسال الطلبيات مباشرة عبر واتساب
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="py-2.5 px-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>إضافة مورد</span>
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">جاري تحميل قائمة الموردين...</p>
        </div>
      ) : suppliers.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">لم يتم إضافة أي موردين حتى الآن</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
            أضف الموردين ومستودعات الأدوية التي تتعامل معها لتتمكن من استيراد قوائم أسعارهم ومقارنتها تلقائياً.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={openAddModal}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-colors"
            >
              + إضافة أول مورد
            </button>
            <button
              onClick={seedDemoSuppliers}
              disabled={saving}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
            >
              إضافة موردين تجريبيين مقترحين
            </button>
          </div>
        </div>
      ) : (
        /* Suppliers List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {sup.name.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-tight">{sup.name}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 dir-ltr text-right inline-block">
                        {sup.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(sup)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="تعديل المورد"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(sup.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="حذف المورد"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info tags */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg">
                    <Package className="w-3 h-3 text-slate-400" />
                    <span>{sup.itemCount || 0} صنف مسجل</span>
                  </span>
                  {sup.minOrder ? (
                    <span className="bg-amber-50 text-amber-800 font-medium px-2 py-0.5 rounded-lg border border-amber-200/50">
                      حد أدنى للطلب: {formatCurrency(sup.minOrder)}
                    </span>
                  ) : null}
                  {sup.lastUploadAt ? (
                    <span className="text-slate-400">
                      آخر تحديث: {formatArabicTimeAgo(sup.lastUploadAt)}
                    </span>
                  ) : (
                    <span className="text-slate-400">لم تُرفع قائمة بعد</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  href={`https://wa.me/${sup.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>محادثة واتساب</span>
                </a>

                {onSelectSupplierForImport && (
                  <button
                    onClick={() => onSelectSupplierForImport(sup.id)}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-semibold transition-colors"
                  >
                    استيراد قائمة أسعار
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 text-center shadow-xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">حذف المورد</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              هل أنت متأكد من حذف هذا المورد؟ لن يتم حذف الأدوية المستوردة سابقاً تلقائياً.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="py-2 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 text-right relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 left-5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 mb-1">
              {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة شركة أو مورد جديد'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              أدخل اسم المورد ورقم الواتساب لاستقبال طلبيات الأدوية
            </p>

            {formError && (
              <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المورد / الشركة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: المتحدة للأدوية / فارما أوفرسيز"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الواتساب <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="01012345678 أو 201012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-left font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  سيتم فتح محادثة الواتساب بهذا الرقم تلقائياً عند إرسال الطلبية
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الحد الأدنى للطلب (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="مثال: 1500"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  يُنبهك التطبيق في سلة الطلب إذا كان إجمالي طلبيتك من هذا المورد أقل من هذا الحد
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2.5 px-5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-60 flex items-center gap-1.5"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>{editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
