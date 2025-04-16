/**
 * Returns an array of page labels (numbers and the string "…") to display,
 * so users see something like: 1 … 4 5 6 … 50
 * 
 * @param currentPage - The current active page
 * @param totalPages - The total number of pages
 * @param surroundingCount - How many pages to show around the current page
 */
export default function getVisiblePages(
  currentPage: number,
  totalPages: number,
  surroundingCount = 2
): (number | string)[] {
  const pages: (number | string)[] = [];
  if (totalPages <= 1 + surroundingCount * 2 + 2) {
    for (let i = 1; i <= totalPages; i++) { pages.push(i); }
    return pages;
  }
  pages.push(1);
  const start = Math.max(2, currentPage - surroundingCount);
  const end = Math.min(totalPages - 1, currentPage + surroundingCount);
  if (start > 2) { pages.push("…"); }
  for (let i = start; i <= end; i++) { pages.push(i); }
  if (end < totalPages - 1) { pages.push("…"); }
  pages.push(totalPages);
  return pages;
}
  