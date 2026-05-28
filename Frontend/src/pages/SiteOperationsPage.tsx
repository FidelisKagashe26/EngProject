import { ChevronLeft, ChevronRight, DollarSign, HardHat, Package, Receipt, Search, Wrench } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { SITE_OPERATION_PERMISSIONS, hasPermission, useAuth } from "../auth";
import { SectionTitle, SkeletonTable } from "../components/ui";

const LaborPage = lazy(async () => ({
  default: (await import("./LaborPage")).LaborPage,
}));
const MaterialsPage = lazy(async () => ({
  default: (await import("./MaterialsPage")).MaterialsPage,
}));
const ExpensesPage = lazy(async () => ({
  default: (await import("./ExpensesPage")).ExpensesPage,
}));
const EquipmentPage = lazy(async () => ({
  default: (await import("./EquipmentPage")).EquipmentPage,
}));
const PettyCashPage = lazy(async () => ({
  default: (await import("./PettyCashPage")).PettyCashPage,
}));

type OperationsTab = "labor" | "materials" | "expenses" | "equipment" | "petty-cash";

type OperationTabConfig = {
  id: OperationsTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const operationTabs: OperationTabConfig[] = [
  { id: "labor",      label: "Labor",      icon: HardHat    },
  { id: "materials",  label: "Materials",  icon: Package    },
  { id: "expenses",   label: "Expenses",   icon: Receipt    },
  { id: "equipment",  label: "Equipment",  icon: Wrench     },
  { id: "petty-cash", label: "Petty Cash", icon: DollarSign },
];

const isOperationsTab = (value: string | null): value is OperationsTab =>
  operationTabs.some((tab) => tab.id === value);

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
// Layout: [ 🔍 Search... ] | ← | Labor | Materials | Expenses | Equipment | Petty Cash | →

export type TabBarProps = {
  activeTab: OperationsTab;
  onSwitch: (tab: OperationsTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  tabs: OperationTabConfig[];
};

export const OperationsTabBar = ({
  activeTab,
  onSwitch,
  search,
  onSearchChange,
  tabs,
}: TabBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -160 : 160, behavior: "smooth" });
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {/* 🔍 Search — leftmost */}
      <div className="relative w-44 flex-shrink-0 sm:w-52">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-[#0b2a53] focus:bg-white focus:ring-2 focus:ring-[#0b2a53]/10"
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Search ${tabs.find((t) => t.id === activeTab)?.label ?? ""}...`}
          type="search"
          value={search}
        />
      </div>

      {/* Divider */}
      <div className="mx-1 h-6 w-px flex-shrink-0 bg-slate-200" />

      {/* ← */}
      <button
        aria-label="Scroll tabs left"
        className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        onClick={() => scroll("left")}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Scrollable tabs */}
      <div
        className="flex flex-1 gap-1 overflow-x-auto scroll-smooth"
        ref={scrollRef}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-[#0b2a53] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              key={tab.id}
              onClick={() => onSwitch(tab.id)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* → */}
      <button
        aria-label="Scroll tabs right"
        className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        onClick={() => scroll("right")}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

// ─── Site Operations Page ─────────────────────────────────────────────────────

export const SiteOperationsPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const allowedTabs = useMemo(
    () =>
      operationTabs.filter((tab) =>
        hasPermission(user?.role, SITE_OPERATION_PERMISSIONS[tab.id]),
      ),
    [user?.role],
  );
  const requestedTab = isOperationsTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as OperationsTab)
    : null;
  const activeTab = allowedTabs.some((tab) => tab.id === requestedTab)
    ? requestedTab as OperationsTab
    : allowedTabs[0]?.id ?? "labor";

  useEffect(() => {
    if (allowedTabs.length === 0 || requestedTab === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, allowedTabs.length, requestedTab, searchParams, setSearchParams]);

  const switchTab = (tab: OperationsTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams);
    setSearch("");
  };

  // Tab bar node passed as prop into each sub-page so it renders
  // BETWEEN the stats cards and the data table — inside the sub-page layout.
  const tabBar: ReactNode = (
    <OperationsTabBar
      activeTab={activeTab}
      onSearchChange={setSearch}
      onSwitch={switchTab}
      search={search}
      tabs={allowedTabs}
    />
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Run all daily site operations from one place."
        title="Site Operations"
      />

      <Suspense fallback={<SkeletonTable rows={5} />}>
        {activeTab === "labor"      && <LaborPage     embedded search={search} tabBar={tabBar} />}
        {activeTab === "materials"  && <MaterialsPage embedded search={search} tabBar={tabBar} />}
        {activeTab === "expenses"   && <ExpensesPage  embedded search={search} tabBar={tabBar} />}
        {activeTab === "equipment"  && <EquipmentPage embedded search={search} tabBar={tabBar} />}
        {activeTab === "petty-cash" && <PettyCashPage embedded search={search} tabBar={tabBar} />}
      </Suspense>
    </div>
  );
};
