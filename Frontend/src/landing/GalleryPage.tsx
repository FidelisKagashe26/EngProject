import { Download, LayoutGrid, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type GalleryItemRecord } from "../services/api";
import { resolveUploadUrl } from "../utils/uploads";

const WATERMARK_TEXT = "DREGGAM";
const DEFAULT_DOWNLOAD_LOGO_SRC = "/EngLogo.png";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });

const getMimeTypeFromSource = (src: string): "image/jpeg" | "image/png" | "image/webp" => {
  const clean = src.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

const safeSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "dreggam-image";

export const GalleryPage = () => {
  const [items, setItems] = useState<GalleryItemRecord[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [downloadError, setDownloadError] = useState("");
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .getPublicGallery()
      .then((data) => {
        if (!mounted) return;
        setItems(data.items);
        setCategories(data.categories.length > 0 ? data.categories : ["All"]);
      })
      .catch(() => {
        // silently show empty state
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownload = async (item: GalleryItemRecord) => {
    setDownloadingItemId(item.id);
    setDownloadError("");

    try {
      const imageSrc = resolveUploadUrl(item.imageUrl);
      const logoSrc = DEFAULT_DOWNLOAD_LOGO_SRC;
      const [baseImage, overlayLogo] = await Promise.all([loadImage(imageSrc), loadImage(logoSrc)]);

      const width = baseImage.naturalWidth || baseImage.width;
      const height = baseImage.naturalHeight || baseImage.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context is not available.");
      }

      context.drawImage(baseImage, 0, 0, width, height);

      const padding = Math.max(12, Math.round(Math.min(width, height) * 0.025));
      const maxLogoWidth = Math.min(Math.max(Math.round(width * 0.22), 110), 320);
      const maxLogoHeight = Math.min(Math.max(Math.round(height * 0.16), 64), 180);
      const logoScale = Math.min(
        maxLogoWidth / overlayLogo.width,
        maxLogoHeight / overlayLogo.height,
        1,
      );
      const logoWidth = Math.max(56, Math.round(overlayLogo.width * logoScale));
      const logoHeight = Math.max(28, Math.round(overlayLogo.height * logoScale));

      context.globalAlpha = 0.96;
      context.drawImage(
        overlayLogo,
        width - logoWidth - padding,
        padding,
        logoWidth,
        logoHeight,
      );
      context.globalAlpha = 1;

      const watermarkSize = Math.max(20, Math.round(width * 0.036));
      context.font = `700 ${watermarkSize}px Arial`;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.strokeStyle = "rgba(0, 0, 0, 0.3)";
      context.lineWidth = Math.max(2, Math.round(watermarkSize * 0.08));
      context.fillStyle = "rgba(255, 255, 255, 0.4)";
      context.strokeText(WATERMARK_TEXT, width / 2, height - padding);
      context.fillText(WATERMARK_TEXT, width / 2, height - padding);

      const mimeType = getMimeTypeFromSource(imageSrc);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (fileBlob) => {
            if (!fileBlob) {
              reject(new Error("Failed to prepare image for download."));
              return;
            }
            resolve(fileBlob);
          },
          mimeType,
          0.92,
        );
      });

      const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const filename = `${safeSlug(item.title)}-dreggam.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? `Download failed: ${error.message}`
          : "Download failed. Please try again.",
      );
    } finally {
      setDownloadingItemId(null);
    }
  };

  const filtered = filter === "All" ? items : items.filter((item) => item.category === filter);

  const col1 = filtered.filter((_, i) => i % 3 === 0);
  const col2 = filtered.filter((_, i) => i % 3 === 1);
  const col3 = filtered.filter((_, i) => i % 3 === 2);

  return (
    <>
      <section className="relative overflow-hidden bg-[#0b2a53] py-16 lg:py-28">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/photo1.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#001534]/85 via-[#0b2a53]/75 to-[#0b2a53]/85" />
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#f28c28] sm:text-base">
            <LayoutGrid size={14} />
            Our Work
          </span>
          <h1 className="mt-4 font-[Manrope,sans-serif] text-3xl font-black text-white sm:mt-5 sm:text-5xl lg:text-6xl">
            Project Gallery
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#adc7f9] sm:mt-5 sm:text-lg">
            A curated selection of our finest engineering and architectural achievements across Tanzania and East Africa.
          </p>
        </div>
      </section>

      <section className="bg-[#faf9fd] py-12 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {downloadError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 sm:text-sm">
              {downloadError}
            </div>
          )}

          {categories.length > 1 && (
            <div className="mb-8 flex flex-wrap justify-center gap-2 sm:mb-10">
              {categories.map((tag) => (
                <button
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition sm:px-5 sm:py-2 sm:text-sm ${
                    filter === tag
                      ? "border-[#0b2a53] bg-[#0b2a53] text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:border-[#0b2a53] hover:text-[#0b2a53]"
                  }`}
                  key={tag}
                  onClick={() => setFilter(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="py-20 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#f28c28]" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center">
              <LayoutGrid className="mx-auto mb-4 text-slate-300" size={48} />
              <p className="text-base font-semibold text-slate-500">No images available right now</p>
              <p className="mt-1 text-sm text-slate-400">
                {filter !== "All"
                  ? `No images in "${filter}" category`
                  : "Project images will appear here"}
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                {col1.map((item) => (
                  <GalleryCard
                    item={item}
                    key={item.id}
                    onDownload={handleDownload}
                    downloading={downloadingItemId === item.id}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {col2.map((item) => (
                  <GalleryCard
                    item={item}
                    key={item.id}
                    onDownload={handleDownload}
                    downloading={downloadingItemId === item.id}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {col3.map((item) => (
                  <GalleryCard
                    item={item}
                    key={item.id}
                    onDownload={handleDownload}
                    downloading={downloadingItemId === item.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#0b2a53] py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 text-center sm:gap-6 lg:grid-cols-4">
            {[
              { value: "200+", label: "Projects Delivered" },
              { value: "6", label: "Service Categories" },
              { value: "15+", label: "Years Experience" },
              { value: "100%", label: "Client Retention" },
            ].map((stat) => (
              <div key={stat.label}>
                <span className="block font-[Manrope,sans-serif] text-2xl font-black text-[#f28c28] sm:text-4xl">
                  {stat.value}
                </span>
                <span className="mt-1 block text-xs text-[#adc7f9] sm:text-sm">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

const GalleryCard = ({
  item,
  onDownload,
  downloading,
}: {
  item: GalleryItemRecord;
  onDownload: (item: GalleryItemRecord) => Promise<void>;
  downloading: boolean;
}) => {
  const imgSrc = resolveUploadUrl(item.imageUrl);

  return (
    <div className="group relative overflow-hidden rounded-2xl">
      <img
        alt={item.title}
        className="block w-full transition-transform duration-700 group-hover:scale-105"
        loading="lazy"
        src={imgSrc}
      />

      <button
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/40 bg-[#0b2a53]/75 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-[#0b2a53]/90 disabled:cursor-not-allowed disabled:opacity-80"
        disabled={downloading}
        onClick={() => {
          void onDownload(item);
        }}
        type="button"
      >
        {downloading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Downloading
          </>
        ) : (
          <>
            <Download className="h-3 w-3" />
            Download
          </>
        )}
      </button>

      <div className="absolute inset-0 bg-gradient-to-t from-[#001534]/90 via-[#001534]/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5">
        <span className="mb-1.5 inline-block rounded bg-[#f28c28] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white sm:text-[10px]">
          {item.category}
        </span>
        <h3 className="font-[Manrope,sans-serif] text-sm font-bold text-white sm:text-base">{item.title}</h3>
        {item.subtitle && <p className="mt-0.5 text-[11px] text-[#adc7f9] sm:text-xs">{item.subtitle}</p>}
      </div>
    </div>
  );
};
