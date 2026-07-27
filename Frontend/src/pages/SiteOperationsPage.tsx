import { DollarSign, HardHat, Package, Receipt, Search, Wrench } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { SITE_OPERATION_PERMISSIONS, hasPermission, useAuth } from "../auth";
import { SectionTitle } from "../components/ui";
import { EquipmentPage } from "./EquipmentPage";
import { ExpensesPage } from "./ExpensesPage";
import { LaborPage } from "./LaborPage";
import { MaterialsPage } from "./MaterialsPage";
import { PettyCashPage } from "./PettyCashPage";

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

// ─── Underline Tab Strip ────────────────────────────────────────────────────────

const OperationsTabStrip = ({
  tabs,
  activeTab,
  onSwitch,
  actions,
}: {
  tabs: readonly OperationTabConfig[];
  activeTab: OperationsTab;
  onSwitch: (tab: OperationsTab) => void;
  actions?: ReactNode;
}) => (
  <div className="flex flex-col justify-between gap-3 border-b border-slate-200 sm:flex-row sm:items-end dark:border-white/10">
    <nav
      className="-mb-px flex gap-0 overflow-x-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={[
              "flex items-center gap-2 px-5 py-3",
              "text-sm font-semibold whitespace-nowrap",
              "border-b-2 transition-all",
              isActive
                ? "border-[#3b82f6] text-[#3b82f6]"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500",
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
    </nav>
    {actions && (
      <div className="pb-2">
        {actions}
      </div>
    )}
  </div>
);

// ─── Search Row (search input + page-specific actions) ──────────────────────────

export const OperationsSearchRow = ({
  search,
  onSearchChange,
  activeLabel,
  actions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  activeLabel: string;
  actions?: ReactNode;
}) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
    <label className="relative block w-full lg:max-w-md">
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

    {actions && (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end lg:justify-end">
        {actions}
      </div>
    )}
  </div>
);

// ─── Site Operations Page ───────────────────────────────────────────────────────

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

  const activeLabel =
    allowedTabs.find((tab) => tab.id === activeTab)?.label ?? "Operations";

  // Each page places the search row after its summary cards, so the parent
  // provides a callback that renders the shared search input with the page's
  // own filter controls and action buttons.
  const renderSearchRow = (actions?: ReactNode) => (
    <OperationsSearchRow
      actions={actions}
      activeLabel={activeLabel}
      onSearchChange={setSearch}
      search={search}
    />
  );

  const renderTabStrip = (actions?: ReactNode) => (
    <OperationsTabStrip
      actions={actions}
      activeTab={activeTab}
      onSwitch={switchTab}
      tabs={allowedTabs}
    />
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Site Operations"
      />

      {activeTab === "labor"      && <LaborPage     embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "materials"  && <MaterialsPage embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "expenses"   && <ExpensesPage  embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "equipment"  && <EquipmentPage embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "petty-cash" && <PettyCashPage embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
    </div>
  );
};
