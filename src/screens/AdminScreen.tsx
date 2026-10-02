import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserProfile } from '../types/index.ts';
import { handleFirestoreError, OperationType } from '../lib/errorHandling.ts';
import {
  Shield, Users, CheckCircle, Clock, AlertTriangle, Search,
  LogOut, RefreshCw, Calendar, Ban, Sparkles, Filter, Check, X
} from 'lucide-react';

export const AdminScreen: React.FC = () => {
  const { currentUser, logout, activateUserSubscription, deactivateUserAccount } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'subscribed' | 'trial' | 'expired'>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // Fetch all registered users/pharmacies
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        // Sort newest first
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const now = Date.now();
    let total = 0;
    let subscribed = 0;
    let trial = 0;
    let expired = 0;

    users.forEach((u) => {
      if (u.role === 'admin') return; // exclude admins from pharmacy counts
      total++;
      const isSub = Boolean(u.subscribedUntil && new Date(u.subscribedUntil).getTime() > now);
      const isTr = Boolean(!isSub && u.trialEndsAt && new Date(u.trialEndsAt).getTime() > now);

      if (isSub) subscribed++;
      else if (isTr) trial++;
      else expired++;
    });

    return { total, subscribed, trial, expired };
  }, [users]);

  // Handle extension
  const handleExtend = async (userId: string, pharmacyName: string, days: number) => {
    try {
      const target = new Date();
      target.setDate(target.getDate() + days);
      const iso = target.toISOString();

      await activateUserSubscription(userId, iso);
      setActionNotice(`تم تفعيل اشتراك "${pharmacyName}" لمدة ${days} يوماً بنجاح (حتى ${target.toLocaleDateString('ar-EG')}).`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e: any) {
      setActionNotice('حدث خطأ أثناء تمديد الاشتراك: ' + (e.message || ''));
    }
  };

  // Handle deactivation / stopping account
  const handleDeactivate = async (userId: string, pharmacyName: string) => {
    try {
      await deactivateUserAccount(userId);
      setConfirmDeactivateId(null);
      setActionNotice(`تم إيقاف اشتراك وتعطيل حساب "${pharmacyName}" بنجاح.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e: any) {
      setActionNotice('حدث خطأ أثناء إيقاف الحساب: ' + (e.message || ''));
    }
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    const now = Date.now();
    return users.filter((u) => {
      // Search filter
      const q = search.trim().toLowerCase();
      if (q) {
        const nameMatch = (u.pharmacyName || '').toLowerCase().includes(q);
        const emailMatch = (u.email || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }

      // Status filter
      if (filterStatus === 'all') return true;

      const isSub = Boolean(u.subscribedUntil && new Date(u.subscribedUntil).getTime() > now);
      const isTr = Boolean(!isSub && u.trialEndsAt && new Date(u.trialEndsAt).getTime() > now);

      if (filterStatus === 'subscribed') return isSub;
      if (filterStatus === 'trial') return isTr;
      if (filterStatus === 'expired') return !isSub && !isTr && u.role !== 'admin';

      return true;
    });
  }, [users, search, filterStatus]);

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return 'غير محدد';
    try {
      return new Date(isoStr).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* Admin Top Navigation Bar */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight leading-none">لوحة الإدارة المركزية</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  مسؤول النظام
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {currentUser?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-rose-600/80 active:scale-95 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-white/10"
              title="تسجيل الخروج من لوحة الإدارة"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-4 py-6 flex-1 space-y-6">
        {/* Notice Banner */}
        {actionNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">إجمالي الصيدليات</p>
              <h3 className="text-2xl font-black text-slate-800 font-mono">{stats.total}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Subscribed */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">المشتركون النشطون</p>
              <h3 className="text-2xl font-black text-emerald-700 font-mono">{stats.subscribed}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: In Trial */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">الفترات التجريبية</p>
              <h3 className="text-2xl font-black text-blue-700 font-mono">{stats.trial}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Expired */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">المنتهية / الموقوفة</p>
              <h3 className="text-2xl font-black text-rose-700 font-mono">{stats.expired}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث باسم الصيدلية أو البريد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({users.length})
            </button>
            <button
              onClick={() => setFilterStatus('subscribed')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                filterStatus === 'subscribed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              مشتركون ({stats.subscribed})
            </button>
            <button
              onClick={() => setFilterStatus('trial')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                filterStatus === 'trial'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              تجربة ({stats.trial})
            </button>
            <button
              onClick={() => setFilterStatus('expired')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                filterStatus === 'expired'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              منتهية ({stats.expired})
            </button>
          </div>
        </div>

        {/* Table of Pharmacies */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              قائمة الصيدليات المسجلة ({filteredUsers.length})
            </h2>
            <span className="text-[11px] text-slate-400">
              إدارة تفعيل وتمديد وتعطيل الاشتراكات مباشرة
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">جاري تحميل بيانات الصيدليات...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              لا توجد صيدليات مطابقة لمعايير البحث الحالية.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">اسم الصيدلية</th>
                    <th className="p-3.5">البريد الإلكتروني</th>
                    <th className="p-3.5">تاريخ التسجيل</th>
                    <th className="p-3.5">نهاية الاشتراك</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const now = Date.now();
                    const isSubActive = Boolean(u.subscribedUntil && new Date(u.subscribedUntil).getTime() > now);
                    const isTrialActive = Boolean(!isSubActive && u.trialEndsAt && new Date(u.trialEndsAt).getTime() > now);
                    const isAdminUser = u.role === 'admin';

                    const daysLeftTrial = isTrialActive
                      ? Math.max(0, Math.ceil((new Date(u.trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24)))
                      : 0;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Pharmacy Name */}
                        <td className="p-3.5 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{u.pharmacyName}</span>
                            {isAdminUser && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-900 font-bold">
                                مسؤول
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-3.5 font-mono text-slate-600 dir-ltr text-right">
                          {u.email}
                        </td>

                        {/* Registration Date */}
                        <td className="p-3.5 text-slate-500">
                          {formatDate(u.createdAt)}
                        </td>

                        {/* Subscribed Until */}
                        <td className="p-3.5">
                          {u.subscribedUntil ? (
                            <span className="font-semibold text-slate-800">
                              {formatDate(u.subscribedUntil)}
                            </span>
                          ) : (
                            <span className="text-slate-400">غير محدد</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5">
                          {isAdminUser ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              مسؤول النظام
                            </span>
                          ) : isSubActive ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              مشترك نشط
                            </span>
                          ) : isTrialActive ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              تجربة ({daysLeftTrial} أيام)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              منتهي الصلاحية
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5">
                          {isAdminUser ? (
                            <span className="text-slate-400 text-[11px] italic block text-center">
                              حساب الإدارة
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Extend 1 month */}
                              <button
                                onClick={() => handleExtend(u.id, u.pharmacyName, 30)}
                                className="py-1 px-2.5 rounded-lg border border-slate-200 hover:border-emerald-600 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 text-xs font-semibold transition-all active:scale-95"
                                title="تمديد الاشتراك 30 يوماً"
                              >
                                + شهر
                              </button>

                              {/* Extend 3 months */}
                              <button
                                onClick={() => handleExtend(u.id, u.pharmacyName, 90)}
                                className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs active:scale-95"
                                title="تمديد الاشتراك 90 يوماً"
                              >
                                + 3 أشهر
                              </button>

                              {/* Deactivate / Stop account */}
                              {confirmDeactivateId === u.id ? (
                                <div className="flex items-center gap-1 animate-in fade-in">
                                  <button
                                    onClick={() => handleDeactivate(u.id, u.pharmacyName)}
                                    className="py-1 px-2 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 shadow-xs"
                                  >
                                    تأكيد الإيقاف
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeactivateId(null)}
                                    className="py-1 px-1.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] hover:bg-slate-100"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeactivateId(u.id)}
                                  className="py-1 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs transition-colors"
                                  title="إيقاف الحساب وتعطيل الاشتراك"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-800 shadow-2xl text-center border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold mb-1">تسجيل الخروج</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              هل أنت متأكد من رغبتك في تسجيل الخروج من لوحة إدارة النظام؟
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                تأكيد الخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
