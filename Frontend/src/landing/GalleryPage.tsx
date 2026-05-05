import { LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type GalleryItemRecord } from "../services/api";

export const GalleryPage = () => {
  const [items, setItems] = useState<GalleryItemRecord[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.getPublicGallery()
      .then((data) => {
        if (!mounted) return;
        setItems(data.items);
        setCategories(data.categories.length > 0 ? data.categories : ["All"]);
      })
      .catch(() => {/* silently show empty state */})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = filter === "All"
    ? items
    : items.filter((item) => item.category === filter);

  // Split into 3 equal columns for zigzag layout
  const col1 = filtered.filter((_, i) => i % 3 === 0);
  const col2 = filtered.filter((_, i) => i % 3 === 1);
  const col3 = filtered.filter((_, i) => i % 3 === 2);

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

      {/* Gallery */}
      <section className="bg-[#faf9fd] py-12 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Filter tabs */}
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

          {/* Loading */}
          {loading && (
            <div className="py-20 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#f28c28]" />
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center">
              <LayoutGrid className="mx-auto mb-4 text-slate-300" size={48} />
              <p className="text-base font-semibold text-slate-500">Hakuna picha kwa sasa</p>
              <p className="mt-1 text-sm text-slate-400">
                {filter !== "All"
                  ? `Hakuna picha katika kategoria "${filter}"`
                  : "Picha za miradi zitaonekana hapa"}
              </p>
            </div>
          )}

          {/* 3-column zigzag grid */}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Column 1 — starts at normal height */}
              <div className="flex flex-col gap-4">
                {col1.map((item) => (
                  <GalleryCard item={item} key={item.id} />
                ))}
              </div>

              {/* Column 2 — offset down for zigzag effect */}
              <div className="flex flex-col gap-4 sm:mt-10">
                {col2.map((item) => (
                  <GalleryCard item={item} key={item.id} />
                ))}
              </div>

              {/* Column 3 — offset down more */}
              <div className="flex flex-col gap-4 sm:mt-20">
                {col3.map((item) => (
                  <GalleryCard item={item} key={item.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Stats banner */}
      <section className="bg-[#0b2a53] py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 text-center sm:gap-6 lg:grid-cols-4">
            {[
              { value: "200+", label: "Projects Delivered" },
              { value: "6",    label: "Service Categories" },
              { value: "15+",  label: "Years Experience" },
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

/* ── Gallery Card ── */
const GalleryCard = ({ item }: { item: GalleryItemRecord }) => {
  const imgSrc = item.imageUrl.startsWith("/uploads")
    ? `${(import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace("/api", "") ?? "http://localhost:5050"}${item.imageUrl}`
    : item.imageUrl;

  return (
    <div className="group relative w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
      <div className="relative w-full">
        <img
          alt={item.title}
          className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          src={imgSrc}
          style={{ display: "block" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001534]/80 via-[#001534]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <div className="p-4">
        <span className="mb-1.5 inline-block rounded-full bg-[#f28c28]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#f28c28]">
          {item.category}
        </span>
        <h3 className="font-[Manrope,sans-serif] text-sm font-bold text-[#0b2a53] sm:text-base">
          {item.title}
        </h3>
        {item.subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
        )}
      </div>
    </div>
  );
};
