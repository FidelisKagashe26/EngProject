import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  X,
  XCircle,
} from "lucide-react";

type BadgeTone =
  | "Active"
  | "Pending"
  | "Inactive"
  | "Completed"
  | "On Hold"
  | "Over Budget"
  | "Payment Pending"
  | "Closed"
  | "Approved"
  | "Received"
  | "Partial"
  | "Flagged"
  | "Delivered"
  | "Pending Delivery"
  | "Partially Delivered"
  | "In Use"
  | "Under Maintenance"
  | "Idle"
  | "Reconciled"
  | "Invited"
  | "Suspended";

const badgeClass: Record<BadgeTone, string> = {
  Active: "bg-blue-50 text-blue-800 border-blue-200",
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  Inactive: "bg-slate-100 text-slate-700 border-slate-200",
  Completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "On Hold": "bg-orange-50 text-orange-800 border-orange-200",
  "Over Budget": "bg-red-50 text-red-800 border-red-200",
  "Payment Pending": "bg-yellow-50 text-yellow-800 border-yellow-200",
  Closed: "bg-slate-100 text-slate-700 border-slate-200",
  Approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Received: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Partial: "bg-amber-50 text-amber-800 border-amber-200",
  Flagged: "bg-red-50 text-red-800 border-red-200",
  Delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Pending Delivery": "bg-amber-50 text-amber-800 border-amber-200",
  "Partially Delivered": "bg-orange-50 text-orange-800 border-orange-200",
  "In Use": "bg-blue-50 text-blue-800 border-blue-200",
  "Under Maintenance": "bg-orange-50 text-orange-800 border-orange-200",
  Idle: "bg-slate-100 text-slate-700 border-slate-200",
  Reconciled: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Invited: "bg-indigo-50 text-indigo-800 border-indigo-200",
  Suspended: "bg-red-50 text-red-800 border-red-200",
};

export const StatusBadge = ({ status }: { status: BadgeTone | string }) => {
  const tone = (status in badgeClass ? status : "Pending") as BadgeTone;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass[tone]}`}
    >
      {status}
    </span>
  );
};

export const SurfaceCard = ({
  title,
  subtitle,
  right,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <section className={`surface-card ${className ?? ""}`}>
    {(title || subtitle || right) && (
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </header>
    )}
    {children}
  </section>
);

export const KpiCard = ({
  label,
  value,
  meta,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  meta?: string;
  icon: ReactNode;
  accent?: boolean;
}) => (
  <article
    className={
      accent
        ? "rounded-2xl border border-[#0b2a53] bg-[#0b2a53] p-4 shadow-sm"
        : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    }
  >
    <div className="mb-3 flex items-start justify-between">
      <span className={accent ? "text-xs font-semibold uppercase tracking-wide text-blue-100" : "text-xs font-semibold uppercase tracking-wide text-slate-500"}>
        {label}
      </span>
      <span className={accent ? "text-blue-100" : "text-[#0b2a53]/60"}>{icon}</span>
    </div>
    <p className={accent ? "text-xl font-bold text-white sm:text-2xl" : "text-xl font-bold text-slate-900 sm:text-2xl"}>{value}</p>
    {meta && <p className={accent ? "mt-2 text-xs text-blue-100" : "mt-2 text-xs text-slate-500"}>{meta}</p>}
  </article>
);

export const ProgressBar = ({ value }: { value: number }) => {
  const safe = Math.max(0, Math.min(100, value));
  const color =
    safe >= 85 ? "bg-red-500" : safe >= 65 ? "bg-amber-500" : "bg-[#0b2a53]";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${safe}%` }} />
      </div>
      <span className="w-11 text-right text-xs font-semibold text-slate-600">{safe}%</span>
    </div>
  );
};

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <p className="text-base font-semibold text-slate-700">{title}</p>
    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{description}</p>
    {actionLabel && (
      <button className="btn-primary mt-5" onClick={onAction} type="button">
        {actionLabel}
      </button>
    )}
  </div>
);

