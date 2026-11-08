import Link from "next/link";
import Image from "next/image";
import { tintForSlug, tintGradient } from "@/lib/categoryTint";
import type { HomeCategoryTile } from "@/lib/data";

/** Archive of every category as a tinted tile (name + live post count) — replaces the old plain chip row. Mobile: 2 cols, up to 4 on desktop. */
export function CategoryMosaic({ categories }: { categories: HomeCategoryTile[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((cat) => {
        // A real cat.image photo always sits under a dark overlay, so white
        // text stays correct there — the ink override only matters for the
        // gradient-tile fallback, where the gold tint is too light for it.
        const ink = cat.image ? "#fff" : tintForSlug(cat.slug).ink;
        return (
          <Link
            key={cat._id}
            href={`/category/${cat.slug}`}
            className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-2xl p-5 transition-colors "
            style={cat.image ? undefined : { background: tintGradient(cat.slug) }}
          >
            {cat.image && (
              <>
                <Image
                  src={cat.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40" />
              </>
            )}
            <span className="relative font-serif text-lg font-bold" style={{ color: ink }}>
              {cat.name}
            </span>
            <span className="relative text-xs opacity-80" style={{ color: ink }}>
              {cat.postCount} {cat.postCount === 1 ? "article" : "articles"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
