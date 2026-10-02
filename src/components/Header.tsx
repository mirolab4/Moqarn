import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Pill, ShoppingBag, LogOut, Shield, Clock, Sparkles, Database, Edit2, Check } from 'lucide-react';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenFirebaseConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ cartCount, onOpenCart, onOpenFirebaseConfig }) => {
  const { profile, logout, isTrialActive, isSubscribed, daysRemainingInTrial, updatePharmacyName } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  const handleStartEdit = () => {
    setNewName(profile?.pharmacyName || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (newName.trim()) {
      await updatePharmacyName(newName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-emerald-700 text-white shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand & User Info */}
        <div className="flex items-center gap-2.5">
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt="Avatar"
              className="w-10 h-10 rounded-xl object-cover border border-white/30 shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 shadow-inner">
              <Pill className="w-6 h-6 stroke-[2.2]" />
            </div>
          )}

          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none flex items-center gap-1.5">
              <span>مقارنة أسعار الأدوية</span>
            </h1>

            {isEditingName ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-2 py-0.5 rounded text-xs text-slate-800 bg-white border border-slate-300 max-w-[140px]"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                  title="حفظ"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-xs text-emerald-100 font-medium truncate max-w-[140px] sm:max-w-[220px]">
                  {profile?.pharmacyName || 'بوابة الصيدلية'}
                </p>
                <button
                  onClick={handleStartEdit}
                  className="text-emerald-300 hover:text-white p-0.5"
                  title="تعديل اسم الصيدلية"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2">
          {/* Custom Firebase indicator/button */}
          {onOpenFirebaseConfig && (
            <button
              onClick={onOpenFirebaseConfig}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border border-white/15 flex items-center justify-center"
              title="إعدادات مشروع Firebase"
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          {/* Subscription pill */}
          {isSubscribed ? (
            <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/40 text-emerald-100 border border-emerald-400/30">
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>اشتراك مفعّل</span>
            </span>
          ) : isTrialActive ? (
            <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-800/80 text-emerald-200 border border-emerald-600/50">
              <Clock className="w-3.5 h-3.5" />
              <span>تجربة: {daysRemainingInTrial} أيام</span>
            </span>
          ) : null}

          {/* Cart button */}
          <button
            onClick={onOpenCart}
            className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border border-white/15 flex items-center justify-center"
            title="سلة الطلبات"
            aria-label="سلة الطلبات"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-amber-400 text-amber-950 font-bold text-xs rounded-full flex items-center justify-center shadow-md animate-pulse">
                {cartCount}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-emerald-100 hover:text-white border border-white/15"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 text-slate-800 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-1">تسجيل الخروج</h3>
            <p className="text-sm text-slate-500 mb-5">هل أنت متأكد من رغبتك في تسجيل الخروج من حساب الصيدلية؟</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2.5 px-4 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="py-2.5 px-4 rounded-xl font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                تأكيد الخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
