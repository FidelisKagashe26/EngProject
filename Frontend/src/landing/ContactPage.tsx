import {
  CheckCircle2,
  ChevronDown,
  Clock,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CONTACT_INFO as FALLBACK_CONTACT_INFO } from "./data";
import { api, ApiError } from "../services/api";
import { useWebsiteSettings } from "./WebsiteSettingsContext";

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  MapPin,
  Phone,
  Mail,
  Clock,
};

const SERVICE_OPTIONS = [
  { value: "electrical", label: "Electrical Installation" },
  { value: "fence",      label: "Electric Fence" },
  { value: "plumbing",   label: "Plumbing" },
  { value: "cctv",       label: "CCTV & Security" },
  { value: "interior",   label: "Interior & Exterior" },
  { value: "construction", label: "General Construction" },
];

const FAQ = [
  {
    q: "How long does a typical project take?",
    a: "Project timelines vary by scope. A standard residential electrical installation takes 3–7 days. Full construction projects range from 3 months to 2 years.",
  },
  {
    q: "Do you provide warranties on your work?",
    a: "Yes. All our work comes with a minimum 1-year workmanship warranty. Electrical and plumbing systems carry a 2-year warranty.",
  },
  {
    q: "Can you handle projects outside Dar es Salaam?",
    a: "Absolutely. We operate across Tanzania and have completed projects in Arusha, Mwanza, Dodoma, and Zanzibar.",
  },
  {
    q: "How do I get a quote?",
    a: "Fill out the form on this page or call us directly. We'll schedule a site visit and provide a detailed quote within 48 hours.",
  },
];

