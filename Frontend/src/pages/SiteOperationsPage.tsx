import { ChevronLeft, ChevronRight, DollarSign, HardHat, Package, Receipt, Search, Wrench } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
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

// --- Tab Bar ------------------------------------------------
// Layout: primary operation links first, search controls below.

export type TabBarProps = {
  activeTab: OperationsTab;
  onSwitch: (tab: OperationsTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  tabs?: readonly OperationTabConfig[];
};

export const OperationsTabBar = ({
  activeTab,
  onSwitch,
  search,
  onSearchChange,
  tabs = operationTabs,
}: TabBarProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -160 : 160,
      behavior: "smooth",
    });
  };

  const activeLabel =
    tabs.find((tab) => tab.id === activeTab)?.label ?? "Operations";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div
        className={[
          "flex flex-col gap-3 border-b border-slate-100 pb-3",
          "lg:flex-row lg:items-center lg:justify-between",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label="Scroll tabs left"
            className={[
              "flex h-10 w-10 flex-shrink-0 items-center",
              "justify-center rounded-lg text-slate-400 transition",
              "hover:bg-slate-100 hover:text-slate-700",
            ].join(" ")}
            onClick={() => scroll("left")}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            className={[
              "flex min-w-0 flex-1 gap-2 overflow-x-auto",
              "scroll-smooth",
            ].join(" ")}
            ref={scrollRef}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "flex h-10 flex-shrink-0 items-center gap-2",
                    "rounded-lg px-4 text-sm font-semibold",
                    "transition-all",
                    isActive
                      ? "bg-[#0b2a53] text-white shadow-sm ring-1"
                      : "text-slate-600 hover:bg-slate-100",
                    isActive
                      ? "ring-[#0b2a53]/20"
                      : "hover:text-slate-900",
                  ].join(" ")}
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

          <button
            aria-label="Scroll tabs right"
            className={[
              "flex h-10 w-10 flex-shrink-0 items-center",
              "justify-center rounded-lg text-slate-400 transition",
              "hover:bg-slate-100 hover:text-slate-700",
            ].join(" ")}
            onClick={() => scroll("right")}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div
          className={[
            "inline-flex items-center justify-between gap-2",
            "rounded-lg border border-[#0b2a53]/20",
            "bg-[#0b2a53]/5 px-3 py-2 text-sm font-semibold",
            "text-[#0b2a53] lg:min-w-44",
          ].join(" ")}
        >
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Current
          </span>
          <span>{activeLabel}</span>
        </div>
      </div>

      <div className="mt-3">
        <label className="relative block w-full sm:max-w-xl">
          <Search
            className={[
              "pointer-events-none absolute left-3 top-1/2 h-4 w-4",
              "-translate-y-1/2 text-slate-400",
            ].join(" ")}
          />
          <input
            className={[
              "h-11 w-full rounded-lg border border-slate-200",
              "bg-slate-50 pl-10 pr-4 text-sm text-slate-700",
              "placeholder-slate-400 outline-none transition",
              "focus:border-[#0b2a53] focus:bg-white",
              "focus:ring-2 focus:ring-[#0b2a53]/10",
            ].join(" ")}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${activeLabel}...`}
            type="search"
            value={search}
          />
        </label>
      </div>
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

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Site Operations"
      />
      <OperationsTabBar
        activeTab={activeTab}
        onSearchChange={setSearch}
        onSwitch={switchTab}
        search={search}
        tabs={allowedTabs}
      />

      <Suspense fallback={<SkeletonTable rows={5} />}>
        {activeTab === "labor"      && <LaborPage     embedded search={search} />}
        {activeTab === "materials"  && <MaterialsPage embedded search={search} />}
        {activeTab === "expenses"   && <ExpensesPage  embedded search={search} />}
        {activeTab === "equipment"  && <EquipmentPage embedded search={search} />}
        {activeTab === "petty-cash" && <PettyCashPage embedded search={search} />}
      </Suspense>
    </div>
  );
};