export const SkeletonCards = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4" key={`sk-card-${index}`}>
        <div className="h-3 w-20 rounded bg-slate-200" />
        <div className="mt-4 h-7 w-36 rounded bg-slate-200" />
        <div className="mt-3 h-3 w-28 rounded bg-slate-200" />
      </div>
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 4 }: { rows?: number }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200">
    <div className="animate-pulse bg-white">
      <div className="h-12 border-b border-slate-100 bg-slate-50" />
      {Array.from({ length: rows }).map((_, index) => (
        <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-4" key={`sk-row-${index}`}>
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="h-4 w-16 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  </div>
);

export const SectionTitle = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const TablePagination = ({
  page,
  totalPages,
  pageSize,
  totalCount,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
  pageSizeOptions = [5, 10, 20],
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
}) => {
  const safeStart = totalCount === 0 ? 0 : startIndex + 1;
  const safeEnd = totalCount === 0 ? 0 : endIndex;
  const safePage = Math.max(1, Math.min(page, totalPages));

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing {safeStart}-{safeEnd} of {totalCount} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="form-field !gap-0 !text-[10px]">
          <span className="!text-slate-500">Rows per page</span>
          <GuiSelect
            className="h-9 min-w-[84px]"
            fullWidth={false}
            onChange={(event) => onPageSizeChange(Number(event.target.value) || pageSizeOptions[0] || 5)}
            value={String(pageSize)}
          >
            {pageSizeOptions.map((size) => (
              <option key={`page-size-${size}`} value={String(size)}>
                {size}
              </option>
            ))}
          </GuiSelect>
        </label>
        <button
          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(safePage - 1, 1))}
          type="button"
        >
          Previous
        </button>
        <span className="text-xs font-semibold text-slate-600">
          Page {safePage} of {totalPages}
        </span>
        <button
          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(safePage + 1, totalPages))}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const normalizeMoneyInput = (raw: string): string => raw.replace(/[^\d]/g, "");

const addThousandsSeparators = (raw: string): string => {
  if (raw.length === 0) {
    return "";
  }
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const FinancialInput = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value?: string;
  onChange?: (next: string) => void;
  placeholder: string;
  required?: boolean;
}) => {
  const isControlled = value !== undefined;
  const [internalRawValue, setInternalRawValue] = useState("");

  const rawValue = isControlled
    ? normalizeMoneyInput(value ?? "")
    : internalRawValue;

  const displayValue = addThousandsSeparators(rawValue);

  return (
    <label className="form-field">
      <span>
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
          TZS
        </span>
        <input
          className="input-field pl-12"
          inputMode="numeric"
          onChange={(event) => {
            const nextRaw = normalizeMoneyInput(event.target.value);
            if (!isControlled) {
              setInternalRawValue(nextRaw);
            }
            onChange?.(nextRaw);
          }}
          placeholder={placeholder}
          required={required}
          type="text"
          value={displayValue}
        />
      </div>
    </label>
  );
};

type GuiSelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

type GuiSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  fullWidth?: boolean;
  placeholder?: string;
};

const toOptionLabel = (value: ReactNode): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  const parts: string[] = [];
  Children.forEach(value, (child) => {
    parts.push(toOptionLabel(child));
  });
  return parts.join(" ").trim();
};

const parseOptions = (children: ReactNode): GuiSelectOption[] => {
  const parsed: GuiSelectOption[] = [];

  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        value?: string;
        disabled?: boolean;
        children?: ReactNode;
      }>(child) ||
      child.type !== "option"
    ) {
      return;
    }

    const rawValue = child.props.value ?? toOptionLabel(child.props.children);
    parsed.push({
      value: String(rawValue),
      label: toOptionLabel(child.props.children),
      disabled: Boolean(child.props.disabled),
    });
  });

  return parsed;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : [];

const asSingleValue = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const toChangeEvent = (
  value: string,
  name: string | undefined,
): React.ChangeEvent<HTMLSelectElement> => {
  return {
    target: {
      value,
      name: name ?? "",
    },
  } as React.ChangeEvent<HTMLSelectElement>;
};

