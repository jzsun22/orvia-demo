import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a worker's name based on the context
 * @param firstName The worker's first name
 * @param lastName The worker's last name
 * @param preferredName The worker's preferred name (nickname)
 * @param format The format to use: 'full' for "nickname (first_name) last_name" or 'display' for just "nickname"
 * @returns Formatted name string
 */
export function formatWorkerName(
  firstName: string,
  lastName: string,
  preferredName?: string | null,
  format: 'full' | 'display' = 'full'
): string {
  if (!preferredName) {
    return `${firstName} ${lastName}`;
  }

  if (format === 'display') {
    return preferredName;
  }

  return `${preferredName} (${firstName}) ${lastName}`;
} 

/**
 * Capitalizes the first letter of each word in a string
 * @param str The string to capitalize
 * @returns The string with each word capitalized
 */
export function capitalizeWords(str: string | undefined | null): string {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
} 

/**
 * Formats a location name from a slug.
 * e.g. "san-francisco" -> "San Francisco"
 * @param name The location name string (slug format)
 * @returns The formatted location name
 */
export function formatLocationName(name: string | undefined): string {
  if (!name) return "";
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
} 