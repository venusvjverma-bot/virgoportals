interface ChatCardButtonProps {
  name: string;
  description: string;
  imageUrl: string | null;
  allergy?: string;
  badge?: string;
  price: string | null;
  priceOptions: string[];
  ariaLabel: string;
  /** Shows the "Tap to view" hint under the image. Dish cards only. */
  showImageHint?: boolean;
  onOpen: () => void;
}

export function ChatCardButton({
  name,
  description,
  imageUrl,
  allergy,
  badge,
  price,
  priceOptions,
  ariaLabel,
  showImageHint = false,
  onOpen,
}: ChatCardButtonProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      className="flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-white p-3 text-left shadow-lift ring-1 ring-olive-300 transition-all duration-200 hover:shadow-lift hover:ring-olive-500 focus-visible:ring-2 focus-visible:ring-olive-500 active:scale-[0.99]"
    >
      <div className="flex gap-3">
        <div className="flex w-24 shrink-0 flex-col">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-cream-200"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-[11px] text-ink-faint ring-1 ring-inset ring-cream-200">
              No image
            </div>
          )}
          {showImageHint && imageUrl ? (
            <span className="mt-1.5 inline-flex items-center justify-center rounded-full bg-cream-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-olive-700 ring-1 ring-inset ring-olive-300">
              Tap to view
            </span>
          ) : null}
          {price ? (
            <span className="mt-1.5 text-center text-sm font-medium text-olive-700">{price}</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          {badge ? (
            <span className="mb-1 inline-flex rounded-full bg-cream-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-olive-700 ring-1 ring-inset ring-olive-300">
              {badge}
            </span>
          ) : null}
          <h3 className="font-display text-base font-semibold text-ink">{name}</h3>
          {description ? (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-soft">{description}</p>
          ) : null}
          {allergy ? (
            <p className="mt-1.5 text-xs font-medium text-warning-700">Allergy: {allergy}</p>
          ) : null}
        </div>
      </div>
      {priceOptions.length > 0 ? (
        <p className="text-xs font-medium leading-relaxed text-olive-700">{priceOptions.join(' · ')}</p>
      ) : null}
    </button>
  );
}
