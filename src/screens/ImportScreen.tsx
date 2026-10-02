import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { collection, onSnapshot, doc, writeBatch, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { handleFirestoreError, OperationType } from '../lib/errorHandling.ts';
import { Supplier, ReviewDrugItem, ExcelColumnMapping } from '../types/index.ts';
import { normalizeArabic, calculateEffectivePrice, parseBonusString, formatCurrency } from '../lib/arabicUtils.ts';
import {
  UploadCloud, FileSpreadsheet, FileText, Image as ImageIcon, PlusCircle,
  AlertTriangle, Check, Trash2, Edit3, ArrowRight, Save, RefreshCw, Sparkles, HelpCircle, CheckCircle2
} from 'lucide-react';

interface ImportScreenProps {
  initialSupplierId?: string;
  onImportComplete?: () => void;
  onNavigateToSuppliers?: () => void;
}

type InputMethod = 'excel' | 'pdf' | 'image_text' | 'manual';

export const ImportScreen: React.FC<ImportScreenProps> = ({
  initialSupplierId,
  onImportComplete,
  onNavigateToSuppliers
}) => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || '');
  const [inputMethod, setInputMethod] = useState<InputMethod>('excel');

  // Loading & Processing states
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Review table items
  const [reviewItems, setReviewItems] = useState<ReviewDrugItem[]>([]);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // Excel mapping state
  const [excelRawRows, setExcelRawRows] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelMapping, setExcelMapping] = useState<ExcelColumnMapping>({
    drugNameCol: '',
    priceCol: '',
    bonusCol: '',
    discountCol: '',
    expiryCol: '',
  });
  const [showMappingSelector, setShowMappingSelector] = useState(false);
  const [saveMappingAsTemplate, setSaveMappingAsTemplate] = useState(true);

  // Image + Pasted text state
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState<string>('');

  // PDF state
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);

  // Manual single item state
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualDiscount, setManualDiscount] = useState('0');
  const [manualBonus, setManualBonus] = useState('');
  const [manualExpiry, setManualExpiry] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch suppliers
  useEffect(() => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/suppliers`;
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setSuppliers(list);
        if (!selectedSupplierId && list.length > 0) {
          setSelectedSupplierId(list[0].id);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Load saved template when supplier changes
  useEffect(() => {
    if (!selectedSupplierId) return;
    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    if (sup?.columnMapping) {
      try {
        const saved = JSON.parse(sup.columnMapping);
        setExcelMapping(saved);
      } catch (e) {
        // ignore
      }
    }
  }, [selectedSupplierId, suppliers]);

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // Fuzzy header detection
  const detectHeaders = (headers: string[]): ExcelColumnMapping => {
    const mapping: ExcelColumnMapping = {
      drugNameCol: '',
      priceCol: '',
      bonusCol: '',
      discountCol: '',
      expiryCol: '',
    };

    const normHeaders = headers.map((h) => ({
      orig: h,
      norm: normalizeArabic(h).toLowerCase(),
    }));

    // Detect Drug Name
    const nameMatches = ['اسم الصنف', 'الصنف', 'الدواء', 'اسم الدواء', 'الاسم', 'المستحضر', 'name', 'item', 'drug', 'medicine', 'product', 'description'];
    for (const match of nameMatches) {
      const found = normHeaders.find((h) => h.norm.includes(normalizeArabic(match)));
      if (found) {
        mapping.drugNameCol = found.orig;
        break;
      }
    }

    // Detect Price
    const priceMatches = ['سعر الشراء', 'سعر الصيدلي', 'السعر', 'سعر', 'سعر الجمهور', 'price', 'cost', 'rate', 'unit price', 'wholesale'];
    for (const match of priceMatches) {
      const found = normHeaders.find((h) => h.norm.includes(normalizeArabic(match)));
      if (found && found.orig !== mapping.drugNameCol) {
        mapping.priceCol = found.orig;
        break;
      }
    }

    // Detect Bonus
    const bonusMatches = ['بونص', 'البونص', 'مجاني', 'bonus', 'free', 'scheme'];
    for (const match of bonusMatches) {
      const found = normHeaders.find((h) => h.norm.includes(normalizeArabic(match)));
      if (found) {
        mapping.bonusCol = found.orig;
        break;
      }
    }

    // Detect Discount
    const discMatches = ['نسبة الخصم', 'الخصم', 'خصم', 'discount', 'disc', '%'];
    for (const match of discMatches) {
      const found = normHeaders.find((h) => h.norm.includes(normalizeArabic(match)));
      if (found && found.orig !== mapping.priceCol) {
        mapping.discountCol = found.orig;
        break;
      }
    }

    // Detect Expiry
    const expMatches = ['تاريخ الصلاحية', 'الصلاحية', 'انتهاء', 'اكسباير', 'expiry', 'exp', 'validity'];
    for (const match of expMatches) {
      const found = normHeaders.find((h) => h.norm.includes(normalizeArabic(match)));
      if (found) {
        mapping.expiryCol = found.orig;
        break;
      }
    }

    return mapping;
  };

  // Handle Excel file upload
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setProcessing(true);
    setProcessingStatus('جاري قراءة ملف الإكسل...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

      if (rawData.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف صالحة.');
      }

      const headers = Object.keys(rawData[0] || {});
      setExcelHeaders(headers);
      setExcelRawRows(rawData);

      // Check if supplier already has a saved template matching these headers
      let chosenMapping: ExcelColumnMapping;
      if (selectedSupplier?.columnMapping) {
        try {
          chosenMapping = JSON.parse(selectedSupplier.columnMapping);
        } catch {
          chosenMapping = detectHeaders(headers);
        }
      } else {
        chosenMapping = detectHeaders(headers);
      }

      setExcelMapping(chosenMapping);
      setShowMappingSelector(true);
      setProcessing(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء قراءة ملف الإكسل');
      setProcessing(false);
    }
  };

  // Apply Excel mapping and create review list
  const applyExcelMappingToReview = () => {
    if (!excelMapping.drugNameCol || !excelMapping.priceCol) {
      setErrorMsg('يرجى تحديد عمود اسم الدواء وعمود السعر على الأقل.');
      return;
    }

    const items: ReviewDrugItem[] = [];

    for (const row of excelRawRows) {
      const name = String(row[excelMapping.drugNameCol] || '').trim();
      const rawPrice = parseFloat(String(row[excelMapping.priceCol] || '0').replace(/[^0-9.]/g, '')) || 0;
      if (!name || rawPrice <= 0) continue;

      const rawDiscount = excelMapping.discountCol ? parseFloat(String(row[excelMapping.discountCol] || '0').replace(/[^0-9.]/g, '')) || 0 : 0;
      const rawBonusStr = excelMapping.bonusCol ? String(row[excelMapping.bonusCol] || '') : '';
      const { buy, free, text } = parseBonusString(rawBonusStr);
      const expiry = excelMapping.expiryCol ? String(row[excelMapping.expiryCol] || '').trim() : '';

      const effectivePrice = calculateEffectivePrice(rawPrice, rawDiscount, buy, free);

      items.push({
        name,
        price: rawPrice,
        discount: rawDiscount,
        bonusBuy: buy,
        bonusFree: free,
        bonusText: text,
        effectivePrice,
        expiry,
        uncertain: false,
      });
    }

    if (items.length === 0) {
      setErrorMsg('لم يتم العثور على أدوية صالحة بالأسعار المحددة. يرجى مراجعة تحديد الأعمدة.');
      return;
    }

    setReviewItems(items);
    setShowMappingSelector(false);
    setIsReviewing(true);
    setSuccessMsg(`تم استخراج ${items.length} صنف بنجاح! راجع الجدول أدناه قبل الحفظ.`);
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle PDF Extraction with Gemini
  const handlePdfExtract = async () => {
    if (!selectedPdfFile) {
      setErrorMsg('يرجى اختيار ملف PDF أولاً');
      return;
    }

    setErrorMsg(null);
    setProcessing(true);
    setProcessingStatus('جاري استخراج بيانات الأدوية والأسعار عبر نموذج الذكاء الاصطناعي (Gemini)...');

    try {
      const base64Data = await fileToBase64(selectedPdfFile);

      const res = await fetch('/api/gemini/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf: {
            mimeType: selectedPdfFile.type || 'application/pdf',
            data: base64Data,
          },
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'فشل الاستخراج عبر الذكاء الاصطناعي');
      }

      const extracted: ReviewDrugItem[] = data.items || [];
      if (extracted.length === 0) {
        throw new Error('لم يتمكن النموذج من التعرف على أصناف دوائية في هذا الملف.');
      }

      setReviewItems(extracted);
      setIsReviewing(true);
      setSuccessMsg(`تم استخراج ${extracted.length} صنف عبر الذكاء الاصطناعي بنجاح! يرجى مراجعة الجدول والتأكد من الخلايا.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء معالجة ملف PDF');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Image + Pasted Text Extraction with Gemini
  const handleImageAndTextExtract = async () => {
    if (!selectedImageFile && !pastedText.trim()) {
      setErrorMsg('يرجى رفع صورة قائمة الأسعار أو لصق نص الرسالة على الأقل');
      return;
    }

    setErrorMsg(null);
    setProcessing(true);
    setProcessingStatus('جاري تحليل الصورة ونص الرسالة واستخراج الأسعار والبونص عبر Gemini...');

    try {
      const imagesPayload: Array<{ mimeType: string; data: string }> = [];

      if (selectedImageFile) {
        const base64Data = await fileToBase64(selectedImageFile);
        imagesPayload.push({
          mimeType: selectedImageFile.type || 'image/jpeg',
          data: base64Data,
        });
      }

      const res = await fetch('/api/gemini/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesPayload,
          pastedText: pastedText.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'فشل الاستخراج عبر الذكاء الاصطناعي');
      }

      const extracted: ReviewDrugItem[] = data.items || [];
      if (extracted.length === 0) {
        throw new Error('لم يتم العثور على أدوية أو أسعار في الصورة والنص المقدم.');
      }

      setReviewItems(extracted);
      setIsReviewing(true);
      setSuccessMsg(`تم استخراج ${extracted.length} صنف بنجاح! راجع الجدول أدناه (الخلايا الصفراء تحتاج تدقيقك).`);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تحليل الصورة والنص');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Single Manual Item Entry
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setErrorMsg('يرجى إدخال اسم الدواء');
      return;
    }
    const price = parseFloat(manualPrice) || 0;
    if (price <= 0) {
      setErrorMsg('يرجى إدخال سعر صحيح للدواء');
      return;
    }

    const discount = Math.max(0, Math.min(100, parseFloat(manualDiscount) || 0));
    const { buy, free, text } = parseBonusString(manualBonus);
    const effectivePrice = calculateEffectivePrice(price, discount, buy, free);

    const newItem: ReviewDrugItem = {
      name: manualName.trim(),
      price,
      discount,
      bonusBuy: buy,
      bonusFree: free,
      bonusText: text,
      effectivePrice,
      expiry: manualExpiry.trim(),
      uncertain: false,
    };

    setReviewItems([newItem, ...reviewItems]);
    setIsReviewing(true);
    setManualName('');
    setManualPrice('');
    setManualDiscount('0');
    setManualBonus('');
    setManualExpiry('');
    setSuccessMsg('تمت إضافة الصنف إلى جدول المراجعة بنجاح!');
  };

  // Modify cell inline in Review Table
  const updateReviewItem = (index: number, field: keyof ReviewDrugItem, val: any) => {
    const updated = [...reviewItems];
    const item = { ...updated[index] };

    if (field === 'price' || field === 'discount') {
      const num = Math.max(0, parseFloat(val) || 0);
      (item as any)[field] = num;
      item.effectivePrice = calculateEffectivePrice(item.price, item.discount, item.bonusBuy, item.bonusFree);
    } else if (field === 'bonusText') {
      const { buy, free, text } = parseBonusString(String(val));
      item.bonusBuy = buy;
      item.bonusFree = free;
      item.bonusText = text;
      item.effectivePrice = calculateEffectivePrice(item.price, item.discount, buy, free);
    } else {
      (item as any)[field] = val;
    }

    updated[index] = item;
    setReviewItems(updated);
  };

  const removeReviewItem = (index: number) => {
    setReviewItems(reviewItems.filter((_, i) => i !== index));
  };

  const addNewBlankReviewRow = () => {
    const blank: ReviewDrugItem = {
      name: 'صنف جديد',
      price: 10,
      discount: 0,
      bonusBuy: 0,
      bonusFree: 0,
      bonusText: '0',
      effectivePrice: 10,
      expiry: '',
      uncertain: true,
    };
    setReviewItems([...reviewItems, blank]);
  };

  // Commit and Save to Firestore:
  // "Uploading a new list for a supplier replaces that supplier's previous list."
  const handleSaveToDatabase = async () => {
    if (!currentUser || !selectedSupplierId || !selectedSupplier) {
      setErrorMsg('يرجى اختيار المورد أولاً');
      return;
    }
    if (reviewItems.length === 0) {
      setErrorMsg('لا توجد أصناف لحفظها');
      return;
    }

    setProcessing(true);
    setProcessingStatus(`جاري استبدال وحفظ ${reviewItems.length} صنف في قاعدة البيانات...`);
    setErrorMsg(null);

    try {
      // 1. Find and delete previous drugs of this supplier for this user
      const drugsCol = collection(db, `users/${currentUser.uid}/drugs`);
      const q = query(drugsCol, where('supplierId', '==', selectedSupplierId));
      const oldSnap = await getDocs(q);

      const now = new Date().toISOString();

      // Chunk operations to respect Firestore batch limit (500)
      const chunkSize = 400;
      const oldDocIds = oldSnap.docs.map((d) => d.id);

      for (let i = 0; i < oldDocIds.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = oldDocIds.slice(i, i + chunkSize);
        chunk.forEach((id) => {
          batch.delete(doc(db, `users/${currentUser.uid}/drugs`, id));
        });
        await batch.commit();
      }

      // 2. Insert new drug records in batches
      for (let i = 0; i < reviewItems.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = reviewItems.slice(i, i + chunkSize);

        chunk.forEach((item, idx) => {
          const docId = `drug_${selectedSupplierId}_${Date.now()}_${i + idx}`;
          const docRef = doc(db, `users/${currentUser.uid}/drugs`, docId);

          batch.set(docRef, {
            id: docId,
            userId: currentUser.uid,
            supplierId: selectedSupplierId,
            supplierName: selectedSupplier.name,
            name: item.name.trim(),
            normalizedName: normalizeArabic(item.name.trim()),
            price: item.price,
            discount: item.discount,
            bonusBuy: item.bonusBuy,
            bonusFree: item.bonusFree,
            bonusText: item.bonusText,
            effectivePrice: item.effectivePrice,
            expiry: item.expiry || '',
            uncertain: Boolean(item.uncertain),
            updatedAt: now,
          });
        });

        await batch.commit();
      }

      // 3. Update supplier record
      const supRef = doc(db, `users/${currentUser.uid}/suppliers`, selectedSupplierId);
      const updateData: any = {
        itemCount: reviewItems.length,
        lastUploadAt: now,
        updatedAt: now,
      };

      if (inputMethod === 'excel' && saveMappingAsTemplate && excelMapping.drugNameCol) {
        updateData.columnMapping = JSON.stringify(excelMapping);
      }

      await updateDoc(supRef, updateData);

      setSuccessMsg(`تم حفظ وتحديث ${reviewItems.length} صنف للمورد "${selectedSupplier.name}" بنجاح! تم استبدال القائمة القديمة.`);
      setIsReviewing(false);
      setReviewItems([]);
      if (onImportComplete) {
        setTimeout(onImportComplete, 1200);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/drugs`);
    } finally {
      setProcessing(false);
    }
  };

  // If no suppliers exist, ask user to add one
  if (suppliers.length === 0) {
    return (
      <div className="pb-24 pt-6 px-4 max-w-xl mx-auto text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-3">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">يجب إضافة مورد أولاً قبل الاستيراد</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            لكي نقارن أسعار الأدوية، يجب ربط كل قائمة أسعار بمورد أو شركة توزيع محددة (مثل المتحدة، فارما أوفرسيز، إلخ).
          </p>
          <button
            onClick={onNavigateToSuppliers}
            className="py-3 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm transition-all"
          >
            الانتقال لإضافة مورد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-4 px-4 max-w-4xl mx-auto">
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-emerald-600" />
          <span>استيراد وتحديث قوائم الأسعار</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          رفع وتحديث أسعار الأدوية من ملفات إكسل، PDF، أو صور الفواتير ورسائل الواتساب
        </p>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Processing Indicator */}
      {processing && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin shrink-0" />
          <span>{processingStatus || 'جاري المعالجة...'}</span>
        </div>
      )}

      {/* If Not Reviewing, Show Input Setup */}
      {!isReviewing ? (
        <div className="space-y-4">
          {/* Step 1: Select Supplier */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              الخطوة 1: اختر المورد أو شركة التوزيع <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.itemCount || 0} صنف مسجل)
                  </option>
                ))}
              </select>
            </div>
            {selectedSupplier?.columnMapping && (
              <p className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>يوجد قالب أعمدة إكسل محفوظ مسبقاً لهذا المورد سيتم تطبيقه تلقائياً.</span>
              </p>
            )}
          </div>

          {/* Step 2: Choose Input Method */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 mb-3">
              الخطوة 2: اختر طريقة إدخال القائمة
            </label>

            {/* Input method selector pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setInputMethod('excel')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  inputMethod === 'excel'
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-800 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span className="text-xs">ملف إكسل / CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod('pdf')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  inputMethod === 'pdf'
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-800 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileText className="w-5 h-5 text-rose-600" />
                <span className="text-xs">ملف PDF (OCR)</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod('image_text')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  inputMethod === 'image_text'
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-800 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                <span className="text-xs">صورة + رسالة واتساب</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod('manual')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  inputMethod === 'manual'
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-800 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <PlusCircle className="w-5 h-5 text-amber-600" />
                <span className="text-xs">إدخال يدوي سريع</span>
              </button>
            </div>

            {/* Sub-Forms */}
            {/* A: Excel / CSV */}
            {inputMethod === 'excel' && (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-300/80 hover:border-emerald-500 rounded-3xl p-8 text-center cursor-pointer bg-emerald-50/20 hover:bg-emerald-50/40 transition-colors"
                >
                  <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    اضغط لاختيار ملف إكسل (.xlsx, .xls) أو CSV
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    سيتم التعرف التلقائي على الأعمدة باللغتين العربية والإنجليزية
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                </div>

                {/* Column Mapping confirmation dialog/panel */}
                {showMappingSelector && (
                  <div className="bg-slate-50 rounded-2xl p-5 border border-emerald-200 animate-in fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-800">
                        تأكيد مطابقة أعمدة الملف مع بيانات التطبيق:
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          عمود اسم الدواء <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={excelMapping.drugNameCol}
                          onChange={(e) => setExcelMapping({ ...excelMapping, drugNameCol: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="">-- اختر عمود اسم الصنف --</option>
                          {excelHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          عمود السعر الأساسي <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={excelMapping.priceCol}
                          onChange={(e) => setExcelMapping({ ...excelMapping, priceCol: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="">-- اختر عمود السعر --</option>
                          {excelHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          عمود البونص (مثال: 10+1)
                        </label>
                        <select
                          value={excelMapping.bonusCol || ''}
                          onChange={(e) => setExcelMapping({ ...excelMapping, bonusCol: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="">-- لا يوجد أو اختر العمود --</option>
                          {excelHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          عمود الخصم المئوي %
                        </label>
                        <select
                          value={excelMapping.discountCol || ''}
                          onChange={(e) => setExcelMapping({ ...excelMapping, discountCol: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="">-- لا يوجد أو اختر العمود --</option>
                          {excelHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 font-medium mb-1">
                          عمود تاريخ الصلاحية (اختياري)
                        </label>
                        <select
                          value={excelMapping.expiryCol || ''}
                          onChange={(e) => setExcelMapping({ ...excelMapping, expiryCol: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="">-- لا يوجد أو اختر العمود --</option>
                          {excelHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={saveMappingAsTemplate}
                          onChange={(e) => setSaveMappingAsTemplate(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>حفظ هذا التوزيع كقالب دائم لهذا المورد لاستخدامه مستقبلاً تلقائياً</span>
                      </label>

                      <button
                        type="button"
                        onClick={applyExcelMappingToReview}
                        className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <span>معاينة الأصناف في جدول المراجعة</span>
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* B: PDF */}
            {inputMethod === 'pdf' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-rose-200 hover:border-rose-400 rounded-3xl p-8 text-center bg-rose-50/20 transition-colors">
                  <FileText className="w-10 h-10 text-rose-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    رفع ملف PDF يحتوي على قائمة أسعار
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    يدعم المستندات الرقمية والملفات الممسوحة ضوئياً عبر الذكاء الاصطناعي
                  </p>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setSelectedPdfFile(e.target.files?.[0] || null)}
                    className="mt-3 block mx-auto text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                  />
                </div>

                {selectedPdfFile && (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handlePdfExtract}
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>استخراج الأسعار بذكاء Gemini</span>
                  </button>
                )}
              </div>
            )}

            {/* C: Image + Pasted Text */}
            {inputMethod === 'image_text' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-3xl p-6 text-center bg-indigo-50/20 transition-colors">
                  <ImageIcon className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    صورة قائمة الأسعار أو فاتورة الموزع (اختياري مع الرسالة)
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="mt-2 block mx-auto text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {imagePreview && (
                    <div className="mt-3 inline-block relative">
                      <img src={imagePreview} alt="معاينة" className="max-h-36 rounded-xl border border-slate-200 shadow-xs" />
                      <button
                        type="button"
                        onClick={() => { setSelectedImageFile(null); setImagePreview(null); }}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نص رسالة واتساب المصاحبة (مثل أسعار إضافية، بونص، أو تعديلات)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="الصق نص الرسالة من واتساب هنا (مثال: خصم إضافي 5% على جميع أصناف بنادول، بونص 10+2 على أوجمنتين...)"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    يقوم النموذج بدمج معلومات الصورة ونص الرسالة معاً لاستخراج السعر الأحدث لكل صنف.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={processing || (!selectedImageFile && !pastedText.trim())}
                  onClick={handleImageAndTextExtract}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>تحليل واستخراج بواسطة Gemini</span>
                </button>
              </div>
            )}

            {/* D: Single Manual Item Entry */}
            {inputMethod === 'manual' && (
              <form onSubmit={handleAddManualItem} className="space-y-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف الدوائي *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: Panadol Extra 500mg أو كونكور 5 ملغ"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">السعر الأساسي (ج.م) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="مثال: 55.00"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نسبة الخصم %</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="مثال: 5"
                      value={manualDiscount}
                      onChange={(e) => setManualDiscount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">شروط البونص (شراء + مجاني)</label>
                    <input
                      type="text"
                      placeholder="مثال: 10+1 أو 12+2"
                      value={manualBonus}
                      onChange={(e) => setManualBonus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الصلاحية (اختياري)</label>
                    <input
                      type="text"
                      placeholder="مثال: 2027/05"
                      value={manualExpiry}
                      onChange={(e) => setManualExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 text-left">
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    + إضافة الصنف لجدول المراجعة
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* Review Table (ALWAYS before saving) */
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>جدول مراجعة وتدقيق الأسعار للمورد:</span>
                <span className="text-emerald-700 font-extrabold">{selectedSupplier?.name}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي الأصناف: <strong className="text-slate-800">{reviewItems.length}</strong> صنف.
                الخلايا المظللة بالأصفر تدل على قراءة غير مؤكدة وتحتاج تدقيقك.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addNewBlankReviewRow}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>إضافة صنف</span>
              </button>

              <button
                type="button"
                onClick={() => setIsReviewing(false)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                العودة للاستيراد
              </button>
            </div>
          </div>

          {/* Replacement Warning Banner */}
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>تنبيه هام:</strong> حفظ هذه القائمة سيستبدل جميع الأسعار السابقة للمورد <strong>{selectedSupplier?.name}</strong> لضمان حداثة البيانات وعدم تكرار الأصناف القديمة.
            </span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[500px] border border-slate-200 rounded-2xl">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5 min-w-[180px]">اسم الدواء</th>
                  <th className="p-2.5 min-w-[90px]">السعر الأساسي</th>
                  <th className="p-2.5 min-w-[80px]">خصم %</th>
                  <th className="p-2.5 min-w-[90px]">بونص (شراء+حر)</th>
                  <th className="p-2.5 min-w-[100px] bg-emerald-50 text-emerald-900">السعر الفعلي</th>
                  <th className="p-2.5 min-w-[90px]">الصلاحية</th>
                  <th className="p-2.5 w-12 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {reviewItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50 transition-colors ${
                      item.uncertain ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Drug Name */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateReviewItem(idx, 'name', e.target.value)}
                        className={`w-full p-1.5 rounded-lg border text-xs ${
                          item.uncertain
                            ? 'bg-amber-100 border-amber-300 font-semibold'
                            : 'border-slate-200 bg-white'
                        }`}
                      />
                    </td>

                    {/* Original Price */}
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateReviewItem(idx, 'price', e.target.value)}
                        className={`w-full p-1.5 rounded-lg border text-xs text-center font-mono ${
                          item.uncertain
                            ? 'bg-amber-100 border-amber-300 font-bold'
                            : 'border-slate-200 bg-white'
                        }`}
                      />
                    </td>

                    {/* Discount */}
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.5"
                        value={item.discount}
                        onChange={(e) => updateReviewItem(idx, 'discount', e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs text-center font-mono"
                      />
                    </td>

                    {/* Bonus */}
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="10+1"
                        value={item.bonusText}
                        onChange={(e) => updateReviewItem(idx, 'bonusText', e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs text-center font-mono"
                      />
                    </td>

                    {/* Effective Price (Calculated Live) */}
                    <td className="p-2.5 font-bold text-emerald-700 bg-emerald-50/40 text-center font-mono">
                      {formatCurrency(item.effectivePrice)}
                    </td>

                    {/* Expiry */}
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="2027/05"
                        value={item.expiry || ''}
                        onChange={(e) => updateReviewItem(idx, 'expiry', e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs text-center"
                      />
                    </td>

                    {/* Delete row */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeReviewItem(idx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="حذف هذا الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Save Bar */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              يرجى مراجعة الأسعار والتأكد منها، لن يتم الحفظ إلا بعد النقر على زر التأكيد.
            </p>

            <button
              type="button"
              disabled={processing || reviewItems.length === 0}
              onClick={handleSaveToDatabase}
              className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>تأكيد وحفظ القائمة ({reviewItems.length} صنف)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
