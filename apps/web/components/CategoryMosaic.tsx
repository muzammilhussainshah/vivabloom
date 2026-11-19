import { CategoryTile } from "./CategoryTile";
import type { HomeCategoryTile } from "@/lib/data";

/**
 * Archive of every category as a tile (name + live post count). Mobile: 2 per
 * row, 3 at `sm`, 4 at `lg`. A centered flex-wrap (not a grid) with each tile
 * sized to exactly one column's width, so a short list — or the last,
 * partly-filled row — sits centered under the centered heading instead of
 * hugging the left edge.
 */
export function CategoryMosaic({ categories }: { categories: HomeCategoryTile[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4">
      {categories.map((cat) => (
        <div
          key={cat._id}
          className="w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"
        >
          <CategoryTile
            slug={cat.slug}
            name={cat.name}
            image={cat.image}
            countLabel={`${cat.postCount} ${cat.postCount === 1 ? "article" : "articles"}`}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
        </div>
      ))}
    </div>
  );
}
