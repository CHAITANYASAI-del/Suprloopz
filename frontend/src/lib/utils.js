import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui className combiner.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
