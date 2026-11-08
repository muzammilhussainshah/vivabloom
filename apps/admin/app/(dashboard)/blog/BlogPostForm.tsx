"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { slugify } from "@/lib/slugify";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/RichTextEditor";
import { AIGenerateTextButton } from "@/components/AIGenerateTextButton";
import { AIGenerateImageButton } from "@/components/AIGenerateImageButton";
import { GenerateAllButton } from "@/components/GenerateAllButton";
import { blogCoverImagePrompt, blogTagsPrompt } from "@/lib/ai/prompts";
import type { ActionState } from "./actions";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface StoreOption {
  id: string;
  name: string;
}

export interface ProductOption {
  id: string;
  name: string;
  price: number;
  productUrl: string;
  storeId: string;
}

export interface CountryOption {
  code: string;
  name: string;
}

export interface BlogPostFormInitialData {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string | null;
  category: string;
  tags?: string[];
  author?: string;
  status: "draft" | "published" | "scheduled";
  publishedAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImage?: string | null;
  relatedStoreIds: string[];
  aiTopic?: string | null;
  aiProductIds?: string[];
  aiCountry?: string | null;
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

/** LLMs sometimes wrap HTML output in a markdown code fence despite instructions not to. */
function stripCodeFence(text: string) {
  return text.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/** Turns an AI/comma/newline-separated string into clean lowercase tags. */
function parseTagList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((t) =>
      t
        .replace(/^[\s\-*•\d.)]+/, "") // strip leading bullets/numbering
        .replace(/^["']|["'.]+$/g, "") // strip surrounding quotes/trailing periods
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
}

export function BlogPostForm({
  action,
  categoryOptions,
  storeOptions,
  productOptions,
  countryOptions,
  initialData,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  categoryOptions: CategoryOption[];
  storeOptions: StoreOption[];
  productOptions: ProductOption[];
  countryOptions: CountryOption[];
  initialData?: BlogPostFormInitialData;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? "");
  const [coverImage, setCoverImage] = useState(initialData?.coverImage ?? "");
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [seoTitle, setSeoTitle] = useState(initialData?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initialData?.seoDescription ?? "");
  // Single related store, chosen from a dropdown; also gives the AI context.
  const [storeId, setStoreId] = useState(initialData?.relatedStoreIds?.[0] ?? "");
  const [country, setCountry] = useState(initialData?.aiCountry ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [topic, setTopic] = useState(initialData?.aiTopic ?? "");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialData?.aiProductIds ?? []);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsPending, setTopicsPending] = useState(false);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  // Clearing the store should clear stale suggestions immediately rather than
  // via an extra effect pass — React's recommended way to adjust state in
  // response to a prop/state change is during render, not inside an effect
  // whose only job would be syncing state to state.
  const [suggestionsForStore, setSuggestionsForStore] = useState(storeId);
  if (storeId !== suggestionsForStore) {
    setSuggestionsForStore(storeId);
    if (!storeId) {
      setTopicSuggestions([]);
      setTopicsError(null);
    }
  }

  // Load this store's (and country's) saved-but-unused topic batch (no AI
  // call) whenever the store or country changes, so a returning admin sees
  // last time's list. Each (store, country) pair has its own batch — see
  // BlogTopicSuggestion — so switching country switches the list too.
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard loading-flag-before-fetch pattern; the fetch below resolves it in a .then/.finally callback
    setTopicsLoading(true);
    const query = country ? `storeId=${storeId}&country=${country}` : `storeId=${storeId}`;
    fetch(`/api/ai/generate-blog-topics?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTopicSuggestions(Array.isArray(data.topics) ? data.topics : []);
      })
      .catch(() => {
        if (!cancelled) setTopicSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setTopicsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, country]);

  // Default-check a newly picked store's own products, without clobbering the
  // initial selection an edit page loads with. Adjusted during render (the
  // React-recommended way to react to a prop/state change) rather than in an
  // effect, so `defaultedForStore` starting equal to `storeId` naturally skips
  // the very first render — opening the edit form keeps `initialData`'s
  // already-saved picks; switching stores after that always resets to that
  // store's products, which the checkboxes below can still override.
  const [defaultedForStore, setDefaultedForStore] = useState(storeId);
  if (storeId !== defaultedForStore) {
    setDefaultedForStore(storeId);
    if (storeId) {
      setSelectedProductIds(productOptions.filter((p) => p.storeId === storeId).map((p) => p.id));
    }
  }

  async function generateTopics() {
    if (!storeId) return;
    setTopicsPending(true);
    setTopicsError(null);
    try {
      const res = await fetch("/api/ai/generate-blog-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, country: country || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setTopicSuggestions(Array.isArray(data.topics) ? data.topics : []);
    } catch (err) {
      setTopicsError(err instanceof Error ? err.message : "Topic generation failed.");
    } finally {
      setTopicsPending(false);
    }
  }

  const countryLabel = countryOptions.find((c) => c.code === country)?.name;

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function getSelectedProducts() {
    return productOptions
      .filter((p) => selectedProductIds.includes(p.id))
      .map((p) => ({ name: p.name, price: p.price, productUrl: p.productUrl }));
  }

  /** Fill every field from a one-shot AI generation. */
  function applyGeneratedArticle(article: {
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    seoTitle: string;
    seoDescription: string;
  }) {
    if (article.title) {
      setTitle(article.title);
      if (!slugTouched) setSlug(slugify(article.title));
    }
    if (article.excerpt) setExcerpt(article.excerpt);
    if (article.content) editorRef.current?.setContent(stripCodeFence(article.content));
    if (article.tags?.length) {
      const seen = new Set<string>();
      setTags(
        article.tags
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t && !seen.has(t) && seen.add(t))
          .slice(0, 20)
      );
    }
    if (article.seoTitle) setSeoTitle(article.seoTitle);
    if (article.seoDescription) setSeoDescription(article.seoDescription);
  }

  function addTags(incoming: string[]) {
    setTags((prev) => {
      const seen = new Set(prev.map((t) => t.toLowerCase()));
      const merged = [...prev];
      for (const raw of incoming) {
        const t = raw.trim().toLowerCase();
        if (t && !seen.has(t)) {
          seen.add(t);
          merged.push(t);
        }
      }
      return merged.slice(0, 20);
    });
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function commitTagInput() {
    if (tagInput.trim()) addTags([tagInput]);
    setTagInput("");
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTagInput();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-base border border-brand-primary/40 bg-surface-muted p-4">
        <div>
          <h2 className="text-sm font-semibold text-brand-primary">Generate with AI</h2>
          <p className="text-xs text-text-muted">
            Pick a store, optionally a country to localize for, and a topic, then generate the whole
            article — title, tags, content and SEO fields — in one click. You can edit everything
            afterwards.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="storeId" className="text-sm font-medium">
              Store <span className="text-text-muted">(optional)</span>
            </label>
            <select
              id="storeId"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="">No related store</option>
              {storeOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="country" className="text-sm font-medium">
              Country <span className="text-text-muted">(optional — localizes topics &amp; content)</span>
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="">No specific country</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="topic" className="text-sm font-medium">
            Topic
          </label>
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Best fitness equipment deals for 2026"
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>

        {storeId && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Suggested topics{" "}
                <span className="text-text-muted">
                  (high search-intent ideas for this store{countryLabel ? `, localized for ${countryLabel}` : ""})
                </span>
              </label>
              <button
                type="button"
                onClick={generateTopics}
                disabled={topicsPending}
                className="self-start rounded-base border border-brand-primary px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-surface-muted disabled:opacity-60"
              >
                {topicsPending
                  ? "Generating…"
                  : topicSuggestions.length > 0
                    ? "Regenerate topics"
                    : "Generate topic ideas"}
              </button>
            </div>
            {topicsError && <p className="text-xs text-brand-secondary">{topicsError}</p>}
            {topicsLoading ? (
              <p className="text-xs text-text-muted">Loading saved suggestions…</p>
            ) : topicSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topicSuggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    aria-pressed={topic === t}
                    className={`rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      topic === t
                        ? "border-brand-primary bg-brand-primary/10 text-brand-accent"
                        : "border-border bg-surface text-text hover:border-brand-primary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                No suggestions yet for this store — generate some ideas, then click one to use it as the topic.
              </p>
            )}
          </div>
        )}

        {productOptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              Products <span className="text-text-muted">(optional — included in the AI prompt)</span>
            </label>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-base border border-border bg-surface p-2">
              {productOptions.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {p.name} <span className="text-text-muted">(${p.price.toFixed(2)})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* The selected store is submitted as the post's related store. */}
        {storeId && <input type="hidden" name="relatedStores" value={storeId} />}
        {/* Persisted so a future edit can see (and regenerate from) the original AI inputs. */}
        <input type="hidden" name="aiTopic" value={topic} />
        <input type="hidden" name="aiCountry" value={country} />
        {selectedProductIds.map((id) => (
          <input key={id} type="hidden" name="aiProducts" value={id} />
        ))}
        <GenerateAllButton
          getTopic={() => topic}
          getStoreName={() => storeOptions.find((s) => s.id === storeId)?.name}
          getProducts={getSelectedProducts}
          getCountry={() => country}
          onGenerated={applyGeneratedArticle}
        />
      </section>

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="slug" className="text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="excerpt" className="text-sm font-medium">
          Excerpt
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Short summary shown on index/card pages"
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Content</label>
          <GenerateAllButton
            label="Generate draft with AI"
            getTopic={() => topic || title}
            getStoreName={() => storeOptions.find((s) => s.id === storeId)?.name}
            getProducts={getSelectedProducts}
            getCountry={() => country}
            onGenerated={(article) => {
              if (article.content) editorRef.current?.setContent(stripCodeFence(article.content));
            }}
          />
        </div>
        <RichTextEditor ref={editorRef} name="content" initialContent={initialData?.content} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="tag-input" className="text-sm font-medium">
            Tags <span className="text-text-muted">(SEO)</span>
          </label>
          <AIGenerateTextButton
            label="Generate tags with AI"
            task="blogTags"
            getPrompt={() =>
              blogTagsPrompt({ title, excerpt, body: editorRef.current?.getText().slice(0, 1500) })
            }
            onGenerated={(text) => addTags(parseTagList(text))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-base border border-border bg-surface p-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-accent"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
                className="leading-none text-brand-accent/70 hover:text-brand-secondary"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={commitTagInput}
            placeholder={tags.length ? "Add a tag…" : "e.g. fitness deals, home gym, trusted brands"}
            className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none"
          />
        </div>
        {/* Hidden inputs carry the tag list into the server action. */}
        {tags.map((tag) => (
          <input key={tag} type="hidden" name="tags" value={tag} />
        ))}
        <p className="text-xs text-text-muted">
          Press Enter or comma to add. Used as SEO keywords and shown on the article.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="" disabled>
              Select a category…
            </option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="author" className="text-sm font-medium">
            Author
          </label>
          <input
            id="author"
            name="author"
            defaultValue={initialData?.author ?? "VivaBloom"}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="coverImage" className="text-sm font-medium">
            Cover image URL <span className="text-text-muted">(optional)</span>
          </label>
          <AIGenerateImageButton
            task="blogCover"
            getPrompt={() =>
              blogCoverImagePrompt({
                title,
                excerpt,
                content: editorRef.current?.getText() || "",
                category: categoryOptions.find((c) => c.id === category)?.name,
                tags,
                store: storeOptions.find((s) => s.id === storeId)?.name,
              })
            }
            onGenerated={setCoverImage}
          />
        </div>
        <input
          id="coverImage"
          name="coverImage"
          type="url"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary/AI-generated URL
          <img src={coverImage} alt="Cover preview" className="mt-1 h-32 w-auto rounded-base object-cover" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        {(status === "published" || status === "scheduled") && (
          <div className="flex flex-col gap-1">
            <label htmlFor="publishedAt" className="text-sm font-medium">
              {status === "scheduled" ? "Publish date" : "Published date"}
            </label>
            <input
              id="publishedAt"
              name="publishedAt"
              type="date"
              defaultValue={toDateInputValue(initialData?.publishedAt)}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
        )}
      </div>
      {status === "scheduled" && (
        <p className="text-xs text-text-muted">
          Scheduled posts don&apos;t auto-publish yet — you&apos;ll need to change the status to
          Published manually when the date arrives.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="seoTitle" className="text-sm font-medium">
            SEO title <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="seoTitle"
            name="seoTitle"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ogImage" className="text-sm font-medium">
            OG image URL <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="ogImage"
            name="ogImage"
            type="url"
            defaultValue={initialData?.ogImage ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="seoDescription" className="text-sm font-medium">
          SEO description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="seoDescription"
          name="seoDescription"
          rows={2}
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>

      {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
    </form>
  );
}
