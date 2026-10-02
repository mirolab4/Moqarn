import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Pill, Sparkles, LogIn, UserPlus, AlertCircle, Building2,
  KeyRound, ArrowRight, CheckCircle2, Mail
} from 'lucide-react';

interface AuthScreenProps {
  onOpenFirebaseConfig?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onOpenFirebaseConfig }) => {
  const { login, signup, loginWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('يرجى إدخال البريد الإلكتروني');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        setSuccessMessage(`تم إرسال رابط إعادة تعيين كلمة المرور إلى (${email.trim()}) بنجاح! يرجى فحص صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam).`);
      } catch (err: any) {
        console.error('Password reset error:', err);
        const code = err.code || '';
        if (code === 'auth/user-not-found') {
          setError('هذا البريد الإلكتروني غير مسجل في النظام.');
        } else if (code === 'auth/invalid-email') {
          setError('صيغة البريد الإلكتروني غير صحيحة.');
        } else {
          setError('تعذر إرسال رابط إعادة التعيين: ' + (err.message || 'يرجى المحاولة لاحقاً'));
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    if (mode === 'signup') {
      if (!pharmacyName.trim()) {
        setError('يرجى إدخال اسم الصيدلية');
        return;
      }
      if (password.length < 6) {
        setError('كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام');
        return;
      }
      if (password !== confirmPassword) {
        setError('كلمتا المرور غير متطابقتين');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, pharmacyName.trim());
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const code = err.code || '';
      setErrorCode(code);
      let msg = 'حدث خطأ أثناء العملية، يرجى المحاولة مرة أخرى.';
      
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'هذا البريد الإلكتروني مسجل بالفعل في النظام.';
      } else if (code === 'auth/invalid-email') {
        msg = 'صيغة البريد الإلكتروني غير صحيحة.';
      } else if (code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 خانات على الأقل).';
      } else if (code === 'auth/too-many-requests') {
        msg = 'تم حظر المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار قليلاً أو إعادة تعيين كلمة المرور.';
      } else if (err.message && err.message.includes('auth/')) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setErrorCode(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await loginWithGoogle(pharmacyName.trim() || undefined);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const code = err.code || '';
      setErrorCode(code);
      let msg = 'تعذر تسجيل الدخول باستخدام حساب Google. يرجى المحاولة مرة أخرى.';
      if (code === 'auth/popup-closed-by-user') {
        msg = 'تم إغلاق نافذة تسجيل الدخول من Google قبل إتمام العملية.';
      } else if (code === 'auth/popup-blocked') {
        msg = 'تم حظر النافذة المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة أو المحاولة مجدداً.';
      } else if (code === 'auth/cancelled-popup-request') {
        msg = 'تم إلغاء الطلب السابق، يرجى المحاولة مرة أخرى.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'تعذر الاتصال بالشبكة، يرجى التحقق من اتصالك بالإنترنت.';
      } else if (code === 'auth/account-exists-with-different-credential') {
        msg = 'هذا البريد مسجل مسبقاً بكلمة مرور. يمكنك تسجيل الدخول بكلمة المرور أو استخدام رابط إعادة تعيين كلمة المرور.';
      } else if (code === 'auth/unauthorized-domain') {
        msg = 'هذا النطاق غير مصرح به في إعدادات مشروع Firebase. يرجى إضافة النطاق إلى Authorized Domains في لوحة تحكم Firebase.';
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'مزوّد تسجيل الدخول عبر Google غير مفعّل في لوحة Firebase. يرجى تفعيله من Authentication > Sign-in method.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick helper to login with demo pharmacist
  const handleQuickDemo = async () => {
    setError(null);
    setErrorCode(null);
    setSuccessMessage(null);
    setLoading(true);
    const demoEmail = 'pharmacist.demo@pharma.com';
    const demoPass = 'Pharma@123456';
    const demoPharmacy = 'صيدلية الشفاء الحديثة';

    try {
      await login(demoEmail, demoPass);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await signup(demoEmail, demoPass, demoPharmacy);
        } catch (signupErr: any) {
          setError('تعذر تسجيل الدخول التجريبي: ' + (signupErr.message || ''));
        }
      } else {
        setError('تعذر تسجيل الدخول: ' + (err.message || ''));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-slate-50 to-slate-100 flex flex-col justify-center items-center p-4">
      {/* Container */}
      <div className="max-w-md w-full">
        {/* App Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-700/20 mb-3 border border-emerald-600/30">
            <Pill className="w-8 h-8 stroke-[2.3]" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">مقارنة أسعار الأدوية</h1>
          <p className="text-sm text-slate-500 mt-1">
            البوابة الصيدلانية لمقارنة أسعار شركات التوزيع وإرسال طلبيات واتساب
          </p>
          <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>تجربة مجانية لمدة 7 أيام عند التسجيل الجديد</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80">
          {/* Tabs (when not in forgot password mode) */}
          {mode !== 'forgot' ? (
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'login'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'signup'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>حساب جديد</span>
              </button>
            </div>
          ) : (
            <div className="mb-5 flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>استعادة كلمة المرور</span>
              </div>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>العودة للدخول</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Success Message Banner */}
          {successMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-start gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium space-y-2 shadow-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>

              {/* Actionable button if password wrong or email already registered */}
              {(errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password') && (
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-rose-700 font-semibold">هل نسيت كلمة المرور؟</span>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition-colors"
                  >
                    استعادة كلمة المرور
                  </button>
                </div>
              )}

              {errorCode === 'auth/email-already-in-use' && (
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-rose-700 font-semibold">هل هذا حسابك؟</span>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 transition-colors"
                  >
                    انتقل لتسجيل الدخول
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Google Sign In Button (Only in login and signup modes) */}
          {mode !== 'forgot' && (
            <div className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم الصيدلية (اختياري للربط مع Google)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="مثال: صيدلية الأمل الحديثة"
                      value={pharmacyName}
                      onChange={(e) => setPharmacyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-xs disabled:opacity-60"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>المتابعة باستخدام Google</span>
              </button>
            </div>
          )}

          {/* Divider */}
          {mode !== 'forgot' && (
            <div className="relative my-5 flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-bold text-slate-400 absolute">
                أو عبر البريد الإلكتروني
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && !pharmacyName && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الصيدلية <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: صيدلية النور الحديثة"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                البريد الإلكتروني <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                dir="ltr"
                placeholder="pharmacy@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs transition-all text-left"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null); setSuccessMessage(null); }}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs transition-all text-left"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تأكيد كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs transition-all text-left"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 text-xs mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول بالبريد وكلمة المرور</span>
                </>
              ) : mode === 'signup' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء حساب بالبريد الإلكتروني</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>إرسال رابط إعادة تعيين كلمة المرور</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Option */}
          {mode !== 'forgot' && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center mb-2.5 font-medium">أو تجربة التطبيق سريعاً بدون كلمة مرور:</p>
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleQuickDemo}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>دخول كصيدلي تجريبي</span>
                </button>
              </div>

              {onOpenFirebaseConfig && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={onOpenFirebaseConfig}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                  >
                    <span>هل ترغب بربط مشروع Firebase من حساب Google آخر؟</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer notes */}
        <p className="text-xs text-slate-400 text-center mt-5">
          بيانات كل صيدلية معزولة تماماً ومحمية بأعلى معايير الأمان
        </p>
      </div>
    </div>
  );
};
