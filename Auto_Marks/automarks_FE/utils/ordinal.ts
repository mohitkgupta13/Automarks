export function formatOrdinal(n: number): string {
  const num = Math.trunc(Number(n));
  if (!Number.isFinite(num)) return String(n);

  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;

  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
}
