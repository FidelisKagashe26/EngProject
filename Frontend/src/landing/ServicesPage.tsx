import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Hammer,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SERVICES } from "./data";
import { Icon } from "./icons";

const PROCESS = [
  { Icon: MessageSquare, step: "01", title: "Consultation",   desc: "We meet to understand your project requirements, budget, and timeline." },
  { Icon: ClipboardList, step: "02", title: "Design & Quote", desc: "Our engineers prepare detailed plans and a transparent cost breakdown." },
  { Icon: Hammer,        step: "03", title: "Execution",      desc: "Our certified team executes the work with precision and daily progress updates." },
  { Icon: CheckCircle2,  step: "04", title: "Handover",       desc: "Final inspection, documentation, and full handover with warranty coverage." },
];

export const ServicesPage = () => (
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
          <Wrench size={14} />
          What We Offer
        </span>
        <h1 className="mt-4 font-[Manrope,sans-serif] text-3xl font-black text-white sm:mt-5 sm:text-5xl lg:text-6xl">
          Our Services
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#adc7f9] sm:mt-5 sm:text-lg">
          From electrical installations to full structural builds — every service delivered with engineering precision and premium quality.
        </p>
      </div>
    </section>

    {/* Services grid */}
    <section className="bg-[#faf9fd] py-14 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#f28c28] hover:shadow-xl hover:shadow-orange-100 sm:p-8"
              key={s.title}
            >
              <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-2xl bg-slate-50 text-[#0b2a53] transition group-hover:bg-orange-50 group-hover:text-[#f28c28] sm:h-16 sm:w-16">
                <Icon name={s.iconName} size={28} />
              </div>
              <h3 className="mb-2 font-[Manrope,sans-serif] text-base font-bold text-[#0b2a53] sm:mb-3 sm:text-xl">{s.title}</h3>
              <p className="flex-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{s.desc}</p>
              <Link
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#f28c28] no-underline transition hover:gap-2.5 sm:mt-6"
                to="/contact"
              >
                Get a Quote <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Process */}
    <section className="bg-[#0b2a53] py-14 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:mb-14">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
            <ClipboardList size={14} />
            How We Work
          </span>
          <h2 className="mt-3 font-[Manrope,sans-serif] text-2xl font-bold text-white sm:mt-4 sm:text-4xl">
            Our Process
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {PROCESS.map((p) => (
            <div
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:border-[#f28c28]/40 hover:bg-white/10 sm:p-8"
              key={p.step}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f28c28]/15 text-[#f28c28] sm:mb-4 sm:h-12 sm:w-12">
                <p.Icon size={22} />
              </div>
              <span className="mb-2 block font-[Manrope,sans-serif] text-2xl font-black text-[#f28c28] sm:mb-3 sm:text-3xl">
                {p.step}
              </span>
              <h3 className="mb-1.5 font-[Manrope,sans-serif] text-base font-bold text-white sm:mb-2 sm:text-lg">{p.title}</h3>
              <p className="text-xs leading-relaxed text-[#7992c1] sm:text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="bg-[#faf9fd] py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-[Manrope,sans-serif] text-xl font-bold text-[#0b2a53] sm:text-3xl">
          Need a Custom Solution?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-slate-500 sm:mt-4 sm:text-base">
          Every project is unique. Contact us for a tailored engineering solution that fits your exact needs.
        </p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#f28c28] px-8 py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-orange-200 no-underline transition hover:bg-orange-500 sm:mt-8 sm:py-4"
          to="/contact"
        >
          Contact Our Team <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  </>
);
