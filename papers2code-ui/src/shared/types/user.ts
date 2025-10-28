export interface UserBasic {
    id: string;
    name: string;
    avatarUrl?: string;
}

export interface UserProfile {
    id: string;
    username: string;
    avatarUrl?: string | null;
    githubAvatarUrl?: string | null;
    googleAvatarUrl?: string | null;
    preferredAvatarSource?: string;
    name?: string | null;
    bio?: string | null;
    websiteUrl?: string | null;
    twitterProfileUrl?: string | null;
    linkedinProfileUrl?: string | null;
    blueskyUsername?: string | null;
    huggingfaceUsername?: string | null;
    isOwner?: boolean;
    isAdmin?: boolean;
    createdAt?: string;
    lastLoginAt?: string;
    profileUpdatedAt?: string;
    // Privacy settings
    showEmail?: boolean;
    showGithub?: boolean;
    email?: string | null;
    githubId?: number | null;
    googleId?: string | null;
}

export interface PaperActionUserProfile {
    id: string;
    username: string;
    avatarUrl?: string;
    actionType?: string;
    createdAt?: string;
}
