import {
  ArrowRight,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GalleryItemRecord } from "../services/api";
import { SERVICES, STATS } from "./data";
import { Icon } from "./icons";

const SectionBadge = ({ children }: { children: string }) => (
  <span className="inline-block text-sm font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
    {children}
  </span>
);

const API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace("/api", "") ??
  "http://localhost:5050";

const resolveImgSrc = (url: string) =>
  url.startsWith("/uploads") ? `${API_ORIGIN}${url}` : url;

export const HomePage = () => {
  const [featuredItems, setFeaturedItems] = useState<GalleryItemRecord[]>([]);

  useEffect(() => {
    api
      .getPublicGallery()
      .then((data) => setFeaturedItems(data.items.slice(0, 3)))
      .catch(() => {/* silently ignore */});
  }, []);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden bg-[#001534]">
        <div className="home-hero-slider" aria-hidden="true">
          <div className="home-hero-slider-track">
            <div className="home-hero-slide" style={{ backgroundImage: "url('/photo2.png')" }} />
            <div className="home-hero-slide" style={{ backgroundImage: "url('/photo2.png')" }} />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#001534]/62 via-[#0b2a53]/38 to-[#f28c28]/12" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="mx-auto mt-6 max-w-4xl font-[Manrope,sans-serif] text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-[64px]">
            Building Smart,<br className="hidden sm:block" /> Secure &amp; Modern Homes
          </h1>

          <p className="mx-auto mt-4 text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
            Tanzania&apos;s Premier Engineering Firm
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-[#adc7f9] sm:text-lg">
            Precision-engineered solutions for electrical, plumbing, security, and high-end construction — delivered on time, every time.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f28c28] px-8 py-4 text-sm font-bold text-slate-900 shadow-lg shadow-orange-500/30 no-underline transition hover:-translate-y-0.5 hover:bg-orange-500 sm:w-auto"
              to="/contact"
            >
              Get a Free Quote <ChevronRight size={16} />
            </Link>
            <Link
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/50 px-8 py-4 text-sm font-semibold text-white no-underline backdrop-blur-sm transition hover:border-white hover:bg-white/10 sm:w-auto"
              to="/services"
              style={{ color: "#ffffff" }}
            >
              <span style={{ color: "#ffffff" }}>View Services</span>{" "}
              <ChevronRight size={16} style={{ color: "#ffffff" }} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-[#0b2a53] py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm sm:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                className={`px-4 py-6 text-center ${i < STATS.length - 1 ? "border-r border-white/10" : ""}`}
                key={stat.label}
              >
                <span className="block font-[Manrope,sans-serif] text-2xl font-black text-[#f28c28] sm:text-3xl">
                  {stat.value}
                </span>
                <span className="mt-1 block text-xs font-medium text-[#adc7f9]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services preview ── */}
      <section className="bg-[#faf9fd] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <SectionBadge>What We Do</SectionBadge>
            <h2 className="mt-4 font-[Manrope,sans-serif] text-3xl font-bold text-[#0b2a53] sm:text-4xl">
              Our Expertise
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
              Comprehensive engineering and construction services delivered with unyielding precision.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#f28c28] hover:shadow-lg hover:shadow-orange-100"
                key={s.title}
              >
                {/* Image (if available) or icon */}
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
                <div className="p-6">
                  <h3 className="mb-2 font-[Manrope,sans-serif] text-lg font-bold text-[#0b2a53]">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-[#0b2a53] px-8 py-3.5 text-sm font-semibold text-white no-underline transition hover:bg-[#123b71]"
              to="/services"
            >
              View All Services <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured projects ── */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <SectionBadge>Our Work</SectionBadge>
              <h2 className="mt-4 font-[Manrope,sans-serif] text-3xl font-bold text-[#0b2a53] sm:text-4xl">
                Featured Projects
              </h2>
            </div>
            <Link
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[#f28c28] no-underline hover:underline"
              to="/gallery"
            >
              View Full Gallery <ArrowRight size={14} />
            </Link>
          </div>

          {featuredItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredItems.map((item) => (
                <div className="group relative h-64 overflow-hidden rounded-2xl sm:h-72" key={item.id}>
                  <img
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                    src={resolveImgSrc(item.imageUrl)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#001534]/90 via-[#001534]/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-5">
                    <span className="mb-2 inline-block rounded bg-[#f28c28] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                      {item.category}
                    </span>
                    <h3 className="font-[Manrope,sans-serif] text-base font-bold text-white">{item.title}</h3>
                    {item.subtitle && (
                      <p className="text-xs text-[#adc7f9]">{item.subtitle}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Project images will appear here</p>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/photo3.jpeg')" }}
        />
        <div className="absolute inset-0 bg-[#001534]/40" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-4 flex justify-center">
            <TrendingUp className="text-[#f28c28]" size={40} />
          </div>
          <h2 className="font-[Manrope,sans-serif] text-3xl font-bold text-white sm:text-4xl">
            Ready to Start Your Project?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90">
            Get a free consultation and quote from our expert engineering team today.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f28c28] px-8 py-4 text-sm font-bold text-slate-900 shadow-lg shadow-orange-500/30 no-underline transition hover:bg-orange-500 sm:w-auto"
              to="/contact"
            >
              Get a Free Quote <ChevronRight size={16} />
            </Link>
            <Link
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-slate-900 shadow-lg shadow-white/30 no-underline transition hover:bg-slate-100 sm:w-auto"
              to="/about"
            >
              Learn About Us <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};
