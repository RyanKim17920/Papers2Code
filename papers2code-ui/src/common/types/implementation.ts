// Implementation progress types with timeline-based updates

export enum UpdateEventType {
    INITIATED = 'Initiated',
    CONTRIBUTOR_JOINED = 'Contributor Joined',
    EMAIL_SENT = 'Email Sent',
    STATUS_CHANGED = 'Status Changed',
    GITHUB_REPO_LINKED = 'GitHub Repo Linked',
    GITHUB_REPO_UPDATED = 'GitHub Repo Updated',
    VALIDATION_STARTED = 'Validation Started',
    VALIDATION_COMPLETED = 'Validation Completed',
}

export enum ProgressStatus {
    NOT_STARTED = 'Not Started',
    STARTED = 'Started',
    EMAIL_SENT = 'Email Sent',
    OFFICIAL_CODE_POSTED = 'Official Code Posted',
    CODE_NEEDS_REFACTORING = 'Code Needs Refactoring',
    REFACTORING_STARTED = 'Refactoring Started',
    REFACTORING_FINISHED = 'Refactoring Finished',
    VALIDATION_IN_PROGRESS = 'Validation in Progress',
    VALIDATION_COMPLETED = 'Validation Completed',
    NO_CODE_FROM_AUTHOR = 'No Code from Author',
    GITHUB_CREATED = 'GitHub Created',
    CODE_NEEDED = 'Code Needed',
    REFUSED_TO_UPLOAD = 'Refused to Upload',
    NO_RESPONSE = 'No Response',
}

export interface ProgressUpdateEvent {
    eventType: UpdateEventType;
    timestamp: string;
    userId?: string | null;
    details?: Record<string, unknown>;
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
