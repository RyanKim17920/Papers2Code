import { useEffect, useRef } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  structuredData?: object | object[];
}

const BASE_TITLE = 'Papers2Code';
const BASE_URL = 'https://papers2code.com';

/**
 * SEO component for dynamically updating page metadata.
 * Restores original values on unmount so navigating between pages
 * doesn't leave stale meta tags behind.
 */
export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
  noindex,
  structuredData,
}) => {
  const originalValues = useRef<Map<string, string | null>>(new Map());
  const originalTitle = useRef<string>(document.title);

  useEffect(() => {
    const changed = new Map<string, string | null>();

    const setMeta = (property: string, content: string, isName = false) => {
      const attribute = isName ? 'name' : 'property';
      let el = document.querySelector(`meta[${attribute}="${property}"]`);

      // Store original value for cleanup
      if (!changed.has(`${attribute}:${property}`)) {
        changed.set(`${attribute}:${property}`, el?.getAttribute('content') ?? null);
      }

      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attribute, property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Title
    if (title) {
      document.title = `${title} | ${BASE_TITLE}`;
    }

    // Basic meta tags
    if (description) {
      setMeta('description', description, true);
      setMeta('og:description', description);
      setMeta('twitter:description', description);
    }
    if (keywords) setMeta('keywords', keywords, true);
    if (author) setMeta('author', author, true);
    if (noindex) setMeta('robots', 'noindex, nofollow', true);

    // Open Graph
    if (title) {
      setMeta('og:title', `${title} | ${BASE_TITLE}`);
      setMeta('twitter:title', `${title} | ${BASE_TITLE}`);
    }
    if (image) {
      setMeta('og:image', image);
      setMeta('twitter:image', image);
    }
    if (url) {
      setMeta('og:url', url);
      setMeta('twitter:url', url);
      // Update canonical
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', url);
    }
    if (type) setMeta('og:type', type);
    if (publishedTime) setMeta('article:published_time', publishedTime);
    if (modifiedTime) setMeta('article:modified_time', modifiedTime);

    // Structured data
    if (structuredData) {
      const items = Array.isArray(structuredData) ? structuredData : [structuredData];
      items.forEach((data, i) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-dynamic', 'true');
        script.setAttribute('data-seo-idx', String(i));
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      });
    }

    // Store for cleanup
    originalValues.current = changed;

    return () => {
      // Restore title
      document.title = originalTitle.current;

      // Restore meta tags
      changed.forEach((originalContent, key) => {
        const [attribute, property] = key.split(':');
        const el = document.querySelector(`meta[${attribute}="${property}"]`);
        if (el) {
          if (originalContent === null) {
            el.remove();
          } else {
            el.setAttribute('content', originalContent);
          }
        }
      });

      // Remove dynamic structured data
      document.querySelectorAll('script[data-dynamic="true"]').forEach(el => el.remove());
    };
  }, [title, description, keywords, image, url, type, author, publishedTime, modifiedTime, noindex, structuredData]);

  return null;
};

/**
 * Generate structured data for a research paper (ScholarlyArticle)
 */
export const generatePaperStructuredData = (paper: {
  id: string;
  title?: string | null;
  abstract?: string | null;
  authors?: string[] | null;
  publicationDate?: string | null;
  arxivId?: string | null;
  urlAbs?: string | null;
  urlPdf?: string | null;
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    name: paper.title || 'Research Paper',
    headline: paper.title || 'Research Paper',
    abstract: paper.abstract,
    author: paper.authors?.map(a => ({ '@type': 'Person', name: a })),
    datePublished: paper.publicationDate,
    identifier: paper.arxivId,
    url: paper.urlAbs || `${BASE_URL}/paper/${paper.id}`,
    ...(paper.urlPdf && { encodingFormat: 'application/pdf', contentUrl: paper.urlPdf }),
    publisher: {
      '@type': 'Organization',
      name: 'arXiv',
      url: 'https://arxiv.org',
    },
    isPartOf: {
      '@type': 'WebSite',
      name: BASE_TITLE,
      url: BASE_URL,
    },
  };
};

/**
 * Generate BreadcrumbList structured data
 */
export const generateBreadcrumbs = (
  items: Array<{ name: string; url: string }>
) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});

/**
 * Inject structured data into the page (for components that manage their own lifecycle)
 */
export const injectStructuredData = (data: object) => {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);

  const existing = document.querySelector('script[type="application/ld+json"][data-dynamic="true"]');
  if (existing) existing.remove();

  script.setAttribute('data-dynamic', 'true');
  document.head.appendChild(script);
};

export default SEO;
