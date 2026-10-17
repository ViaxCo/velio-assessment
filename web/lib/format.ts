export const formatPrice = (priceMinor: number, currency: string) =>
  priceMinor === 0
    ? "Free"
    : new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(priceMinor / 100);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
