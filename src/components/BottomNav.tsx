import React from 'react';
import { Search, Building2, UploadCloud, ShoppingBag } from 'lucide-react';

export type NavTab = 'search' | 'suppliers' | 'import' | 'cart';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  cartCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, cartCount }) => {
  const tabs = [
    {
      id: 'search' as NavTab,
      label: 'مقارنة الأسعار',
      icon: Search,
    },
    {
      id: 'suppliers' as NavTab,
      label: 'الموردين',
      icon: Building2,
    },
    {
      id: 'import' as NavTab,
      label: 'استيراد قوائم',
      icon: UploadCloud,
    },
    {
      id: 'cart' as NavTab,
      label: 'سلة الطلب',
      icon: ShoppingBag,
      badge: cartCount > 0 ? cartCount : undefined,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe">
      <div className="max-w-md mx-auto px-3 py-1.5 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 min-w-[72px] rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isActive ? 'bg-emerald-100 text-emerald-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                </div>
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white font-bold text-[11px] rounded-full flex items-center justify-center shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
