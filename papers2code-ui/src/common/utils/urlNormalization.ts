// URL normalization utilities for social media profiles

export interface NormalizedUrlResult {
  displayValue: string; // What to show in the UI (username/cleaned value)
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Extract LinkedIn username from URL or validate username
 * Display: username (e.g., "john-smith")
 * Store: full URL (e.g., "https://linkedin.com/in/john-smith")
 */
export function normalizeLinkedInUrl(input: string): NormalizedUrlResult {
  if (!input?.trim()) {
    return { displayValue: '', isValid: true };
  }

  const cleanInput = input.trim();
  const usernamePattern = /^[a-zA-Z0-9\-]+$/;

  // If it's a LinkedIn URL, extract the username
  if (cleanInput.toLowerCase().includes('linkedin.com')) {
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?/;
    const match = cleanInput.match(urlPattern);
    
    if (match) {
      const username = match[1];
      return { displayValue: username, isValid: true };
    } else {
      return { 
        displayValue: cleanInput, 
        isValid: false, 
        errorMessage: 'Invalid LinkedIn URL format' 
      };
    }
  }

  // If it's just a username, validate it
  if (usernamePattern.test(cleanInput)) {
    return { displayValue: cleanInput, isValid: true };
  }

  return { 
    displayValue: cleanInput, 
    isValid: false, 
    errorMessage: 'LinkedIn username can only contain letters, numbers, and dashes' 
  };
}

/**
 * Extract Twitter username from URL or validate username
 * Display: username (e.g., "username")
 * Store: full URL (e.g., "https://twitter.com/username")
 */
export function normalizeTwitterUrl(input: string): NormalizedUrlResult {
  if (!input?.trim()) {
    return { displayValue: '', isValid: true };
  }

  const cleanInput = input.trim();
  const usernamePattern = /^[a-zA-Z0-9_]+$/;

  // If it's a Twitter/X URL, extract the username
  if (cleanInput.toLowerCase().includes('twitter.com') || cleanInput.toLowerCase().includes('x.com')) {
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?/;
    const match = cleanInput.match(urlPattern);
    
    if (match) {
      const username = match[1];
      return { displayValue: username, isValid: true };
    } else {
      return { 
        displayValue: cleanInput, 
        isValid: false, 
        errorMessage: 'Invalid Twitter/X URL format' 
      };
    }
  }

  // Remove @ if present
  const username = cleanInput.startsWith('@') ? cleanInput.slice(1) : cleanInput;

  // Validate username
  if (usernamePattern.test(username)) {
    return { displayValue: username, isValid: true };
  }

  return { 
    displayValue: cleanInput, 
    isValid: false, 
    errorMessage: 'Twitter username can only contain letters, numbers, and underscores' 
  };
}

/**
 * Extract website URL and remove https:// for display
 * Display: domain.com (e.g., "example.com")
 * Store: full URL (e.g., "https://example.com")
 */
export function normalizeWebsiteUrl(input: string): NormalizedUrlResult {
  if (!input?.trim()) {
    return { displayValue: '', isValid: true };
  }

  const cleanInput = input.trim();
  
  // If it starts with http/https, remove it for display
  if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
    const displayValue = cleanInput.replace(/^https?:\/\//, '');
    return { displayValue, isValid: true };
  }

  // If it's just a domain, show as-is
  return { displayValue: cleanInput, isValid: true };
}

/**
 * Extract Bluesky handle from URL or validate handle
 * Display: full handle (e.g., "username.bsky.social")
 * Store: full handle (e.g., "username.bsky.social")
 */
export function normalizeBlueskyHandle(input: string): NormalizedUrlResult {
  if (!input?.trim()) {
    return { displayValue: '', isValid: true };
  }

  const cleanInput = input.trim();
  const usernamePattern = /^[a-zA-Z0-9\-]+$/;

  // If it's a Bluesky URL, extract the handle
  if (cleanInput.toLowerCase().includes('bsky.')) {
    if (cleanInput.startsWith('http')) {
      // URL format: https://bsky.app/profile/username.bsky.social
      const urlPattern = /(?:https?:\/\/)?(?:www\.)?bsky\.app\/profile\/([a-zA-Z0-9\-\.]+)\/?/;
      const match = cleanInput.match(urlPattern);
      if (match) {
        const handle = match[1];
        return { displayValue: handle, isValid: true };
      } else {
        return { 
          displayValue: cleanInput, 
          isValid: false, 
          errorMessage: 'Invalid Bluesky URL format' 
        };
      }
    } else {
      // It's already a handle like "username.bsky.social"
      return { displayValue: cleanInput, isValid: true };
    }
  }

  // If it's just a username, add .bsky.social for display
  if (usernamePattern.test(cleanInput)) {
    return { displayValue: `${cleanInput}.bsky.social`, isValid: true };
  }

  return { 
    displayValue: cleanInput, 
    isValid: false, 
    errorMessage: 'Bluesky username can only contain letters, numbers, and dashes' 
  };
}

/**
 * Extract Hugging Face username from URL or validate username
 * Display: username (e.g., "username")
 * Store: username (e.g., "username")
 */
export function normalizeHuggingFaceUsername(input: string): NormalizedUrlResult {
  if (!input?.trim()) {
    return { displayValue: '', isValid: true };
  }

  const cleanInput = input.trim();
  const usernamePattern = /^[a-zA-Z0-9\-_]+$/;

  // If it's a Hugging Face URL, extract the username
  if (cleanInput.toLowerCase().includes('huggingface.co')) {
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?huggingface\.co\/([a-zA-Z0-9\-_]+)\/?/;
    const match = cleanInput.match(urlPattern);
    
    if (match) {
      const username = match[1];
      return { displayValue: username, isValid: true };
    } else {
      return { 
        displayValue: cleanInput, 
        isValid: false, 
        errorMessage: 'Invalid Hugging Face URL format' 
      };
    }
  }

  // If it's just a username, validate it
  if (usernamePattern.test(cleanInput)) {
    return { displayValue: cleanInput, isValid: true };
  }

  return { 
    displayValue: cleanInput, 
    isValid: false, 
    errorMessage: 'Hugging Face username can only contain letters, numbers, dashes, and underscores' 
  };
}

/**
 * Convert display values back to values suitable for API submission
 */
export function convertDisplayToApiValue(field: string, displayValue: string): string {
  if (!displayValue?.trim()) return '';
  
  const cleanValue = displayValue.trim();
  
  switch (field) {
    case 'websiteUrl':
      // Add https:// if it doesn't start with http
      if (cleanValue && !cleanValue.startsWith('http')) {
        return `https://${cleanValue}`;
      }
      return cleanValue;
    
    case 'linkedinProfileUrl':
      // Backend will handle conversion to full URL
      return cleanValue;
    
    case 'twitterProfileUrl':
      // Backend will handle conversion to full URL
      return cleanValue;
    
    case 'blueskyUsername':
      // Keep the full handle or username as-is
      return cleanValue;
    
    case 'huggingfaceUsername':
      // Keep username as-is
      return cleanValue;
    
    default:
      return cleanValue;
  }
}
