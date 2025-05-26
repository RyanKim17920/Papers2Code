// src/types/paper.ts (Review and adjust if needed)

export interface Author { // This interface might be used for detailed views or future enhancements
    // If author objects are never fetched with an ID from this API, 'id' might be removed or sourced differently.
    id?: number; // Made optional as backend Author models don't consistently show it
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
    // Fields from schemas_papers.py::PaperResponse (camelCased)
    id: string;
    title: string;
    authors: string[] | null; // MAJOR CHANGE: Was Author[] | null
    publicationDate?: string | null; // RENAMED from 'date' (from publication_date)
    abstract?: string | null;
    arxivId?: string | null; // Was arxivId
    doi?: string | null; // ADDED
    urlAbs?: string | null;
    urlPdf?: string | null;
    tags?: string[] | null; // This aligns with backend 'tags'
    publicationYear?: number | null; // ADDED
    venue?: string | null; // ADDED
    citationsCount?: number | null; // ADDED (from citations_count)
    addedByUsername?: string | null; // ADDED
    addedDate?: string | null; // RENAMED from 'created_at' (from added_date)
    lastModifiedDate?: string | null; // RENAMED from 'updated_at' (from last_modified_date)
    isApproved?: boolean; // ADDED
    approvedByUsername?: string | null; // ADDED
    approvalDate?: string | null; // ADDED

    // Existing frontend fields NOT in schemas_papers.py::PaperResponse - ensure they are optional
    proceeding?: string | null;
    pwcUrl?: string | null;
    ownerId?: number | null;
    implementationStatus?: string | null; // Or use ImplementationStatus enum, ensure it's optional
    implementationSteps?: ImplementationStep[] | null;
    isImplementable?: boolean; // This was boolean, backend has no direct equivalent in BasePaper
    nonImplementableStatus?: 'implementable' | 'flagged_non_implementable' | 'confirmed_non_implementable' | 'confirmed_implementable' | 'voting';
    nonImplementableReason?: string | null;
    nonImplementableConfirmedBy?: string | null;
    upvoteCount?: number;
    nonImplementableVotes?: number;
    disputeImplementableVotes?: number;
    currentUserVote?: 'up' | 'none';
    currentUserImplementabilityVote?: 'up' | 'down' | 'none';
    
    // 'tasks' was optional. If 'tags' is the backend equivalent, prefer 'tags'.
    // If 'tasks' is different and needed, it remains optional.
    tasks?: string[]; // Keep if distinct from tags, otherwise rely on tags.
}

// Define the specific actions for implementability voting (matching backend)
export type ImplementabilityAction = 'confirm' | 'dispute' | 'retract';

// Define the possible statuses an owner can set
export type OwnerSettableImplementabilityStatus = 'confirmed_implementable' | 'confirmed_non_implementable' | 'voting';

export interface PaperSummary {
    id: string;
    pwcUrl?: string | null;
    title: string;
    authors: Author[]; // Kept as Author[] for summaries
    date: string;
    implementationStatus: ImplementationStatus | string;
    isImplementable: boolean;
}