export const GuiSelect = ({
  children,
  value,
  defaultValue,
  onChange,
  className = "",
  disabled = false,
  multiple = false,
  fullWidth = true,
  placeholder = "Select option",
  name,
  ...rest
}: GuiSelectProps) => {
  const options = useMemo(() => parseOptions(children), [children]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const initialSingle = useMemo(() => {
    if (defaultValue !== undefined) return asSingleValue(defaultValue);
    return options[0]?.value ?? "";
  }, [defaultValue, options]);

  const initialMulti = useMemo(() => {
    if (defaultValue !== undefined) return asStringArray(defaultValue);
    return [];
  }, [defaultValue]);

  const [internalSingle, setInternalSingle] = useState(initialSingle);
  const [internalMulti, setInternalMulti] = useState<string[]>(initialMulti);

  const isControlled = value !== undefined;
  const selectedSingle = multiple
    ? ""
    : isControlled
      ? asSingleValue(value)
      : internalSingle;
  const selectedMulti = multiple
    ? isControlled
      ? asStringArray(value)
      : internalMulti
    : [];

  useEffect(() => {
    if (!multiple && !isControlled && options.length > 0 && !options.some((opt) => opt.value === internalSingle)) {
      setInternalSingle(options[0].value);
    }
  }, [multiple, isControlled, options, internalSingle]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const singleLabel = useMemo(() => {
    const found = options.find((opt) => opt.value === selectedSingle);
    return found?.label ?? placeholder;
  }, [options, placeholder, selectedSingle]);

  const multiLabel = useMemo(() => {
    if (selectedMulti.length === 0) {
      return placeholder;
    }

    const labels = selectedMulti
      .map((selected) => options.find((opt) => opt.value === selected)?.label ?? selected)
      .filter((label) => label.trim().length > 0);

    if (labels.length <= 2) {
      return labels.join(", ");
    }

    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [options, placeholder, selectedMulti]);

  const triggerClass = `input-field gui-select-trigger ${className}`;

  const selectSingle = (nextValue: string) => {
    if (!isControlled) {
      setInternalSingle(nextValue);
    }
    onChange?.(toChangeEvent(nextValue, name));
    setOpen(false);
  };

  const toggleMulti = (nextValue: string) => {
    const current = selectedMulti;
    const exists = current.includes(nextValue);
    const next = exists
      ? current.filter((item) => item !== nextValue)
      : [...current, nextValue];

    if (!isControlled) {
      setInternalMulti(next);
    }
    onChange?.(toChangeEvent(next.join(","), name));
  };

  return (
    <div className={`relative ${fullWidth ? "w-full" : "w-auto"}`} ref={containerRef}>
      <button
        className={triggerClass}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate text-left">
          {multiple ? multiLabel : singleLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="gui-select-menu">
          {options.map((option) => {
            const selected = multiple
              ? selectedMulti.includes(option.value)
              : selectedSingle === option.value;

            return (
              <button
                className={`gui-select-option ${selected ? "gui-select-option-selected" : ""}`}
                disabled={option.disabled}
                key={`${name ?? "select"}-${option.value}`}
                onClick={() => {
                  if (multiple) {
                    toggleMulti(option.value);
                    return;
                  }

                  selectSingle(option.value);
                }}
                type="button"
              >
                <span className="truncate">{option.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {multiple ? (
        selectedMulti.map((selectedValue) => (
          <input
            key={`${name ?? "gui-select-multi"}-${selectedValue}`}
            name={name ? `${name}[]` : undefined}
            type="hidden"
            value={selectedValue}
          />
        ))
      ) : (
        <input name={name} type="hidden" value={selectedSingle} {...(rest.required ? { required: true } : {})} />
      )}
    </div>
  );
};

type AppToastTone = "success" | "error" | "info";

export const AppToast = ({
  open,
  title,
  message,
  onClose,
  tone = "success",
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  tone?: AppToastTone;
}) => {
  if (!open) {
    return null;
  }

  const icon =
    tone === "error" ? (
      <XCircle className="app-toast-icon" />
    ) : tone === "info" ? (
      <Info className="app-toast-icon" />
    ) : (
      <CheckCircle2 className="app-toast-icon" />
    );

  return (
    <div className={`app-toast app-toast-${tone}`}>
      {icon}
      <div className="flex-1">
        <p className="app-toast-title">{title}</p>
        <p className="app-toast-message">{message}</p>
      </div>
      <button className="app-toast-close" onClick={onClose} type="button">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const SuccessToast = ({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) => {
  if (!open) {
    return null;
  }

  return <AppToast message={message} onClose={onClose} open={open} title={title} tone="success" />;
};

export const ConfirmModal = ({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmLabel = "Delete",
  confirmClassName = "btn-danger",
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmClassName?: string;
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <p className="text-sm text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className={confirmClassName} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AlertCallout = ({
  tone,
  title,
  text,
}: {
  tone: "info" | "warning" | "danger";
  title: string;
  text: string;
}) => {
  const config =
    tone === "danger"
      ? {
          icon: <XCircle className="h-4 w-4" />,
          className: "alert-callout alert-callout-danger",
        }
      : tone === "warning"
      ? {
          icon: <AlertTriangle className="h-4 w-4" />,
          className: "alert-callout alert-callout-warning",
        }
      : {
          icon: <Info className="h-4 w-4" />,
          className: "alert-callout alert-callout-info",
        };

  return (
    <div className={config.className}>
      <p className="alert-callout-title">
        {config.icon}
        {title}
      </p>
      <p className="alert-callout-text">{text}</p>
    </div>
  );
};
