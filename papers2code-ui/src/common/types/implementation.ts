// Implementation progress types with timeline-based updates

export enum UpdateEventType {
    INITIATED = 'initiated',
    CONTRIBUTOR_JOINED = 'contributor_joined',
    EMAIL_SENT = 'email_sent',
    STATUS_CHANGED = 'status_changed',
    GITHUB_REPO_LINKED = 'github_repo_linked',
    GITHUB_REPO_UPDATED = 'github_repo_updated',
}

export enum ProgressStatus {
    STARTED = 'Started',
    RESPONSE_RECEIVED = 'Response Received',
    CODE_UPLOADED = 'Code Uploaded',
    CODE_NEEDS_REFACTORING = 'Code Needs Refactoring',
    REFACTORING_IN_PROGRESS = 'Refactoring in Progress',
    REFUSED_TO_UPLOAD = 'Refused to Upload',
    NO_RESPONSE = 'No Response',
}

export interface ProgressUpdateEvent {
    eventType: UpdateEventType;
    timestamp: string;
    userId?: string | null;
    details?: Record<string, any>;
}

export interface ImplementationProgress {
    id: string; // This is the paper ID (since _id is now the paper ID)
    initiatedBy: string;
    contributors: string[];
    status: ProgressStatus;
    latestUpdate: string;
    githubRepoId?: string | null;
    updates: ProgressUpdateEvent[];
    createdAt: string;
    updatedAt: string;
}

export interface ProgressUpdateRequest {
    status?: ProgressStatus;
    githubRepoId?: string;
}

// Legacy enum for backward compatibility during migration
export enum EmailStatus {
    NOT_SENT = 'Not Sent',
    SENT = 'Sent',
    RESPONSE_RECEIVED = 'Response Received',
    CODE_UPLOADED = 'Code Uploaded',
    CODE_NEEDS_REFACTORING = 'Code Needs Refactoring',
    REFUSED_TO_UPLOAD = 'Refused to Upload',
    NO_RESPONSE = 'No Response',
}
