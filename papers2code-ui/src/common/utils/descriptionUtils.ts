import type { Paper } from '@/common/types/paper';

/**
 * Produce a concise description for a paper for list/feed contexts.
 * Prefers abstract; falls back to synthesized snippet from title.
 * Truncates at word boundary.
 */
export function getPaperDescription(paper: Paper, maxLength: number = 180): string {
  const source = (paper.abstract && paper.abstract.trim()) || paper.title || '';
  if (!source) return '';
  if (source.length <= maxLength) return source;
  // Truncate respecting word boundaries
  const truncated = source.slice(0, maxLength + 1).split(/\s+/).slice(0, -1).join(' ');
  return truncated.replace(/[.,;:!-]*$/,'') + '…';
}
