import { ChevronDown, DollarSign, HardHat, MoreHorizontal, Package, Receipt, Search, Wrench } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { SITE_OPERATION_PERMISSIONS, hasPermission, useAuth } from "../auth";
import { SectionTitle } from "../components/ui";
import { useActiveProject } from "../project/ActiveProjectContext";
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
// The nav tabs and each page's own controls (filters, toggles) share one row.
// Rather than let the tabs overflow or scroll off-screen when a page adds wide
// controls, the tabs that don't fit collapse into a "More" dropdown. How many
// fit is measured from the actual available width, so it adapts to the screen
// size and to whatever controls the page contributes — the page controls
// themselves always stay put.

const tabStripClass = (isActive: boolean): string =>
  [
    "flex items-center gap-2 px-5 py-3",
    "text-sm font-semibold whitespace-nowrap",
    "border-b-2 transition-all",
    isActive
      ? "border-[#3b82f6] text-[#3b82f6]"
      : "border-transparent text-slate-500 hover:text-[#0b2a53] hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-500",
  ].join(" ");

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
}) => {
  const navRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const moreWrapRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [moreOpen, setMoreOpen] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;

    const tabEls = Array.from(
      measure.querySelectorAll('[data-role="strip-tab"]'),
    ) as HTMLElement[];
    const moreEl = measure.querySelector('[data-role="strip-more"]') as HTMLElement | null;
    const widths = tabEls.map((el) => el.offsetWidth);
    const moreWidth = moreEl ? moreEl.offsetWidth : 84;

    const recompute = () => {
      const available = nav.clientWidth;
      if (available === 0) return;

      // Everything fits — no "More" needed, so no width reserved for it.
      const total = widths.reduce((sum, width) => sum + width, 0);
      if (total <= available) {
        setVisibleCount(tabs.length);
        return;
      }

      // Otherwise fit as many as possible while leaving room for "More".
      let used = 0;
      let count = 0;
      for (const width of widths) {
        if (used + width + moreWidth <= available) {
          used += width;
          count += 1;
        } else {
          break;
        }
      }
      setVisibleCount(Math.max(count, 1));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(nav);
    // Tab widths shift once the web font swaps in; re-measure when it is ready.
    document.fonts?.ready?.then(recompute).catch(() => undefined);
    return () => observer.disconnect();
  }, [tabs]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (moreWrapRef.current && !moreWrapRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [moreOpen]);

  const safeVisible = Math.min(visibleCount, tabs.length);
  const visibleTabs = tabs.slice(0, safeVisible);
  const overflowTabs = tabs.slice(safeVisible);
  const activeInOverflow = overflowTabs.some((tab) => tab.id === activeTab);

  return (
    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 sm:flex-row sm:items-end dark:border-white/10">
      <div className="relative -mb-px min-w-0 flex-1" ref={navRef}>
        <nav className="flex items-end">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={tabStripClass(isActive)}
                key={tab.id}
                onClick={() => onSwitch(tab.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}

          {overflowTabs.length > 0 && (
            <div className="relative" ref={moreWrapRef}>
              <button
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={tabStripClass(activeInOverflow)}
                onClick={() => setMoreOpen((current) => !current)}
                type="button"
              >
                <MoreHorizontal className="h-4 w-4" />
                More
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${moreOpen ? "rotate-180" : ""}`}
                />
              </button>

              {moreOpen && (
                <div
                  className="absolute right-0 top-full z-[80] mt-1 min-w-[13rem] rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0b1220]"
                  role="menu"
                >
                  {overflowTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        className={[
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2",
                          "text-left text-sm font-semibold transition",
                          isActive
                            ? "bg-[#3b82f6]/10 text-[#3b82f6]"
                            : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5",
                        ].join(" ")}
                        key={tab.id}
                        onClick={() => {
                          onSwitch(tab.id);
                          setMoreOpen(false);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Hidden clone, measured for each tab's natural width so the overflow
            math is stable no matter what is currently on screen. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 flex opacity-0"
          ref={measureRef}
          style={{ visibility: "hidden", whiteSpace: "nowrap" }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <span className={tabStripClass(false)} data-role="strip-tab" key={tab.id}>
                <Icon className="h-4 w-4" />
                {tab.label}
              </span>
            );
          })}
          <span className={tabStripClass(false)} data-role="strip-more">
            <MoreHorizontal className="h-4 w-4" />
            More
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {actions && <div className="w-full pb-2 sm:w-auto sm:shrink-0">{actions}</div>}
    </div>
  );
};

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
  const { activeProject } = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  // A Draft project exists only to prepare its first invoice, so only Materials
  // is available on it — labour/expenses/equipment/petty-cash open once it goes
  // Active. (No active project = cross-project view, everything allowed.)
  const isDraftProject = activeProject?.status === "Draft";
  const allowedTabs = useMemo(() => {
    const roleAllowed = operationTabs.filter((tab) =>
      hasPermission(user?.role, SITE_OPERATION_PERMISSIONS[tab.id]),
    );
    return isDraftProject ? roleAllowed.filter((tab) => tab.id === "materials") : roleAllowed;
  }, [user?.role, isDraftProject]);
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

      {isDraftProject ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="font-semibold">{activeProject?.name}</span> is a Draft — only Materials is
          open so you can prepare its invoice. Set the project Active to unlock labour, expenses,
          equipment and petty cash.
        </p>
      ) : null}

      {activeTab === "labor"      && <LaborPage     embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "materials"  && <MaterialsPage embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "expenses"   && <ExpensesPage  embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "equipment"  && <EquipmentPage embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
      {activeTab === "petty-cash" && <PettyCashPage embedded renderSearchRow={renderSearchRow} renderTabStrip={renderTabStrip} search={search} />}
    </div>
  );
};
