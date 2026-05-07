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
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#f28c28] hover:shadow-xl hover:shadow-orange-100"
              key={s.title}
            >
              {/* Image */}
              {"image" in s && s.image ? (
                <div className="relative h-64 overflow-hidden">
                  <img
                    alt={s.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                    src={s.image}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#001534]/40 to-transparent" />
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center bg-slate-50 transition group-hover:bg-orange-50">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#0b2a53] shadow-sm transition group-hover:text-[#f28c28]">
                    <Icon name={s.iconName} size={32} />
                  </div>
                </div>
              )}
              {/* Text */}
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <h3 className="mb-2 font-[Manrope,sans-serif] text-base font-bold text-[#0b2a53] sm:mb-3 sm:text-xl">{s.title}</h3>
                <p className="flex-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{s.desc}</p>
              </div>
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
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* Parallax background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: "url('/photo10.jpeg')" }}
      />
      <div className="absolute inset-0 bg-[#001534]/40" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-[Manrope,sans-serif] text-2xl font-bold text-white sm:text-4xl">
          Need a Custom Solution?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-white/90 sm:mt-4 sm:text-base">
          Every project is unique. Contact us for a tailored engineering solution that fits your exact needs.
        </p>
        <Link
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#f28c28] px-8 py-4 text-sm font-bold text-slate-900 shadow-lg shadow-orange-500/30 no-underline transition hover:bg-orange-500 sm:py-4"
          to="/contact"
        >
          Contact Our Team <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  </>
);
