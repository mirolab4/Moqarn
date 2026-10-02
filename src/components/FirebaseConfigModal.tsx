import React, { useState } from 'react';
import { activeFirebaseConfig } from '../lib/firebase.ts';
import { Database, X, Check, AlertCircle, Copy, RefreshCw, Key, HelpCircle } from 'lucide-react';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  const [configInput, setConfigInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveCustomConfig = () => {
    setError(null);
    setSuccess(null);

    const text = configInput.trim();
    if (!text) {
      setError('يرجى لصق كود الإعدادات الخاص بـ Firebase.');
      return;
    }

    try {
      let parsed: any = null;

      // Try direct JSON parse
      if (text.startsWith('{') && text.endsWith('}')) {
        try {
          parsed = JSON.parse(text);
        } catch {
          // Might be JS object with unquoted keys
        }
      }

      // If not parsed, extract via regex from JS snippet (e.g. const firebaseConfig = { ... })
      if (!parsed) {
        const apiKey = text.match(/apiKey\s*:\s*["']([^"']+)["']/)?.[1];
        const authDomain = text.match(/authDomain\s*:\s*["']([^"']+)["']/)?.[1];
        const projectId = text.match(/projectId\s*:\s*["']([^"']+)["']/)?.[1];
        const storageBucket = text.match(/storageBucket\s*:\s*["']([^"']+)["']/)?.[1];
        const messagingSenderId = text.match(/messagingSenderId\s*:\s*["']([^"']+)["']/)?.[1];
        const appId = text.match(/appId\s*:\s*["']([^"']+)["']/)?.[1];

        if (apiKey && projectId) {
          parsed = {
            apiKey,
            authDomain: authDomain || `${projectId}.firebaseapp.com`,
            projectId,
            storageBucket: storageBucket || `${projectId}.appspot.com`,
            messagingSenderId: messagingSenderId || '',
            appId: appId || '',
          };
        }
      }

      if (!parsed || !parsed.apiKey || !parsed.projectId) {
        throw new Error('تعذر العثور على apiKey و projectId في النص المدخل. يرجى التأكد من نسخ كود Firebase كاملاً.');
      }

      localStorage.setItem('custom_firebase_config', JSON.stringify(parsed));
      setSuccess(`تم حفظ إعدادات المشروع "${parsed.projectId}" بنجاح! سيتم إعادة تحميل الصفحة لتطبيق الاتصال الجديد.`);
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'صيغة الإعدادات غير صحيحة، يرجى التأكد من نسخ الكود بشكل صحيح.');
    }
  };

  const handleResetToDefault = () => {
    localStorage.removeItem('custom_firebase_config');
    setSuccess('تمت استعادة الإعدادات الافتراضية بنجاح.');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const isCustomActive = typeof window !== 'undefined' && Boolean(localStorage.getItem('custom_firebase_config'));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 text-right relative overflow-hidden border border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">ربط مشروع Firebase لحساب Google آخر</h3>
            <p className="text-xs text-slate-500">
              استخدام مشروع Firebase من حسابك الآخر دون الحاجة لـ MFA على هذا الحساب
            </p>
          </div>
        </div>

        {/* Current status */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">المشروع المتصل حالياً:</span>
            <span className="font-mono font-bold text-slate-800">{activeFirebaseConfig.projectId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">نوع الإعداد:</span>
            <span className={`font-semibold ${isCustomActive ? 'text-amber-700' : 'text-emerald-700'}`}>
              {isCustomActive ? 'مشروع مخصص من حسابك الآخر' : 'المشروع الافتراضي'}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-xs text-emerald-950 leading-relaxed space-y-1.5">
          <p className="font-bold flex items-center gap-1.5 text-emerald-800">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>كيف تحصل على الكود من حسابك الآخر في دقيقة واحدة؟</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] pr-1">
            <li>افتح <strong>Firebase Console</strong> باستخدام حسابك الآخر.</li>
            <li>اختر مشروعك ثم ادخل إلى <strong>Project Settings (إعدادات المشروع)</strong> ⚙️.</li>
            <li>في تبويب <strong>General (عام)</strong>، انزل لأسفل إلى <strong>Your apps (تطبيقاتك)</strong> واختر تطبيق الويب (أو أنشئ تطبيق ويب جديد).</li>
            <li>انسخ كود <strong>firebaseConfig</strong> كاملاً والصقه في المربع أدناه.</li>
          </ol>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Textarea for config */}
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            الصق كود إعدادات Firebase الخاص بحسابك الآخر هنا:
          </label>
          <textarea
            rows={5}
            dir="ltr"
            placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-project.firebaseapp.com",\n  projectId: "my-project",\n  storageBucket: "my-project.appspot.com",\n  messagingSenderId: "123456789",\n  appId: "1:123456789:web:abcdef"\n};`}
            value={configInput}
            onChange={(e) => setConfigInput(e.target.value)}
            className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>

        {/* Buttons */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {isCustomActive ? (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs text-rose-600 hover:text-rose-700 underline font-medium"
            >
              استعادة المشروع الأصلي
            </button>
          ) : <div />}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveCustomConfig}
              className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>تطبيق المشروع الجديد فوراً</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
