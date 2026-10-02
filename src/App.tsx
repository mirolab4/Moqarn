import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Header } from './components/Header.tsx';
import { BottomNav, NavTab } from './components/BottomNav.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { AdminScreen } from './screens/AdminScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { SuppliersScreen } from './screens/SuppliersScreen.tsx';
import { ImportScreen } from './screens/ImportScreen.tsx';
import { CartScreen } from './screens/CartScreen.tsx';
import { TrialExpiredScreen } from './components/TrialExpiredScreen.tsx';
import { FirebaseConfigModal } from './components/FirebaseConfigModal.tsx';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase.ts';
import { handleFirestoreError, OperationType } from './lib/errorHandling.ts';
import { Pill, Sparkles, Building2 } from 'lucide-react';
import { calculateEffectivePrice, normalizeArabic } from './lib/arabicUtils.ts';

const AppContent: React.FC = () => {
  const { currentUser, loading, hasAccess, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('search');
  const [cartCount, setCartCount] = useState<number>(0);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [importSupplierId, setImportSupplierId] = useState<string | undefined>(undefined);
  const [seeding, setSeeding] = useState(false);
  const [hasCheckedSeed, setHasCheckedSeed] = useState(false);
  const [itemsCount, setItemsCount] = useState<number>(0);

  // Listen to Cart Count (only for pharmacy users)
  useEffect(() => {
    if (!currentUser || isAdmin) {
      setCartCount(0);
      return;
    }

    const path = `users/${currentUser.uid}/cart`;
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        let count = 0;
        snapshot.forEach((d) => {
          count += (d.data().quantity || 1);
        });
        setCartCount(count);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Check total drugs count for demo seed banner (only for pharmacy users)
  useEffect(() => {
    if (!currentUser || isAdmin) return;
    const path = `users/${currentUser.uid}/drugs`;
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        setItemsCount(snapshot.size);
        setHasCheckedSeed(true);
      },
      () => setHasCheckedSeed(true)
    );
    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Seed sample realistic dataset for instant testing
  const handleSeedDemoData = async () => {
    if (!currentUser) return;
    setSeeding(true);

    try {
      const now = new Date().toISOString();

      // 1. Suppliers
      const demoSuppliers = [
        { id: 'sup_ucp', name: 'الشركة المتحدة للصيادلة (UCP)', phone: '201012345678', minOrder: 1500 },
        { id: 'sup_overseas', name: 'فارما أوفرسيز (Pharma Overseas)', phone: '201098765432', minOrder: 1200 },
        { id: 'sup_ibnsina', name: 'ابن سينا فارما (Ibnsina Pharma)', phone: '201123456789', minOrder: 2000 },
      ];

      for (const s of demoSuppliers) {
        await setDoc(doc(db, `users/${currentUser.uid}/suppliers`, s.id), {
          ...s,
          userId: currentUser.uid,
          itemCount: 8,
          lastUploadAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // 2. Demo Drugs across suppliers to demonstrate price comparison
      const demoDrugs = [
        // Panadol Extra
        {
          name: 'بنادول إكسترا 500 مجم (Panadol Extra)',
          supId: 'sup_ucp',
          supName: 'الشركة المتحدة للصيادلة (UCP)',
          price: 55,
          discount: 5,
          bonusBuy: 10,
          bonusFree: 2,
          bonusText: '10+2',
          expiry: '2027/06',
        },
        {
          name: 'بنادول إكسترا 500 مجم (Panadol Extra)',
          supId: 'sup_overseas',
          supName: 'فارما أوفرسيز (Pharma Overseas)',
          price: 55,
          discount: 2,
          bonusBuy: 10,
          bonusFree: 1,
          bonusText: '10+1',
          expiry: '2027/04',
        },
        {
          name: 'بنادول إكسترا 500 مجم (Panadol Extra)',
          supId: 'sup_ibnsina',
          supName: 'ابن سينا فارما (Ibnsina Pharma)',
          price: 55,
          discount: 0,
          bonusBuy: 0,
          bonusFree: 0,
          bonusText: '0',
          expiry: '2027/05',
        },

        // Augmentin 1g
        {
          name: 'أوجمنتين 1 جم أقراص (Augmentin 1g)',
          supId: 'sup_ibnsina',
          supName: 'ابن سينا فارما (Ibnsina Pharma)',
          price: 110,
          discount: 8,
          bonusBuy: 12,
          bonusFree: 3,
          bonusText: '12+3',
          expiry: '2027/01',
        },
        {
          name: 'أوجمنتين 1 جم أقراص (Augmentin 1g)',
          supId: 'sup_ucp',
          supName: 'الشركة المتحدة للصيادلة (UCP)',
          price: 110,
          discount: 5,
          bonusBuy: 10,
          bonusFree: 1,
          bonusText: '10+1',
          expiry: '2026/11',
        },
        {
          name: 'أوجمنتين 1 جم أقراص (Augmentin 1g)',
          supId: 'sup_overseas',
          supName: 'فارما أوفرسيز (Pharma Overseas)',
          price: 110,
          discount: 0,
          bonusBuy: 0,
          bonusFree: 0,
          bonusText: '0',
          expiry: '2026/12',
        },

        // Concor 5mg
        {
          name: 'كونكور 5 ملغ (Concor 5mg)',
          supId: 'sup_overseas',
          supName: 'فارما أوفرسيز (Pharma Overseas)',
          price: 48,
          discount: 6,
          bonusBuy: 10,
          bonusFree: 2,
          bonusText: '10+2',
          expiry: '2028/03',
        },
        {
          name: 'كونكور 5 ملغ (Concor 5mg)',
          supId: 'sup_ucp',
          supName: 'الشركة المتحدة للصيادلة (UCP)',
          price: 48,
          discount: 3,
          bonusBuy: 10,
          bonusFree: 1,
          bonusText: '10+1',
          expiry: '2027/12',
        },

        // Omega 3 Plus
        {
          name: 'أوميجا 3 بلس كبسول (Omega 3 Plus)',
          supId: 'sup_ucp',
          supName: 'الشركة المتحدة للصيادلة (UCP)',
          price: 85,
          discount: 10,
          bonusBuy: 5,
          bonusFree: 1,
          bonusText: '5+1',
          expiry: '2027/09',
        },
        {
          name: 'أوميجا 3 بلس كبسول (Omega 3 Plus)',
          supId: 'sup_ibnsina',
          supName: 'ابن سينا فارما (Ibnsina Pharma)',
          price: 85,
          discount: 5,
          bonusBuy: 0,
          bonusFree: 0,
          bonusText: '0',
          expiry: '2027/08',
        },

        // C-Retard 500mg
        {
          name: 'سي ريتارد 500 مجم (C-Retard 500mg)',
          supId: 'sup_overseas',
          supName: 'فارما أوفرسيز (Pharma Overseas)',
          price: 32,
          discount: 5,
          bonusBuy: 10,
          bonusFree: 2,
          bonusText: '10+2',
          expiry: '2027/07',
        },
        {
          name: 'سي ريتارد 500 مجم (C-Retard 500mg)',
          supId: 'sup_ibnsina',
          supName: 'ابن سينا فارما (Ibnsina Pharma)',
          price: 32,
          discount: 0,
          bonusBuy: 10,
          bonusFree: 1,
          bonusText: '10+1',
          expiry: '2027/06',
        },
      ];

      for (let i = 0; i < demoDrugs.length; i++) {
        const item = demoDrugs[i];
        const effective = calculateEffectivePrice(item.price, item.discount, item.bonusBuy, item.bonusFree);
        const drugId = `drug_demo_${i}_${Date.now()}`;

        await setDoc(doc(db, `users/${currentUser.uid}/drugs`, drugId), {
          id: drugId,
          userId: currentUser.uid,
          supplierId: item.supId,
          supplierName: item.supName,
          name: item.name,
          normalizedName: normalizeArabic(item.name),
          price: item.price,
          discount: item.discount,
          bonusBuy: item.bonusBuy,
          bonusFree: item.bonusFree,
          bonusText: item.bonusText,
          effectivePrice: effective,
          expiry: item.expiry,
          uncertain: false,
          updatedAt: now,
        });
      }

      setActiveTab('search');
    } catch (err) {
      console.error('Error seeding demo data:', err);
    } finally {
      setSeeding(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-700/20 mb-3 animate-bounce">
          <Pill className="w-7 h-7 stroke-[2.2]" />
        </div>
        <h2 className="text-base font-bold text-slate-800">مقارنة أسعار الأدوية</h2>
        <p className="text-xs text-slate-400 mt-1">جاري التحقق من الصلاحيات والبيانات...</p>
      </div>
    );
  }

  // 2. Not Logged In: Show Login / Signup Screen
  if (!currentUser) {
    return (
      <>
        <AuthScreen onOpenFirebaseConfig={() => setIsFirebaseModalOpen(true)} />
        <FirebaseConfigModal
          isOpen={isFirebaseModalOpen}
          onClose={() => setIsFirebaseModalOpen(false)}
        />
      </>
    );
  }

  // 3. User is an Admin: Open ONLY the Admin Panel!
  if (isAdmin) {
    return <AdminScreen />;
  }

  // 4. Pharmacy Subscription Expired: Show Trial Expired Screen
  if (!hasAccess) {
    return <TrialExpiredScreen />;
  }

  // 5. Pharmacy User with Active Subscription: Open Pharmacy Interface
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-200 flex flex-col">
      {/* Pharmacy Header */}
      <Header
        cartCount={cartCount}
        onOpenCart={() => setActiveTab('cart')}
        onOpenFirebaseConfig={() => setIsFirebaseModalOpen(true)}
      />

      {/* Quick Demo Dataset Banner if database is empty */}
      {hasCheckedSeed && itemsCount === 0 && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 shadow-xs">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>
                قاعدة بيانات الصيدلية جديدة وفارغة حالياً. هل ترغب بتحميل <strong>بيانات تجريبية لأدوية وموردين</strong> لتجربة المقارنة فوراً؟
              </span>
            </div>
            <button
              onClick={handleSeedDemoData}
              disabled={seeding}
              className="py-1.5 px-3.5 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 active:scale-95 transition-all shadow-xs shrink-0 flex items-center gap-1.5"
            >
              {seeding ? (
                <div className="w-3.5 h-3.5 border-2 border-emerald-800/30 border-t-emerald-800 rounded-full animate-spin" />
              ) : (
                <Building2 className="w-3.5 h-3.5" />
              )}
              <span>تحميل بيانات تجريبية (1-نقر)</span>
            </button>
          </div>
        </div>
      )}

      {/* Pharmacy Main View Area */}
      <main className="flex-1">
        {activeTab === 'search' && (
          <HomeScreen
            onNavigateToImport={() => setActiveTab('import')}
            onNavigateToCart={() => setActiveTab('cart')}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersScreen
            onSelectSupplierForImport={(supId) => {
              setImportSupplierId(supId);
              setActiveTab('import');
            }}
          />
        )}

        {activeTab === 'import' && (
          <ImportScreen
            initialSupplierId={importSupplierId}
            onImportComplete={() => setActiveTab('search')}
            onNavigateToSuppliers={() => setActiveTab('suppliers')}
          />
        )}

        {activeTab === 'cart' && (
          <CartScreen
            onNavigateToSearch={() => setActiveTab('search')}
            onNavigateToImport={() => setActiveTab('import')}
          />
        )}
      </main>

      {/* Pharmacy Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'import') {
            setImportSupplierId(undefined);
          }
          setActiveTab(tab);
        }}
        cartCount={cartCount}
      />

      {/* Firebase Custom Config Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
