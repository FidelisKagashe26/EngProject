import {
  Building2,
  Camera,
  Clock,
  Droplet,
  Home,
  Image,
  Info,
  LogIn,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Phone,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { FaFacebook, FaInstagram, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { Link, NavLink, Outlet } from "react-router-dom";
import { GlobalLoader } from "../components/GlobalLoader";
import { useWebsiteSettings } from "./WebsiteSettingsContext";
import { useSmoothScroll } from "./useSmoothScroll";

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
  useSmoothScroll();

  const socials = [
    { Icon: FaLinkedinIn,  href: settings.social_linkedin  || "#", label: "LinkedIn"  },
    { Icon: FaFacebook,    href: settings.social_facebook  || "#", label: "Facebook"  },
    { Icon: FaInstagram,   href: settings.social_instagram || "#", label: "Instagram" },
    { Icon: FaXTwitter,    href: settings.social_twitter   || "#", label: "Twitter/X" },
  ];

  return (
    <div className="min-h-screen bg-[#faf9fd] font-sans text-[#1a1b1f]">
      <GlobalLoader />

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-24 sm:px-6 lg:px-8">

          {/* Logo — kushoto mobile, kushoto desktop */}
          <Link className="inline-flex items-center no-underline" to="/">
            <img alt="DREGGAM" className="h-14 w-auto object-contain sm:h-20" src="/EngLogo.png" />
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
          <div className="hidden items-center gap-2 md:flex">
            <Link
              className="flex items-center gap-1.5 rounded-lg bg-[#f28c28] px-4 py-2 text-sm font-bold text-slate-900 no-underline transition hover:bg-orange-500"
              to="/contact"
            >
              <MessageSquare size={15} />
              Get a Quote
            </Link>
            {/* Call and WhatsApp icons */}
            {settings.phone_main && (
              <a
                aria-label="Call"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f28c28] text-white no-underline transition hover:bg-orange-500"
                href={`tel:${settings.phone_main}`}
                title={settings.phone_main}
              >
                <Phone size={18} className="stroke-[2.5]" />
              </a>
            )}
            {settings.phone_whatsapp && (
              <a
                aria-label="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-white no-underline transition hover:bg-green-600"
                href={`https://wa.me/${settings.phone_whatsapp.replace(/\D/g, "")}`}
                rel="noopener noreferrer"
                target="_blank"
                title={settings.phone_whatsapp}
              >
                <MessageCircle size={18} />
              </a>
            )}
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
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Page content ── */}
      <main><Outlet /></main>

      {/* ── Footer ── */}
      <footer className="relative bg-[#001534] text-[#c8d8f0]">

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
                {[["About", "/about"], ["Gallery", "/gallery"], ["Services", "/services"], ["Contact", "/contact"]].map(([label, href], idx) => (
                  <li key={label}>
                    <Link
                      className="inline-flex items-center gap-2 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                      to={href}
                    >
                      {idx === 0 && <Info size={14} className="shrink-0 text-[#f28c28]" />}
                      {idx === 1 && <Image size={14} className="shrink-0 text-[#f28c28]" />}
                      {idx === 2 && <Wrench size={14} className="shrink-0 text-[#f28c28]" />}
                      {idx === 3 && <Mail size={14} className="shrink-0 text-[#f28c28]" />}
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
                {[
                  { name: "Electrical", Icon: Zap },
                  { name: "Plumbing", Icon: Droplet },
                  { name: "CCTV & Security", Icon: Camera },
                  { name: "Electric Fence", Icon: Wrench },
                  { name: "Construction", Icon: Building2 },
                ].map(({ name, Icon }) => (
                  <li key={name}>
                    <Link
                      className="inline-flex items-center gap-2 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                      to="/services"
                    >
                      <Icon size={14} className="shrink-0 text-[#f28c28]" />
                      {name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: Contact + social icons */}
            <div className="col-span-2 lg:col-span-1">
              <h4 className="mb-5 text-sm font-bold uppercase tracking-widest text-[#f28c28]">Contact</h4>
              <div className="flex justify-between gap-8 lg:flex-col">
                {/* Contact info - left */}
                <ul className="flex flex-col gap-3 flex-1">
                  {settings.phone_main && (
                    <li>
                      <a
                        className="flex items-center gap-2.5 text-sm text-[#adc7f9] no-underline transition hover:text-white"
                        href={`tel:${settings.phone_main}`}
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0 text-[#f28c28]" strokeWidth={2.5} />
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
                        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
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
                        <Mail className="h-3.5 w-3.5 shrink-0 text-[#f28c28]" />
                        {settings.email_main}
                      </a>
                    </li>
                  )}
                  {settings.location && (
                    <li className="flex items-start gap-2.5 text-sm text-[#adc7f9]">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f28c28]" />
                      {settings.location}
                    </li>
                  )}
                  {settings.hours && (
                    <li className="flex items-center gap-2.5 text-sm text-[#adc7f9]">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[#f28c28]" />
                      {settings.hours}
                    </li>
                  )}
                </ul>

                {/* Social icons - right */}
                <div className="flex flex-col items-start gap-3 lg:mt-6 lg:flex-row lg:items-center">
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
        </div>

        {/* Bottom bar */}
        <div className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-[#7992c1] sm:flex-row sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} DREGGAM Engineering. Precision in every detail.</p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
              <a className="no-underline transition hover:text-[#f28c28]" href="#">Privacy Policy</a>
              <a className="no-underline transition hover:text-[#f28c28]" href="#">Terms of Service</a>
              <Link
                aria-label="Admin panel login"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-[#adc7f9] no-underline transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                to="/login"
              >
                <LogIn className="h-3.5 w-3.5" />
                Admin Login
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
