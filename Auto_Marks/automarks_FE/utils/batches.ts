export function getBatchOptions(options?: {
  programYears?: number;
  pastStartYears?: number;
  futureStartYears?: number;
}): string[] {
  const programYears = options?.programYears ?? 4;
  const pastStartYears = options?.pastStartYears ?? 8;
  const futureStartYears = options?.futureStartYears ?? 2;

  const currentYear = new Date().getFullYear();
  const start = currentYear - pastStartYears;
  const end = currentYear + futureStartYears;

  const batches: string[] = [];
  for (let y = start; y <= end; y += 1) {
    batches.push(`${y}-${y + programYears}`);
  }
  return batches;
}
