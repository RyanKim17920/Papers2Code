// Implementation progress types with timeline-based updates

export enum UpdateEventType {
    INITIATED = 'Initiated',
    CONTRIBUTOR_JOINED = 'Contributor Joined',
    EMAIL_SENT = 'Email Sent',
    STATUS_CHANGED = 'Status Changed',
    GITHUB_REPO_LINKED = 'GitHub Repo Linked',
    GITHUB_REPO_UPDATED = 'GitHub Repo Updated',
}

export enum ProgressStatus {
    STARTED = 'Started',
    EMAIL_SENT = 'Email Sent',
    RESPONSE_RECEIVED = 'Response Received',
    CODE_UPLOADED = 'Code Uploaded',
    CODE_NEEDS_REFACTORING = 'Code Needs Refactoring',
    REFACTORING_STARTED = 'Refactoring Started',
    REFACTORING_FINISHED = 'Refactoring Finished',
    VALIDATION_IN_PROGRESS = 'Validation In Progress',
    OFFICIAL_CODE_POSTED = 'Official Code Posted',
    REFUSED_TO_UPLOAD = 'Refused to Upload',
    NO_RESPONSE = 'No Response',
    GITHUB_CREATED = 'GitHub Created',
    CODE_STARTED = 'Code Started',
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
