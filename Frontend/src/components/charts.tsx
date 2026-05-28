import { formatTzs } from "../utils/format";

export const IncomeExpenseChart = ({
  data,
}: {
  data: Array<{ month: string; income: number; expenses: number }>;
}) => {
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthRank = new Map(monthOrder.map((month, index) => [month, index]));
  const chartData =
    data.length > 0
      ? [...data].sort(
          (first, second) =>
            (monthRank.get(first.month.split(" ")[0]) ?? 99) -
            (monthRank.get(second.month.split(" ")[0]) ?? 99),
        )
      : monthOrder.map((month) => ({ month, income: 0, expenses: 0 }));
  const maxValue = Math.max(...chartData.map((item) => Math.max(item.income, item.expenses)), 1);
  const columnCount = Math.max(chartData.length, 1);
  const minChartWidth = columnCount > 12 ? columnCount * 48 : undefined;
  const getBarHeight = (value: number) => (value > 0 ? `${Math.max((value / maxValue) * 100, 4)}%` : "0%");

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(24px, 1fr))`,
            ...(minChartWidth ? { minWidth: `${minChartWidth}px` } : {}),
          }}
        >
          {chartData.map((item) => (
            <div className="flex flex-col items-center gap-2" key={item.month}>
              <div className="flex h-44 w-full items-end gap-1 rounded-lg bg-slate-50 p-1.5 sm:p-2">
                <div
                  className="w-1/2 rounded-sm"
                  style={{ backgroundColor: "var(--primary)", height: getBarHeight(item.income) }}
                  title={`Income ${formatTzs(item.income)}`}
                />
                <div
                  className="w-1/2 rounded-sm"
                  style={{ backgroundColor: "var(--accent)", height: getBarHeight(item.expenses) }}
                  title={`Expenses ${formatTzs(item.expenses)}`}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600">{item.month}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 text-xs font-medium text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
          Income
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
          Expenses
        </span>
      </div>
    </div>
  );
};

export const DonutChart = ({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>;
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const stops: string[] = [];
  let current = 0;
  data.forEach((item) => {
    const from = total > 0 ? (current / total) * 100 : 0;
    current += item.value;
    const to = total > 0 ? (current / total) * 100 : 0;
    stops.push(`${item.color} ${from}% ${to}%`);
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
        <div className="absolute inset-5 rounded-full bg-white">
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-slate-900">
            {total}
          </p>
          <p className="absolute left-1/2 top-[calc(50%+2.35rem)] -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Projects
          </p>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {data.map((item) => (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700" key={item.label}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label} ({item.value})
          </div>
        ))}
      </div>
    </div>
  );
};

export const StackedCostBar = ({
  labor,
  material,
  operations,
}: {
  labor: number;
  material: number;
  operations: number;
}) => {
  const total = labor + material + operations || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-[#0b2a53]" style={{ width: `${(labor / total) * 100}%` }} />
        <div className="bg-[#f28c28]" style={{ width: `${(material / total) * 100}%` }} />
        <div className="bg-[#16a34a]" style={{ width: `${(operations / total) * 100}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0b2a53]" />
          Labor {formatTzs(labor)}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#f28c28]" />
          Material {formatTzs(material)}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
          Operations {formatTzs(operations)}
        </span>
      </div>
    </div>
  );
};
