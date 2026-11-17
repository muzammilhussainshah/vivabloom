import { CategoryTile } from "./CategoryTile";
import type { HomeCategoryTile } from "@/lib/data";

/** Archive of every category as a tile (name + live post count). Mobile: 2 cols, up to 4 on desktop. */
export function CategoryMosaic({ categories }: { categories: HomeCategoryTile[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((cat) => (
        <CategoryTile
          key={cat._id}
          slug={cat.slug}
          name={cat.name}
          image={cat.image}
          countLabel={`${cat.postCount} ${cat.postCount === 1 ? "article" : "articles"}`}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
      ))}
    </div>
  );
}
