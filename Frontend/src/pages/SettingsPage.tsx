import { Eye, EyeOff, Globe, Image, Loader2, Mail, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { useCompanySettings } from "../company/CompanySettingsContext";
import { AppToast, GuiSelect, SectionTitle, SurfaceCard } from "../components/ui";
import {
  expenseCategories as fallbackExpenseCategories,
  materialUnits as fallbackMaterialUnits,
  paymentMethods as fallbackPaymentMethods,
} from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { api, ApiError, type CreateGalleryItemPayload, type GalleryItemRecord, type QuoteRequestApiRecord, type SmtpStatusResponse, type WebsiteSettings } from "../services/api";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SettingsSection = "my-profile" | "system-settings" | "change-password" | "website-management";
type ToastTone = "success" | "error" | "info";

const sectionOptions: Array<{
  id: SettingsSection;
  label: string;
}> = [
  {
    id: "my-profile",
    label: "My Profile",
  },
  {
    id: "system-settings",
    label: "System Settings",
  },
  {
    id: "change-password",
    label: "Change Password",
  },
  {
    id: "website-management",
    label: "Website Management",
  },
];

/* ── Website Management Component ── */
const EMPTY_SITE_SETTINGS: WebsiteSettings = {
  phone_main: "", phone_whatsapp: "", email_main: "",
  location: "", hours: "",
  social_facebook: "", social_instagram: "", social_linkedin: "", social_twitter: "",
};

/* ── Gallery Image Uploader ── */
const GalleryImageUploader = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const result = await api.uploadGalleryImage(file);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload imeshindwa.");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      {/* Preview */}
      {value && (
        <div className="relative h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <img alt="preview" className="h-full w-full object-cover" src={
            value.startsWith("/uploads")
              ? `${import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ?? "http://localhost:5050"}${value}`
              : value
          } />
          <button
            className="absolute right-2 top-2 rounded-lg bg-red-500 p-1 text-white hover:bg-red-600"
            onClick={() => onChange("")}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Upload buttons */}
      {!value && (
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition cursor-pointer ${
            uploading ? "border-[#f28c28] bg-orange-50" : "border-slate-300 bg-slate-50 hover:border-slate-400"
          }`}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-[#f28c28]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading...
            </div>
          ) : (
            <>
              <Image className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">Click here to select an image</p>
              <p className="text-[10px] text-slate-400">JPEG, PNG, WebP — max 10 MB</p>
            </>
          )}
        </div>
      )}

      {/* Single hidden input — browser/OS shows native picker with all options */}
      <input
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
        ref={fileRef}
        type="file"
      />

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
};

const WebsiteManagementSection = ({
  quoteRequests,
  quoteLoading,
  selectedQuote,
  onSelectQuote,
  onStatusChange,
  onDelete,
  onLoadQuotes,
}: {
  quoteRequests: QuoteRequestApiRecord[];
  quoteLoading: boolean;
  selectedQuote: QuoteRequestApiRecord | null;
  onSelectQuote: (q: QuoteRequestApiRecord | null) => void;
  onStatusChange: (id: string, status: "New" | "Read" | "Replied") => void;
  onDelete: (id: string) => void;
  onLoadQuotes: () => void;
}) => {
  const [tab, setTab] = useState<"pages" | "quotes" | "site-settings" | "gallery">("pages");
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Site settings state
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings>(EMPTY_SITE_SETTINGS);
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);
  const [siteSettingsSaved, setSiteSettingsSaved] = useState(false);
  const siteSettingsFetched = useRef(false);

  // Gallery state
  const [galleryItems, setGalleryItems] = useState<GalleryItemRecord[]>([]);
  const [galleryCategories, setGalleryCategories] = useState<string[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const galleryFetched = useRef(false);
  const [galleryForm, setGalleryForm] = useState<CreateGalleryItemPayload>({
    title: "", subtitle: "", category: "", imageUrl: "", sortOrder: 0, isVisible: true,
  });
  const [galleryFormSaving, setGalleryFormSaving] = useState(false);
  const [galleryFormError, setGalleryFormError] = useState("");

  // Load quotes when tab opens
  useEffect(() => {
    if (tab === "quotes" && quoteRequests.length === 0 && !quoteLoading) {
      onLoadQuotes();
    }
  }, [tab, quoteRequests.length, quoteLoading, onLoadQuotes]);

  // Load site settings once when tab opens
  useEffect(() => {
    if (tab === "site-settings" && !siteSettingsFetched.current) {
      siteSettingsFetched.current = true;
      setSiteSettingsLoading(true);
      api.getWebsiteSettings()
        .then((data) => setSiteSettings({ ...EMPTY_SITE_SETTINGS, ...data }))
        .catch(() => {/* silently use defaults */})
        .finally(() => setSiteSettingsLoading(false));
    }
  }, [tab]);

  // Load gallery once when tab opens
  useEffect(() => {
    if (tab === "gallery" && !galleryFetched.current) {
      galleryFetched.current = true;
      setGalleryLoading(true);
      api.getGallery()
        .then((data) => {
          setGalleryItems(data.items);
          setGalleryCategories(data.categories.filter((c) => c !== "All"));
        })
        .catch(() => {})
        .finally(() => setGalleryLoading(false));
    }
  }, [tab]);

  const handleGalleryAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalleryFormError("");
    if (!galleryForm.title.trim()) { setGalleryFormError("Title is required."); return; }
    if (!galleryForm.imageUrl.trim()) { setGalleryFormError("Image is required."); return; }
    setGalleryFormSaving(true);
    try {
      const created = await api.createGalleryItem(galleryForm);
      setGalleryItems((prev) => [created, ...prev]);
      setGalleryForm({ title: "", subtitle: "", category: "", imageUrl: "", sortOrder: 0, isVisible: true });
    } catch (err) {
      setGalleryFormError(err instanceof ApiError ? err.message : "Failed to add item.");
    } finally {
      setGalleryFormSaving(false);
    }
  };

  const handleGalleryDelete = async (id: string) => {
    try {
      await api.deleteGalleryItem(id);
      setGalleryItems((prev) => prev.filter((g) => g.id !== id));
    } catch { /* ignore */ }
  };

  const handleGalleryToggleVisible = async (item: GalleryItemRecord) => {
    try {
      const updated = await api.updateGalleryItem(item.id, { isVisible: !item.isVisible });
      setGalleryItems((prev) => prev.map((g) => g.id === item.id ? updated : g));
    } catch { /* ignore */ }
  };

  const handleSiteSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiteSettingsSaving(true);
    try {
      const updated = await api.saveWebsiteSettings(siteSettings);
      setSiteSettings({ ...EMPTY_SITE_SETTINGS, ...updated });
      setSiteSettingsSaved(true);
      setTimeout(() => setSiteSettingsSaved(false), 2500);
    } catch {
      // ignore
    } finally {
      setSiteSettingsSaving(false);
    }
  };

  const handleCopyPhone = (phone: string) => {
    void navigator.clipboard.writeText(phone).then(() => {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    });
  };

  const newCount = quoteRequests.filter((q) => q.status === "New").length;

  return (
    <SurfaceCard title="Website Management">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "pages"
                ? "border-b-2 border-[#f28c28] text-[#f28c28]"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("pages")}
            type="button"
          >
            <Globe className="h-4 w-4" />
            Website Pages
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "quotes"
                ? "border-b-2 border-[#f28c28] text-[#f28c28]"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("quotes")}
            type="button"
          >
            <MessageSquare className="h-4 w-4" />
            Quote Requests
            {newCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f28c28] px-1 text-[10px] font-bold text-white">
                {newCount}
              </span>
            )}
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "site-settings"
                ? "border-b-2 border-[#f28c28] text-[#f28c28]"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("site-settings")}
            type="button"
          >
            <Save className="h-4 w-4" />
            Site Settings
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "gallery"
                ? "border-b-2 border-[#f28c28] text-[#f28c28]"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("gallery")}
            type="button"
          >
            <Image className="h-4 w-4" />
            Gallery
          </button>
        </div>

        {/* Pages Tab */}
        {tab === "pages" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Manage your public-facing website content and pages.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: "View Live Website", href: "/" },
                { label: "Contact Page", href: "/contact" },
                { label: "Services Page", href: "/services" },
                { label: "Gallery Page", href: "/gallery" },
                { label: "About Page", href: "/about" },
              ].map((link) => (
                <a
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-[#0b2a53] no-underline transition hover:border-[#f28c28] hover:bg-orange-50 hover:text-[#f28c28]"
                  href={link.href}
                  key={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Quote Requests Tab */}
        {tab === "quotes" && (
          <div>
            {quoteLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : quoteRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <Mail className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No quote requests yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Requests from your contact form will appear here
                </p>
              </div>
            ) : (
              /* On large screens: side-by-side. On small screens: detail card on top, list below */
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

                {/* ── Detail card — top on mobile, right on desktop ── */}
                <div className="order-1 lg:order-2 lg:w-80 lg:shrink-0">
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    {selectedQuote ? (
                      <div>
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{selectedQuote.fullName}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(selectedQuote.createdAt).toLocaleDateString("en-GB", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <button
                            className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 transition hover:bg-red-100"
                            onClick={() => onDelete(selectedQuote.id)}
                            title="Delete request"
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Body */}
                        <div className="space-y-3 px-4 py-3">
                          {/* Email */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</p>
                            <p className="mt-0.5 text-sm text-slate-800 break-all">{selectedQuote.email}</p>
                          </div>

                          {/* Phone with copy */}
                          {selectedQuote.phone && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-800">{selectedQuote.phone}</p>
                                <button
                                  className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
                                    copiedPhone
                                      ? "border-green-200 bg-green-50 text-green-700"
                                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-[#f28c28] hover:text-[#f28c28]"
                                  }`}
                                  onClick={() => handleCopyPhone(selectedQuote.phone)}
                                  title="Copy phone number"
                                  type="button"
                                >
                                  {copiedPhone ? "✓ Copied" : "Copy"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Service */}
                          {selectedQuote.service && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service</p>
                              <p className="mt-0.5 text-sm text-slate-800">{selectedQuote.service}</p>
                            </div>
                          )}

                          {/* Message */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Message</p>
                            <p className="mt-0.5 text-sm leading-relaxed text-slate-800">{selectedQuote.message}</p>
                          </div>

                          {/* Status buttons */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                            <div className="mt-1.5 flex gap-1.5">
                              {(["New", "Read", "Replied"] as const).map((status) => (
                                <button
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    selectedQuote.status === status
                                      ? "border-[#f28c28] bg-[#f28c28] text-white"
                                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                                  }`}
                                  key={status}
                                  onClick={() => onStatusChange(selectedQuote.id, status)}
                                  type="button"
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <MessageSquare className="mb-2 h-8 w-8 text-slate-200" />
                        <p className="text-sm text-slate-400">Select a request to view details</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── List — bottom on mobile, left on desktop ── */}
                <div className="order-2 min-w-0 flex-1 lg:order-1">
                  <div className="space-y-2">
                    {quoteRequests.map((q) => (
                      <button
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selectedQuote?.id === q.id
                            ? "border-[#f28c28] bg-orange-50 shadow-sm"
                            : q.status === "New"
                              ? "border-blue-200 bg-blue-50/40 hover:border-blue-300"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        key={q.id}
                        onClick={() => onSelectQuote(q)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{q.fullName}</p>
                            <p className="truncate text-xs text-slate-500">{q.email}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              q.status === "New"
                                ? "bg-blue-100 text-blue-700"
                                : q.status === "Read"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {q.status}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{q.message}</p>
                        <p className="mt-1.5 text-[10px] text-slate-400">
                          {new Date(q.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Site Settings Tab */}
        {tab === "site-settings" && (
          <div>
            {siteSettingsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <form className="space-y-6" onSubmit={(e) => void handleSiteSettingsSave(e)}>
                {/* Contact Info */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Contact Information</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="form-field">
                      <span>Phone (Main)</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, phone_main: e.target.value }))}
                        placeholder="+255 754 000 100"
                        type="tel"
                        value={siteSettings.phone_main}
                      />
                    </label>
                    <label className="form-field">
                      <span>WhatsApp Number</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, phone_whatsapp: e.target.value }))}
                        placeholder="+255 754 000 100"
                        type="tel"
                        value={siteSettings.phone_whatsapp}
                      />
                    </label>
                    <label className="form-field">
                      <span>Email</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, email_main: e.target.value }))}
                        placeholder="info@company.co.tz"
                        type="email"
                        value={siteSettings.email_main}
                      />
                    </label>
                    <label className="form-field">
                      <span>Location</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, location: e.target.value }))}
                        placeholder="Dar es Salaam, Tanzania"
                        value={siteSettings.location}
                      />
                    </label>
                    <label className="form-field sm:col-span-2">
                      <span>Business Hours</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, hours: e.target.value }))}
                        placeholder="Mon–Sat: 8:00 AM – 6:00 PM"
                        value={siteSettings.hours}
                      />
                    </label>
                  </div>
                </div>

                {/* Social Media */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Social Media Links</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="form-field">
                      <span>Facebook URL</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, social_facebook: e.target.value }))}
                        placeholder="https://facebook.com/yourpage"
                        type="url"
                        value={siteSettings.social_facebook}
                      />
                    </label>
                    <label className="form-field">
                      <span>Instagram URL</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, social_instagram: e.target.value }))}
                        placeholder="https://instagram.com/yourpage"
                        type="url"
                        value={siteSettings.social_instagram}
                      />
                    </label>
                    <label className="form-field">
                      <span>LinkedIn URL</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, social_linkedin: e.target.value }))}
                        placeholder="https://linkedin.com/company/yourpage"
                        type="url"
                        value={siteSettings.social_linkedin}
                      />
                    </label>
                    <label className="form-field">
                      <span>Twitter / X URL</span>
                      <input
                        className="input-field"
                        onChange={(e) => setSiteSettings((p) => ({ ...p, social_twitter: e.target.value }))}
                        placeholder="https://twitter.com/yourpage"
                        type="url"
                        value={siteSettings.social_twitter}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    className="btn-primary flex items-center gap-2"
                    disabled={siteSettingsSaving}
                    type="submit"
                  >
                    {siteSettingsSaving
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Save className="h-4 w-4" />
                    }
                    Save Settings
                  </button>
                  {siteSettingsSaved && (
                    <span className="text-sm font-semibold text-green-600">✓ Saved successfully</span>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* Gallery Tab */}
        {tab === "gallery" && (
          <div className="space-y-5">
            {/* Add form */}
            <form className="rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={(e) => void handleGalleryAdd(e)}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Add New Image</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="form-field">
                  <span>Title *</span>
                  <input
                    className="input-field"
                    onChange={(e) => setGalleryForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Horizon Villa"
                    value={galleryForm.title}
                  />
                </label>
                <label className="form-field">
                  <span>Subtitle</span>
                  <input
                    className="input-field"
                    onChange={(e) => setGalleryForm((p) => ({ ...p, subtitle: e.target.value }))}
                    placeholder="e.g. Full Smart Home Build"
                    value={galleryForm.subtitle}
                  />
                </label>
                <label className="form-field">
                  <span>Category</span>
                  <input
                    className="input-field"
                    list="gallery-categories"
                    onChange={(e) => setGalleryForm((p) => ({ ...p, category: e.target.value }))}
                    placeholder="e.g. Residential"
                    value={galleryForm.category}
                  />
                  <datalist id="gallery-categories">
                    {galleryCategories.map((c) => <option key={c} value={c} />)}
                    {["Residential", "Commercial", "Infrastructure", "Plumbing", "Security", "Electrical"].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="form-field">
                  <span>Sort Order</span>
                  <input
                    className="input-field"
                    min={0}
                    onChange={(e) => setGalleryForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
                    type="number"
                    value={galleryForm.sortOrder}
                  />
                </label>
                <label className="form-field sm:col-span-2">
                  <span>Picha *</span>
                  <GalleryImageUploader
                    value={galleryForm.imageUrl}
                    onChange={(url) => setGalleryForm((p) => ({ ...p, imageUrl: url }))}
                  />
                </label>
              </div>
              {galleryFormError && (
                <p className="mt-2 text-xs font-medium text-red-600">{galleryFormError}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button className="btn-primary flex items-center gap-2" disabled={galleryFormSaving} type="submit">
                  {galleryFormSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </button>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    checked={galleryForm.isVisible}
                    onChange={(e) => setGalleryForm((p) => ({ ...p, isVisible: e.target.checked }))}
                    type="checkbox"
                  />
                  Ionyeshe kwenye website
                </label>
              </div>
            </form>

            {/* Items list */}
            {galleryLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Image className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Hakuna picha bado</p>
                <p className="mt-1 text-xs text-slate-400">Ongeza picha ya kwanza hapo juu</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">{galleryItems.length} picha</p>
                {galleryItems.map((item) => (
                  <div
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                      item.isVisible ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
                    }`}
                    key={item.id}
                  >
                    {/* Thumbnail */}
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <img
                        alt={item.title}
                        className="h-full w-full object-cover"
                        src={item.imageUrl}
                      />
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                      <span className="mt-0.5 inline-block rounded-full bg-[#f28c28]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f28c28]">
                        {item.category || "General"}
                      </span>
                    </div>
                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          item.isVisible
                            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                        onClick={() => void handleGalleryToggleVisible(item)}
                        title={item.isVisible ? "Ficha" : "Onyesha"}
                        type="button"
                      >
                        {item.isVisible ? "Visible" : "Hidden"}
                      </button>
                      <button
                        className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 transition hover:bg-red-100"
                        onClick={() => void handleGalleryDelete(item.id)}
                        title="Futa"
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
};

export const SettingsPage = () => {
  const { user, updateCurrentUser } = useAuth();
  const { markSaved } = useUnsavedChanges();
  const {
    company,
    expenseCategories,
    materialUnits,
    paymentMethods,
    loading: companySettingsLoading,
    errorMessage: companySettingsErrorMessage,
    saveCompanyProfile,
  } = useCompanySettings();

  const [activeSection, setActiveSection] = useState<SettingsSection>("my-profile");
  const [myFullName, setMyFullName] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myAccountSaving, setMyAccountSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyCurrency, setCompanyCurrency] = useState("TZS");
  const [companySaving, setCompanySaving] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusResponse | null>(null);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);

  // Quote requests state
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequestApiRecord[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequestApiRecord | null>(null);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastTone, setToastTone] = useState<ToastTone>("success");
  const [toastTitle, setToastTitle] = useState("Done");
  const [toastMessage, setToastMessage] = useState("");
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (tone: ToastTone, title: string, message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastTone(tone);
    setToastTitle(title);
    setToastMessage(message);
    setToastOpen(true);
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false);
    }, 2600);
  };

  const resolvedExpenseCategories =
    expenseCategories.length > 0 ? expenseCategories : fallbackExpenseCategories;
  const resolvedMaterialUnits =
    materialUnits.length > 0 ? materialUnits : fallbackMaterialUnits;
  const resolvedPaymentMethods =
    paymentMethods.length > 0 ? paymentMethods : fallbackPaymentMethods;

  useEffect(() => {
    let mounted = true;

    const loadSmtpStatus = async () => {
      setSmtpLoading(true);

      try {
        const response = await api.getSmtpStatus();
        if (mounted) {
          setSmtpStatus(response);
        }
      } catch (error) {
        if (mounted) {
          if (error instanceof ApiError) {
            showToast("error", "SMTP", error.message);
          } else {
            showToast("error", "SMTP", "Unable to load SMTP settings.");
          }
        }
      } finally {
        if (mounted) {
          setSmtpLoading(false);
        }
      }
    };

    void loadSmtpStatus();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (companySettingsErrorMessage) {
      showToast("error", "Settings", companySettingsErrorMessage);
    }
  }, [companySettingsErrorMessage]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user?.email && smtpTestEmail.trim().length === 0) {
      setSmtpTestEmail(user.email);
    }
  }, [smtpTestEmail, user?.email]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setMyFullName(user.fullName);
    setMyEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (!company) {
      return;
    }
    setCompanyName(company.name);
    setCompanyEmail(company.email);
    setCompanyPhone(company.phone);
    setCompanyLocation(company.location);
    setCompanyCurrency(company.currency);
  }, [company]);

  const handleSimpleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    markSaved();
    showToast("success", "Saved", "Changes saved.");
  };

  const handleMyAccountSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      fullName: myFullName.trim(),
      email: myEmail.trim().toLowerCase(),
    };

    if (payload.fullName.length < 2) {
      showToast("error", "My Account", "Full name must have at least 2 characters.");
      return;
    }

    if (!emailPattern.test(payload.email)) {
      showToast("error", "My Account", "Enter a valid email address.");
      return;
    }

    setMyAccountSaving(true);
    try {
      const response = await api.updateMyProfile(payload);
      updateCurrentUser(response.user);
      setMyFullName(response.user.fullName);
      setMyEmail(response.user.email);
      markSaved();
      showToast("success", "My Account", "Profile updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "My Account", error.message);
      } else {
        showToast("error", "My Account", "Failed to update profile.");
      }
    } finally {
      setMyAccountSaving(false);
    }
  };

  const handleCompanyProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: companyName.trim(),
      email: companyEmail.trim().toLowerCase(),
      phone: companyPhone.trim(),
      location: companyLocation.trim(),
      currency: companyCurrency.trim().toUpperCase(),
    };

    if (payload.name.length < 2) {
      showToast("error", "Company", "Company name must have at least 2 characters.");
      return;
    }
    if (!emailPattern.test(payload.email)) {
      showToast("error", "Company", "Enter a valid company email.");
      return;
    }
    if (payload.phone.length < 7) {
      showToast("error", "Company", "Phone number must have at least 7 characters.");
      return;
    }
    if (payload.location.length < 2) {
      showToast("error", "Company", "Location must have at least 2 characters.");
      return;
    }
    if (payload.currency.length !== 3) {
      showToast("error", "Company", "Currency must be a 3-letter code.");
      return;
    }

    setCompanySaving(true);
    try {
      const updated = await saveCompanyProfile(payload);
      setCompanyName(updated.name);
      setCompanyEmail(updated.email);
      setCompanyPhone(updated.phone);
      setCompanyLocation(updated.location);
      setCompanyCurrency(updated.currency);
      markSaved();
      showToast("success", "Company", "Profile updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "Company", error.message);
      } else {
        showToast("error", "Company", "Failed to save profile.");
      }
    } finally {
      setCompanySaving(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      showToast("error", "Password", "New password must have at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("error", "Password", "New password and confirm password do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await api.changePassword({
        oldPassword,
        newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      markSaved();
      showToast("success", "Password", "Password updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "Password", error.message);
      } else {
        showToast("error", "Password", "Failed to update password.");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSmtpTest = async (event: FormEvent<HTMLFormElement>) => {    event.preventDefault();

    const recipient = smtpTestEmail.trim().toLowerCase();
    if (!emailPattern.test(recipient)) {
      showToast("error", "SMTP", "Enter a valid recipient email.");
      return;
    }

    setSmtpTesting(true);
    try {
      const response = await api.sendSmtpTestEmail({ to: recipient });
      markSaved();
      showToast("success", "SMTP", response.message);
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "SMTP", error.message);
      } else {
        showToast("error", "SMTP", "Failed to send SMTP test email.");
      }
    } finally {
      setSmtpTesting(false);
    }
  };

  const loadQuoteRequests = async () => {
    setQuoteLoading(true);
    try {
      const rows = await api.getQuoteRequests();
      setQuoteRequests(rows);
    } catch {
      showToast("error", "Quote Requests", "Failed to load quote requests.");
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleQuoteStatusChange = async (id: string, status: "New" | "Read" | "Replied") => {
    try {
      await api.updateQuoteRequestStatus(id, status);
      setQuoteRequests((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status } : q)),
      );
      if (selectedQuote?.id === id) {
        setSelectedQuote((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch {
      showToast("error", "Quote Requests", "Failed to update status.");
    }
  };

  const handleQuoteDelete = async (id: string) => {
    try {
      await api.deleteQuoteRequest(id);
      setQuoteRequests((prev) => prev.filter((q) => q.id !== id));
      if (selectedQuote?.id === id) setSelectedQuote(null);
      showToast("success", "Quote Requests", "Request deleted.");
    } catch {
      showToast("error", "Quote Requests", "Failed to delete request.");
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_1fr]">
        <SurfaceCard className="hidden h-fit lg:block" title="Menu">
          <div className="space-y-2">
            {sectionOptions.map((option) => {
              const isActive = option.id === activeSection;
              return (
                <button
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-transparent text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  key={option.id}
                  onClick={() => setActiveSection(option.id)}
                  style={
                    isActive
                      ? {
                          backgroundColor: "var(--primary)",
                        }
                      : undefined
                  }
                  type="button"
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        <div className="space-y-4">
          <SurfaceCard className="lg:hidden" title="Menu">
            <label className="form-field">
              <span>Section</span>
              <GuiSelect
                className="input-field"
                onChange={(event) =>
                  setActiveSection(event.target.value as SettingsSection)
                }
                value={activeSection}
              >
                {sectionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </GuiSelect>
            </label>
          </SurfaceCard>

          {activeSection === "my-profile" && (
            <>
              <SurfaceCard title="My Account">
                <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleMyAccountSave}>
                  <label className="form-field">
                    <span>Full Name</span>
                    <input
                      className="input-field"
                      disabled={myAccountSaving}
                      onChange={(event) => setMyFullName(event.target.value)}
                      required
                      value={myFullName}
                    />
                  </label>
                  <label className="form-field">
                    <span>Email</span>
                    <input
                      className="input-field"
                      disabled={myAccountSaving}
                      onChange={(event) => setMyEmail(event.target.value)}
                      required
                      type="email"
                      value={myEmail}
                    />
                  </label>
                  <label className="form-field">
                    <span>Role</span>
                    <input
                      className="input-field bg-slate-50"
                      readOnly
                      value={user?.role ?? ""}
                    />
                  </label>
                  <label className="form-field">
                    <span>Status</span>
                    <input
                      className="input-field bg-slate-50"
                      readOnly
                      value={user?.status ?? ""}
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <button className="btn-primary" disabled={myAccountSaving} type="submit">
                      {myAccountSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save
                    </button>
                  </div>
                </form>
              </SurfaceCard>

              <SurfaceCard title="Company Profile">
                <form
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  onSubmit={handleCompanyProfileSave}
                >
                  {companySettingsLoading && !company && (
                    <div className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  )}
                  <label className="form-field">
                    <span>Company Name</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyName(event.target.value)}
                      required
                      value={companyName}
                    />
                  </label>
                  <label className="form-field">
                    <span>Email</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyEmail(event.target.value)}
                      required
                      type="email"
                      value={companyEmail}
                    />
                  </label>
                  <label className="form-field">
                    <span>Phone</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyPhone(event.target.value)}
                      required
                      value={companyPhone}
                    />
                  </label>
                  <label className="form-field">
                    <span>Location</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyLocation(event.target.value)}
                      required
                      value={companyLocation}
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      className="btn-primary"
                      disabled={companySettingsLoading || companySaving}
                      type="submit"
                    >
                      {companySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save
                    </button>
                  </div>
                </form>
              </SurfaceCard>
            </>
          )}

          {activeSection === "system-settings" && (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="Currency Settings">
                  <form
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    onSubmit={handleCompanyProfileSave}
                  >
                    <label className="form-field">
                      <span>Default Currency</span>
                      <GuiSelect
                        className="input-field"
                        disabled={companySettingsLoading || companySaving}
                        onChange={(event) => setCompanyCurrency(event.target.value)}
                        value={companyCurrency}
                      >
                        <option value="TZS">TZS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="KES">KES</option>
                        <option value="UGX">UGX</option>
                      </GuiSelect>
                    </label>
                    <label className="form-field">
                      <span>Number Format</span>
                      <GuiSelect className="input-field" disabled>
                        <option>{`${companyCurrency || "TZS"} 1,000,000`}</option>
                        <option>{`${companyCurrency || "TZS"} 1 000 000`}</option>
                      </GuiSelect>
                    </label>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        className="btn-primary"
                        disabled={companySettingsLoading || companySaving}
                        type="submit"
                      >
                        {companySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save
                      </button>
                    </div>
                  </form>
                </SurfaceCard>

                <SurfaceCard title="Notification Settings">
                  <form className="space-y-3 text-sm text-slate-700" onSubmit={handleSimpleSave}>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Overspending alerts</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Pending client payments</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Outstanding labor payments</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Project deadline reminders</span>
                      <input type="checkbox" />
                    </label>
                    <button className="btn-primary" type="submit">
                      Save
                    </button>
                  </form>
                </SurfaceCard>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="Expense Categories">
                  <div className="space-y-2">
                    {resolvedExpenseCategories.map((category) => (
                      <label className="form-field" key={`set-exp-${category}`}>
                        <span>{category}</span>
                        <input className="input-field" defaultValue={category} />
                      </label>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard title="Material Units">
                  <div className="space-y-2">
                    {resolvedMaterialUnits.map((unit) => (
                      <label className="form-field" key={`set-unit-${unit}`}>
                        <span>{unit}</span>
                        <input className="input-field" defaultValue={unit} />
                      </label>
                    ))}
                  </div>
                </SurfaceCard>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="Payment Methods">
                  <div className="space-y-2">
                    {resolvedPaymentMethods.map((method) => (
                      <label className="form-field" key={`set-pay-${method}`}>
                        <span>{method}</span>
                        <input className="input-field" defaultValue={method} />
                      </label>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard title="Security Settings">
                  <form className="space-y-3 text-sm text-slate-700" onSubmit={handleSimpleSave}>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Two-factor authentication</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Enforce strong password policy</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Session timeout (30 mins)</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <button className="btn-primary" type="submit">
                      Save
                    </button>
                  </form>
                </SurfaceCard>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="SMTP Email">
                  <div className="space-y-3 text-sm text-slate-700">
                    {smtpLoading ? (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                          <span>Status</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              smtpStatus?.configured
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {smtpStatus?.configured ? "Configured" : "Not configured"}
                          </span>
                        </div>
                        <label className="form-field">
                          <span>SMTP Host</span>
                          <input className="input-field bg-slate-50" readOnly value={smtpStatus?.host ?? ""} />
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="form-field">
                            <span>Port</span>
                            <input
                              className="input-field bg-slate-50"
                              readOnly
                              value={smtpStatus ? String(smtpStatus.port) : ""}
                            />
                          </label>
                          <label className="form-field">
                            <span>Secure</span>
                            <input
                              className="input-field bg-slate-50"
                              readOnly
                              value={smtpStatus?.secure ? "Yes" : "No"}
                            />
                          </label>
                        </div>
                        <label className="form-field">
                          <span>From Email</span>
                          <input className="input-field bg-slate-50" readOnly value={smtpStatus?.fromEmail ?? ""} />
                        </label>
                      </>
                    )}

                    <form className="space-y-3 border-t border-slate-200 pt-3" onSubmit={handleSmtpTest}>
                      <label className="form-field">
                        <span>Test Recipient Email</span>
                        <input
                          className="input-field"
                          onChange={(event) => setSmtpTestEmail(event.target.value)}
                          placeholder="admin@company.com"
                          type="email"
                          value={smtpTestEmail}
                        />
                      </label>
                      <button
                        className="btn-primary w-full justify-center"
                        disabled={smtpTesting || smtpLoading}
                        type="submit"
                      >
                        {smtpTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Send Test
                      </button>
                    </form>
                  </div>
                </SurfaceCard>

                <SurfaceCard title="Backup Settings">
                  <form className="space-y-3 text-sm text-slate-700" onSubmit={handleSimpleSave}>
                    <p>Auto backup: Daily 23:00</p>
                    <p>Last: 23 Apr 2026 23:01</p>
                    <div className="flex gap-2">
                      <button className="btn-secondary" type="button">
                        Run Backup Now
                      </button>
                      <button className="btn-primary" type="submit">
                        Save
                      </button>
                    </div>
                  </form>
                </SurfaceCard>
              </div>
            </>
          )}

          {activeSection === "change-password" && (
            <SurfaceCard title="Change Password">
              <form className="space-y-3" onSubmit={handlePasswordChange}>
                <label className="form-field">
                  <span>Current Password</span>
                  <div className="relative">
                    <input
                      className="input-field pr-10"
                      onChange={(event) => setOldPassword(event.target.value)}
                      required
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                    />
                    {oldPassword.length > 0 && (
                      <button
                        aria-label={showOldPassword ? "Hide current password" : "Show current password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                        onClick={() => setShowOldPassword((current) => !current)}
                        type="button"
                      >
                        {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </label>
                <label className="form-field">
                  <span>New Password</span>
                  <div className="relative">
                    <input
                      className="input-field pr-10"
                      minLength={8}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                    />
                    {newPassword.length > 0 && (
                      <button
                        aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                        onClick={() => setShowNewPassword((current) => !current)}
                        type="button"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </label>
                <label className="form-field">
                  <span>Confirm New Password</span>
                  <div className="relative">
                    <input
                      className="input-field pr-10"
                      minLength={8}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                    />
                    {confirmPassword.length > 0 && (
                      <button
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        type="button"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </label>
                <button className="btn-primary w-full justify-center" disabled={passwordSaving} type="submit">
                  {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Update Password
                </button>
              </form>
            </SurfaceCard>
          )}
          {activeSection === "website-management" && (
            <WebsiteManagementSection
              quoteRequests={quoteRequests}
              quoteLoading={quoteLoading}
              selectedQuote={selectedQuote}
              onSelectQuote={(q) => {
                setSelectedQuote(q);
                if (q && q.status === "New") {
                  void handleQuoteStatusChange(q.id, "Read");
                }
              }}
              onStatusChange={handleQuoteStatusChange}
              onDelete={handleQuoteDelete}
              onLoadQuotes={() => void loadQuoteRequests()}
            />
          )}
        </div>
      </div>

      <AppToast
        message={toastMessage}
        onClose={() => setToastOpen(false)}
        open={toastOpen}
        title={toastTitle}
        tone={toastTone}
      />
    </div>
  );
};
