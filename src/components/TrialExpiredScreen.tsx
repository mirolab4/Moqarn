import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Lock, MessageCircle, LogOut, CheckCircle, ShieldCheck, Calendar, ArrowRight } from 'lucide-react';

export const TrialExpiredScreen: React.FC = () => {
  const { profile, currentUser, logout, activateUserSubscription, isAdmin } = useAuth();
  const [activating, setActivating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleManualActivate = async (days: number) => {
    if (!currentUser) return;
    setActivating(true);
    setSuccessMsg('');
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      await activateUserSubscription(currentUser.uid, targetDate.toISOString());
      setSuccessMsg(`تم تفعيل الاشتراك بنجاح حتى ${targetDate.toLocaleDateString('ar-EG')}`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setActivating(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `السلام عليكم، أود تفعيل اشتراكي في تطبيق "مقارنة أسعار الأدوية".\nاسم الصيدلية: ${profile?.pharmacyName || ''}\nالبريد الإلكتروني: ${profile?.email || ''}`
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center relative overflow-hidden">
        {/* Subtle decorative gradient top */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-amber-500 to-rose-400" />

        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 mx-auto flex items-center justify-center mb-4 shadow-sm">
          <Lock className="w-8 h-8 stroke-[2.2]" />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">انتهت فترة التجربة المجانية</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          انتهت فترة الـ 7 أيام التجريبية لحساب <strong className="text-slate-800">{profile?.pharmacyName}</strong>. للاستمرار في مقارنة الأسعار واستيراد القوائم وإرسال طلبيات الواتساب، يرجى التواصل مع إدارة النظام لتفعيل الاشتراك.
        </p>

        {/* Account Details Box */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200/70 text-right text-xs space-y-2">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500">اسم الصيدلية:</span>
            <span className="font-semibold text-slate-800">{profile?.pharmacyName || '—'}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500">البريد الإلكتروني:</span>
            <span className="font-mono text-slate-700">{profile?.email}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">تاريخ انتهاء التجربة:</span>
            <span className="text-rose-600 font-medium">
              {profile?.trialEndsAt ? new Date(profile.trialEndsAt).toLocaleDateString('ar-EG') : 'منتهية'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <a
            href={`https://wa.me/201000000000?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            <span>طلب التفعيل عبر واتساب</span>
          </a>

          <button
            onClick={logout}
            className="w-full py-3 px-4 rounded-2xl font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج أو التبديل لحساب آخر</span>
          </button>
        </div>

        {/* Admin manual activation drawer */}
        {isAdmin && (
          <div className="mt-8 pt-6 border-t border-dashed border-slate-200 text-right">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>أدوات المسؤول (لأنك مسجل كمدير النظام)</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              يمكنك تفعيل هذا الحساب يدوياً فوراً:
            </p>

            {successMsg && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={activating}
                onClick={() => handleManualActivate(30)}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                + 30 يوماً
              </button>
              <button
                disabled={activating}
                onClick={() => handleManualActivate(90)}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                + 3 أشهر
              </button>
              <button
                disabled={activating}
                onClick={() => handleManualActivate(365)}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                + سنة كاملة
              </button>
              <button
                disabled={activating}
                onClick={() => handleManualActivate(3650)}
                className="py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
              >
                تفعيل دائم (10 سنوات)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
