import {
  ArrowRight,
  Award,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { STATS } from "./data";

const VALUES = [
  { Icon: Target,      title: "Precision",  desc: "Every measurement, every joint, every wire — executed to exact specification." },
  { Icon: ShieldCheck, title: "Integrity",  desc: "Transparent pricing, honest timelines, and no hidden costs. Ever." },
  { Icon: Lightbulb,   title: "Innovation", desc: "We adopt the latest engineering technologies to deliver smarter solutions." },
  { Icon: Award,       title: "Excellence", desc: "We don't settle for good enough. Every project is our best project." },
];

const TEAM = [
  { name: "Eng. James Mwangi",    role: "Chief Executive Officer", initials: "JM" },
  { name: "Arch. Fatuma Salim",   role: "Lead Architect",          initials: "FS" },
  { name: "Eng. Peter Odhiambo", role: "Head of Electrical",      initials: "PO" },
  { name: "Eng. Grace Kimani",    role: "Plumbing & Civil Lead",   initials: "GK" },
];

export const AboutPage = () => (
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
          <Users size={14} />
          Who We Are
        </span>
        <h1 className="mt-4 font-[Manrope,sans-serif] text-3xl font-black text-white sm:mt-5 sm:text-5xl lg:text-6xl">
          About DREGGAM
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#adc7f9] sm:mt-5 sm:text-lg">
          Tanzania's leading engineering and construction firm, building premium structures since 2009.
        </p>
      </div>
    </section>

    {/* Story */}
    <section className="bg-[#faf9fd] py-14 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
              Our Story
            </span>
            <h2 className="mt-3 font-[Manrope,sans-serif] text-2xl font-bold text-[#0b2a53] sm:mt-4 sm:text-4xl">
              Engineering Excellence Since 2009
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-500 sm:mt-5 sm:text-base">
              DREGGAM was founded with a single mission: to bring world-class engineering standards to Tanzania's construction industry. What started as a small electrical contracting firm has grown into a full-service engineering powerhouse.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:mt-4 sm:text-base">
              Today, our team of 50+ certified engineers, architects, and project managers delivers residential, commercial, and infrastructure projects across East Africa — always on budget, always on schedule.
            </p>

            {/* Values checklist */}
            <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:gap-3">
              {["Precision Engineering", "Transparent Pricing", "On-Time Delivery", "Quality Guaranteed"].map((v) => (
                <div className="flex items-center gap-3" key={v}>
                  <CheckCircle2 className="shrink-0 text-[#f28c28]" size={18} />
                  <span className="text-sm font-semibold text-[#0b2a53]">{v}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4">
              {STATS.map((stat) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm sm:p-5"
                  key={stat.label}
                >
                  <span className="block font-[Manrope,sans-serif] text-2xl font-black text-[#f28c28] sm:text-3xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div className="relative">
            <div
              className="h-64 w-full rounded-3xl bg-cover bg-center shadow-2xl sm:h-80 lg:h-[480px]"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCaBpQyLtl3kTFhTfYCl9yna1j8QErfOTdNPAVvw0_OwZFNvnM-yZ97cIOy4Ta3fmOFbrVP-btPKfWR1OzA48zoiJWquMOFJnApTrGxvrLbtmrkT1pSsdgc7w1hTDCextZ5N0a2yG-Vsl_LyobICPL42othfDeDehgOocyupAW78UqMn4_yDPV-wkRx7UXdy0B87eJujUqri7om463OCbpSOsbCi-FF3f_KtT3GSJy9B2e39XA1bz4vnNsq5k_oGWnKR0xjNBrFCZYP')",
              }}
            />
            <div className="absolute -bottom-5 -right-5 hidden rounded-2xl bg-[#f28c28] p-6 text-center shadow-xl shadow-orange-300/40 lg:block">
              <span className="block font-[Manrope,sans-serif] text-4xl font-black text-white">15+</span>
              <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-white/80">
                Years of Excellence
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Values */}
    <section className="bg-white py-14 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:mb-14">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
            What Drives Us
          </span>
          <h2 className="mt-3 font-[Manrope,sans-serif] text-2xl font-bold text-[#0b2a53] sm:mt-4 sm:text-4xl">
            Our Core Values
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div
              className="group rounded-2xl border border-slate-200 bg-[#faf9fd] p-6 text-center transition hover:border-[#f28c28] hover:shadow-lg hover:shadow-orange-100 sm:p-8"
              key={v.title}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#0b2a53] transition group-hover:bg-orange-50 group-hover:text-[#f28c28] sm:mb-5 sm:h-14 sm:w-14">
                <v.Icon size={26} />
              </div>
              <h3 className="mb-2 font-[Manrope,sans-serif] text-base font-bold text-[#0b2a53] sm:mb-3 sm:text-lg">{v.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Team */}
    <section className="bg-[#0b2a53] py-14 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:mb-14">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
            <Users size={14} />
            The People
          </span>
          <h2 className="mt-3 font-[Manrope,sans-serif] text-2xl font-bold text-white sm:mt-4 sm:text-4xl">
            Meet Our Leadership
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((member) => (
            <div
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm transition hover:border-[#f28c28]/40 hover:bg-white/10 sm:p-8"
              key={member.name}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f28c28] font-[Manrope,sans-serif] text-xl font-black text-white sm:mb-5 sm:h-20 sm:w-20 sm:text-2xl">
                {member.initials}
              </div>
              <h3 className="font-[Manrope,sans-serif] text-sm font-bold text-white sm:text-base">{member.name}</h3>
              <p className="mt-1 text-xs text-[#7992c1] sm:text-sm">{member.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="bg-[#faf9fd] py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-[Manrope,sans-serif] text-xl font-bold text-[#0b2a53] sm:text-3xl">
          Ready to Work With Us?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-slate-500 sm:mt-4 sm:text-base">
          Join 200+ satisfied clients who trust DREGGAM to deliver their most important projects.
        </p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#f28c28] px-8 py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-orange-200 no-underline transition hover:bg-orange-500 sm:mt-8 sm:py-4"
          to="/contact"
        >
          Start Your Project <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  </>
);

