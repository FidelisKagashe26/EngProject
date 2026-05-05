import { LogIn, Menu, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import {
  FaEnvelope,
  FaFacebook,
  FaInstagram,
  FaLinkedinIn,
  FaLocationDot,
  FaPhone,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6";
import { MdAccessTime } from "react-icons/md";
import { Home, Image, Info, Mail, Wrench } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { GlobalLoader } from "../components/GlobalLoader";
import { useWebsiteSettings } from "./WebsiteSettingsContext";

const NAV_LINKS = [
  { label: "Home",     to: "/",        Icon: Home },
  { label: "Services", to: "/services", Icon: Wrench },
  { label: "About",    to: "/about",    Icon: Info },
  { label: "Gallery",  to: "/gallery",  Icon: Image },
  { label: "Contact",  to: "/contact",  Icon: Mail },
];

export const LandingLayout = () => {
  const [open, setOpen] = useState(false);
  const { settings } = useWebsiteSettings();

  const socials = [
    { Icon: FaLinkedinIn,  href: settings.social_linkedin  || "#", label: "LinkedIn"  },
    { Icon: FaFacebook,    href: settings.social_facebook  || "#", label: "Facebook"  },
    { Icon: FaInstagram,   href: settings.social_instagram || "#", label: "Instagram" },
    { Icon: FaXTwitter,    href: settings.social_twitter   || "#", label: "Twitter/X" },
  ];

  return (
    <div className="min-h-screen bg-[#faf9fd] font-[Inter,sans-serif] text-[#1a1b1f]">
      <GlobalLoader />

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-[92px] sm:px-6 lg:px-8">

          {/* Logo */}
          <Link className="inline-flex items-center no-underline" to="/">
            <img alt="DREGGAM" className="h-9 w-auto object-contain sm:h-20" src="/EngLogo.png" />
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map(({ label, to, Icon }) => (
              <NavLink
                className={({ isActive }) =>
                  `relative inline-flex items-center gap-1.5 px-1 pb-1 text-sm font-semibold tracking-wide no-underline transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-[#f28c28] after:transition-transform after:duration-200 ${
                    isActive
                      ? "text-[#f28c28] after:scale-x-100"
                      : "text-slate-600 hover:text-[#f28c28] hover:after:scale-x-100"
                  }`
                }
                end={to === "/"}
                key={label}
                to={to}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              className="flex items-center gap-1.5 rounded-lg bg-[#f28c28] px-4 py-2 text-sm font-bold text-slate-900 no-underline transition hover:bg-orange-500"
              to="/contact"
            >
              <MessageSquare size={15} />
              Get a Quote
            </Link>
            <Link
              className="flex items-center gap-1.5 rounded-lg bg-[#0b2a53] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#123b71]"
              to="/login"
            >
              <LogIn size={15} />
              Client Login
            </Link>
          </div>

          {/* Hamburger */}
          <button
            aria-label="Toggle menu"
            className="rounded-md p-2 text-[#0b2a53] md:hidden"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="border-t border-slate-100 bg-white px-4 pb-5 pt-2 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ label, to, Icon }) => (
                <NavLink
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold no-underline transition ${
                      isActive ? "bg-orange-50 text-[#f28c28]" : "text-slate-700 hover:bg-slate-50"
                    }`
                  }
                  end={to === "/"}
                  key={label}
                  onClick={() => setOpen(false)}
                  to={to}
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
                <Link
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#f28c28] px-4 py-3 text-sm font-bold text-slate-900 no-underline"
                  onClick={() => setOpen(false)}
                  to="/contact"
                >
                  <MessageSquare size={15} /> Get a Quote
                </Link>
                <Link
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#0b2a53] px-4 py-3 text-sm font-semibold text-white no-underline"
                  onClick={() => setOpen(false)}
                  to="/login"
                >
                  <LogIn size={15} /> Client Login
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Page content ── */}
      <main><Outlet /></main>

      {/* ── Footer ── */}
      <footer className="relative text-[#c8d8f0]">
        {/* Background image with lighter overlay so photo shows through */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/photo3.jpeg')" }}
        />
        <div className="absolute inset-0 bg-[#001534]/72" />

        {/* Content */}
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:px-8">

          {/* 4-column grid */}
          <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">

            {/* Col 1: Logo + tagline */}
            <div className="col-span-2 lg:col-span-1">
              <img
                alt="DREGGAM"
                className="mb-5 h-28 w-auto object-contain drop-shadow-lg sm:h-36"
                src="/EngLogo.png"
              />
              <p className="text-sm leading-relaxed text-[#adc7f9]">
                Precision-engineered solutions for electrical, plumbing, security, and high-end construction — delivered on time, every time.
              </p>
            </div>

            {/* Col 2: Company */}
            <div>
              <h4 className="mb-5 text-sm font-bold uppercase tracking-widest text-[#f28c28]">Company</h4>
              <ul className="flex flex-col gap-3">
                {[["About", "/about"], ["Gallery", "/gallery"], ["Services", "/services"], ["Contact", "/contact"]].map(([label, href]) => (
                  <li key={label}>
                    <Link
                      className="inline-flex items-center gap-2 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                      to={href}
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-[#f28c28]" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Services */}
            <div>
              <h4 className="mb-5 text-sm font-bold uppercase tracking-widest text-[#f28c28]">Services</h4>
              <ul className="flex flex-col gap-3">
                {["Electrical", "Plumbing", "CCTV & Security", "Electric Fence", "Construction"].map((s) => (
                  <li key={s}>
                    <Link
                      className="inline-flex items-center gap-2 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                      to="/services"
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-[#f28c28]" />
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: Mawasiliano + social icons */}
            <div>
              <h4 className="mb-5 text-sm font-bold uppercase tracking-widest text-[#f28c28]">Mawasiliano</h4>
              <ul className="flex flex-col gap-3">
                {settings.phone_main && (
                  <li>
                    <a
                      className="flex items-center gap-2.5 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                      href={`tel:${settings.phone_main}`}
                    >
                      <FaPhone className="h-3.5 w-3.5 shrink-0 text-[#f28c28]" />
                      {settings.phone_main}
                    </a>
                  </li>
                )}
                {settings.phone_whatsapp && (
                  <li>
                    <a
                      className="flex items-center gap-2.5 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                      href={`https://wa.me/${settings.phone_whatsapp.replace(/\D/g, "")}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <FaWhatsapp className="h-3.5 w-3.5 shrink-0 text-green-400" />
                      {settings.phone_whatsapp}
                    </a>
                  </li>
                )}
                {settings.email_main && (
                  <li>
                    <a
                      className="flex items-center gap-2.5 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                      href={`mailto:${settings.email_main}`}
                    >
                      <FaEnvelope className="h-3.5 w-3.5 shrink-0 text-[#f28c28]" />
                      {settings.email_main}
                    </a>
                  </li>
                )}
                {settings.location && (
                  <li className="flex items-start gap-2.5 text-sm text-[#adc7f9]">
                    <FaLocationDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f28c28]" />
                    {settings.location}
                  </li>
                )}
                {settings.hours && (
                  <li className="flex items-center gap-2.5 text-sm text-[#adc7f9]">
                    <MdAccessTime className="h-3.5 w-3.5 shrink-0 text-[#f28c28]" />
                    {settings.hours}
                  </li>
                )}
              </ul>

              {/* Social icons below contact */}
              <div className="mt-6 flex gap-2">
                {socials.map(({ Icon, href, label }) => (
                  <a
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-[#adc7f9] no-underline transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                    href={href}
                    key={label}
                    rel="noopener noreferrer"
                    target={href !== "#" ? "_blank" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-[#7992c1] sm:flex-row sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} DREGGAM Engineering. Precision in every detail.</p>
            <div className="flex gap-6">
              <a className="no-underline transition hover:text-[#f28c28]" href="#">Privacy Policy</a>
              <a className="no-underline transition hover:text-[#f28c28]" href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