/* ── Custom GUI Select ── */
const ServiceSelect = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = SERVICE_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`gui-select-trigger w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm transition focus:outline-none ${
          open
            ? "border-[#f28c28] ring-2 ring-orange-100"
            : "border-slate-200 hover:border-slate-300"
        } ${selected ? "text-slate-900" : "text-slate-400"}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span>{selected ? selected.label : "Select a service"}</span>
        <ChevronDown
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          size={16}
        />
      </button>

      {open && (
        <div className="gui-select-menu">
          {SERVICE_OPTIONS.map((opt) => (
            <button
              className={`gui-select-option ${value === opt.value ? "gui-select-option-selected" : ""}`}
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              type="button"
            >
              {opt.label}
              {value === opt.value && (
                <CheckCircle2 className="shrink-0 text-[#0b2a53]" size={15} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ContactPage = () => {
  const { settings } = useWebsiteSettings();
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Build contact info from live settings, fall back to static data
  const contactInfo = [
    { iconName: "MapPin", label: "Location", value: settings.location || FALLBACK_CONTACT_INFO[0].value },
    { iconName: "Phone",  label: "Phone",    value: settings.phone_main || FALLBACK_CONTACT_INFO[1].value },
    { iconName: "Mail",   label: "Email",    value: settings.email_main || FALLBACK_CONTACT_INFO[2].value },
    { iconName: "Clock",  label: "Hours",    value: settings.hours || FALLBACK_CONTACT_INFO[3].value },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.submitQuoteRequest({
        fullName: form.name,
        email: form.email,
        phone: form.phone,
        service: form.service,
        message: form.message,
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to send message. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0b2a53] py-16 lg:py-28">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/photo1.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#001534]/85 via-[#0b2a53]/75 to-[#0b2a53]/85" />
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
            <Mail size={14} />
            Get In Touch
          </span>
          <h1 className="mt-4 font-[Manrope,sans-serif] text-3xl font-black text-white sm:mt-5 sm:text-5xl lg:text-6xl">
            Contact Us
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#adc7f9] sm:mt-5 sm:text-lg">
            Ready to start your project? Our team is available 24/7 to answer your questions and provide a free quote.
          </p>
        </div>
      </section>

      {/* Contact grid */}
      <section className="bg-[#faf9fd] py-12 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">

            {/* Info */}
            <div>
              <h2 className="font-[Manrope,sans-serif] text-xl font-bold text-[#0b2a53] sm:text-3xl">
                Let's Build Something Great
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:mt-4 sm:text-base">
                Whether you have a detailed brief or just an idea, we're here to help turn your vision into reality.
              </p>

              <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-5">
                {contactInfo.map((item) => {
                  const IconComp = ICON_MAP[item.iconName];
                  return (
                    <div className="flex items-start gap-3 sm:gap-4" key={item.label}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b2a53]/8 text-[#0b2a53] sm:h-12 sm:w-12">
                        {IconComp && <IconComp size={20} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#f28c28] sm:text-xs">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-[#0b2a53] sm:text-base">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Map placeholder */}
              <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 sm:mt-10">
                <div className="flex h-48 items-center justify-center bg-gradient-to-br from-[#0b2a53]/8 to-[#f28c28]/8 sm:h-56">
                  <div className="text-center">
                    <MapPin className="mx-auto mb-2 text-[#f28c28]" size={32} />
                    <p className="text-sm font-semibold text-[#0b2a53]">Dar es Salaam, Tanzania</p>
                    <p className="text-xs text-slate-400">Map integration available on request</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-100 sm:p-8 lg:p-10">
              {sent ? (
                <div className="flex flex-col items-center py-8 text-center sm:py-10">
                  <CheckCircle2 className="text-green-500" size={48} />
                  <h3 className="mt-4 font-[Manrope,sans-serif] text-xl font-bold text-[#0b2a53] sm:mt-5 sm:text-2xl">
                    Message Sent!
                  </h3>
                  <p className="mt-3 text-sm text-slate-500 sm:text-base">
                    Thank you for reaching out. Our team will contact you within 24 hours.
                  </p>
                  <button
                    className="mt-6 rounded-xl bg-[#f28c28] px-8 py-3 text-sm font-bold text-slate-900 transition hover:bg-orange-500 sm:mt-8"
                    onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", service: "", message: "" }); }}
                    type="button"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-4 sm:gap-5" onSubmit={handleSubmit}>
                  <h3 className="font-[Manrope,sans-serif] text-lg font-bold text-[#0b2a53] sm:text-xl">
                    Request a Free Quote
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Full Name *</span>
                      <input
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#f28c28] focus:ring-2 focus:ring-orange-100 sm:py-3"
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="John Doe"
                        required
                        type="text"
                        value={form.name}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Email *</span>
                      <input
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#f28c28] focus:ring-2 focus:ring-orange-100 sm:py-3"
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="john@example.com"
                        required
                        type="email"
                        value={form.email}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Phone</span>
                      <input
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#f28c28] focus:ring-2 focus:ring-orange-100 sm:py-3"
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+255 ..."
                        type="tel"
                        value={form.phone}
                      />
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Service Needed</span>
                      <ServiceSelect
                        value={form.service}
                        onChange={(v) => setForm((p) => ({ ...p, service: v }))}
                      />
                    </div>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Message *</span>
                    <textarea
                      className="min-h-[100px] resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#f28c28] focus:ring-2 focus:ring-orange-100 sm:min-h-[120px] sm:py-3"
                      onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                      placeholder="Describe your project..."
                      required
                      value={form.message}
                    />
                  </label>

                  {error && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {error}
                    </p>
                  )}

                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f28c28] py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-orange-200 transition hover:bg-orange-500 disabled:opacity-60 sm:py-4"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? "Sending..." : <><Send size={16} /> Send Message</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-12 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center sm:mb-12">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
              <HelpCircle size={14} />
              FAQ
            </span>
            <h2 className="mt-3 font-[Manrope,sans-serif] text-2xl font-bold text-[#0b2a53] sm:mt-4 sm:text-3xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="flex flex-col gap-3 sm:gap-4">
            {FAQ.map((faq) => (
              <div className="rounded-2xl border border-slate-200 bg-[#faf9fd] p-5 sm:p-6" key={faq.q}>
                <h3 className="font-[Manrope,sans-serif] text-sm font-bold text-[#0b2a53] sm:text-base">{faq.q}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
