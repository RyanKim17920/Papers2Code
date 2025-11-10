import { useEffect } from 'react';

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
}

/**
 * SEO component for dynamically updating page metadata
 * Use this on individual pages to customize SEO tags
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
}) => {
  useEffect(() => {
    // Update title
    if (title) {
      document.title = `${title} | Papers2Code`;
    }

    // Update or create meta tags
    const updateMetaTag = (property: string, content: string, isName = false) => {
      const attribute = isName ? 'name' : 'property';
      let element = document.querySelector(`meta[${attribute}="${property}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Basic meta tags
    if (description) {
      updateMetaTag('description', description, true);
      updateMetaTag('og:description', description);
      updateMetaTag('twitter:description', description);
    }

    if (keywords) {
      updateMetaTag('keywords', keywords, true);
    }

    if (author) {
      updateMetaTag('author', author, true);
    }

    // Open Graph tags
    if (title) {
      updateMetaTag('og:title', `${title} | Papers2Code`);
      updateMetaTag('twitter:title', `${title} | Papers2Code`);
    }

    if (image) {
      updateMetaTag('og:image', image);
      updateMetaTag('twitter:image', image);
    }

    if (url) {
      updateMetaTag('og:url', url);
      updateMetaTag('twitter:url', url);
      
      // Update canonical link
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', url);
    }

    if (type) {
      updateMetaTag('og:type', type);
    }

    // Article-specific tags
    if (publishedTime) {
      updateMetaTag('article:published_time', publishedTime);
    }

    if (modifiedTime) {
      updateMetaTag('article:modified_time', modifiedTime);
    }
  }, [title, description, keywords, image, url, type, author, publishedTime, modifiedTime]);

  return null;
};

/**
 * Generate structured data for a research paper
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
    author: paper.authors?.map(author => ({
      '@type': 'Person',
      name: author,
    })),
    datePublished: paper.publicationDate,
    identifier: paper.arxivId,
    url: paper.urlAbs || `https://papers2code.com/paper/${paper.id}`,
    ...(paper.urlPdf && { encodingFormat: 'application/pdf', contentUrl: paper.urlPdf }),
    publisher: {
      '@type': 'Organization',
      name: 'arXiv',
      url: 'https://arxiv.org',
    },
  };
};

/**
 * Inject structured data into the page
 */
export const injectStructuredData = (data: object) => {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  
  // Remove existing structured data for the same type if present
  const existing = document.querySelector('script[type="application/ld+json"][data-dynamic="true"]');
  if (existing) {
    existing.remove();
  }
  
  script.setAttribute('data-dynamic', 'true');
  document.head.appendChild(script);
};

export default SEO;
