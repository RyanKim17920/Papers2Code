export interface UserBasic {
    id: string;
    name: string;
    avatarUrl?: string;
}

export interface UserProfile {
    id: string;
    username: string;
    avatarUrl?: string | null;
    name?: string | null;
    isOwner?: boolean;
    isAdmin?: boolean;
}

export interface PaperActionUserProfile {
    id: string;
    username: string;
    avatarUrl?: string;
    actionType?: string;
    createdAt?: string;
}
