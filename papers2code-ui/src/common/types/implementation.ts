// Simplified implementation progress types to match the new backend schema

export enum EmailStatus {
    NOT_SENT = 'Not Sent',
    SENT = 'Sent',
    RESPONSE_RECEIVED = 'Response Received',
    CODE_UPLOADED = 'Code Uploaded',
    CODE_NEEDS_REFACTORING = 'Code Needs Refactoring',
    REFUSED_TO_UPLOAD = 'Refused to Upload',
    NO_RESPONSE = 'No Response',
}

export interface ImplementationProgress {
    id: string; // This is the paper ID (since _id is now the paper ID)
    initiatedBy: string;
    contributors: string[];
    emailStatus: EmailStatus;
    emailSentAt?: string | null; // When the email was sent (for cooldown calculation)
    githubRepoId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ProgressUpdate {
    emailStatus?: EmailStatus;
    githubRepoId?: string;
}
