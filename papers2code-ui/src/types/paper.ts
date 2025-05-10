// src/types/paper.ts (Review and adjust if needed)

export interface Author {
    id: number;
    name: string;
}

export enum ImplementationStatus {
    //NotStarted = 'Not Started',
    ContactingAuthor = 'Contacting Author',
    DefiningRequirements = 'Defining Requirements',
    ImplementationInProgress = 'Implementation In Progress',
    AnnotatingCode = 'Annotating Code',
    Completed = 'Completed',
    AuthorDeclined = 'Author Declined (Proceeding)',
    AwaitingReview = 'Awaiting Review',
    NeedsCode = 'Needs Code',
    ConfirmedNonImplementable = 'Confirmed Non-Implementable', // <-- NEW STATUS
}

export interface ImplementationStep {
    id: number;
    order: number;
    name: string;
    description: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    github_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface Paper {
    id: string;
    title: string;
    abstract: string | null;
    authors: Author[] | null;
    arxivId: string | null;
    urlAbs: string | null;
    urlPdf: string | null;
    proceeding: string | null;
    date: string | null; // Consider using Date type after fetching
    tags: string[] | null;
    pwcUrl: string | null;
    ownerId: number | null; // Added ownerId
    implementationStatus: string | null;
    implementationNotes: string | null;
    implementationSteps: ImplementationStep[] | null;
    isImplementable: boolean;
    nonImplementableStatus: 'implementable' | 'flagged_non_implementable' | 'confirmed_non_implementable';
    nonImplementableReason: string | null;
    nonImplementableConfirmedBy: string | null;
    upvoteCount: number;
    nonImplementableVotes: number;
    disputeImplementableVotes: number;
    currentUserVote: 'up' | 'none';
    currentUserImplementabilityVote: 'up' | 'down' | 'none'; // 'up' = flagged non-implementable, 'down' = disputed flag
    created_at: string;
    updated_at: string;
    tasks?: string[]; // Add optional tasks property
}

// Define the specific actions for implementability voting (matching backend)
export type ImplementabilityAction = 'confirm' | 'dispute' | 'retract';

export interface PaperSummary {
    id: string;
    pwcUrl?: string | null;
    title: string;
    authors: Author[];
    date: string;
    implementationStatus: ImplementationStatus | string;
    isImplementable: boolean;
}

