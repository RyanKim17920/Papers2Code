// src/types/paper.ts (Review and adjust if needed)

export interface Author {
  name: string; // Backend now sends this structure
}

export interface Author {
  name: string;
}

export enum ImplementationStatus {
    NotStarted = 'Not Started',
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
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
}

export interface Paper {
  id: string;
  pwcUrl?: string;
  arxivId?: string;
  title: string;
  abstract: string;
  authors: Author[];
  urlAbs?: string;
  urlPdf?: string;
  date: string;
  proceeding?: string;
  tasks?: string[];
  // --- Implementability Fields ---
  isImplementable: boolean;
  nonImplementableStatus: 'implementable' | 'flagged_non_implementable' | 'confirmed_non_implementable';
  nonImplementableVotes: number; // Votes confirming non-implementability (Thumbs Up)
  disputeImplementableVotes: number; // Votes disputing non-implementability (Thumbs Down)
  currentUserImplementabilityVote: 'up' | 'down' | 'none'; // <-- CHANGED: Use 'up'/'down' for frontend state
  nonImplementableConfirmedBy: 'community' | 'owner' | null; // <-- NEW: Track confirmation source
  // --- End Implementability Fields ---
  implementationStatus: ImplementationStatus | string; // Overall status (will include ConfirmedNonImplementable)
  implementationSteps: ImplementationStep[];
  upvoteCount: number;
  currentUserVote: 'up' | 'none';
}

export interface PaperSummary {
    id: string;
    pwcUrl?: string | null;
    title: string;
    authors: Author[];
    date: string;
    implementationStatus: ImplementationStatus | string;
    isImplementable: boolean;
}