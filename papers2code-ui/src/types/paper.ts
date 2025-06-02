// src/types/paper.ts (Review and adjust if needed)
export type Status = 'Not Implementable' | 'Not Started' | 'Started' | 'Waiting for Author Response' | 'Work in Progress' | 'Completed' | 'Official Code Posted';

// MODIFIED: Renamed to avoid conflict with overall progress status
export type StepProgressStatus = 'Not Started' | 'Started' | 'Work in Progress' | 'Completed';

export interface Author { // This interface might be used for detailed views or future enhancements
    // If author objects are never fetched with an ID from this API, 'id' might be removed or sourced differently.
    id?: number; // Made optional as backend Author models don't consistently show it
    name: string;
}

export interface ImplementationStep {
    id: number;
    order: number;
    name: string;
    description: string | null;
    status: StepProgressStatus; // Use the new StepProgressStatus type
    github_url: string | null;
    created_at: string;
    updated_at: string;
}

// --- NEW TYPES FOR IMPLEMENTATION PROGRESS ---

export enum AuthorOutreachStatusTs {
    NOT_INITIATED = "Not Initiated",
    CONTACT_SENT = "Contact Initiated - Awaiting Response",
    RESPONSE_APPROVED = "Response Received - Approved Proceeding",
    RESPONSE_DECLINED = "Response Received - Declined Proceeding",
    RESPONSE_OWN_CODE = "Response Received - Provided Own Code",
    NO_RESPONSE = "No Response - Grace Period Ended",
}

export enum ComponentCategoryTs {
    CORE = "core",
    ADDON = "addon",
}

export enum ComponentStatusTs {
    TO_DO = "To Do",
    IN_PROGRESS = "In Progress",
    COMPLETED = "Completed",
    BLOCKED = "Blocked",
    SKIPPED = "Skipped",
}

export enum OverallProgressStatusTs {
    JUST_CREATED = "Just Created", // New status
    AUTHOR_OUTREACH_PENDING = "Author Outreach Pending",
    AUTHOR_CONTACT_INITIATED = "Author Contact Initiated",
    ROADMAP_DEFINITION = "Roadmap Definition",
    IMPLEMENTATION_ACTIVE = "Implementation Active",
    IMPLEMENTATION_PAUSED = "Implementation Paused",
    REVIEW_READY = "Review Ready",
    COMPLETED = "Completed",
    ABANDONED = "Abandoned",
}

export interface ContactLog {
    dateInitiated?: string | null; // datetime
    method?: string | null;
    recipient?: string | null;
    responseDeadline?: string | null; // datetime
}

export interface AuthorResponse {
    dateReceived?: string | null; // datetime
    summary?: string | null;
    canProceed?: boolean | null;
}

export interface EmailGuide {
    subject: string;
    body: string;
    notes: string;
}

export interface AuthorOutreach {
    status: AuthorOutreachStatusTs;
    firstContact: ContactLog;
    authorResponse: AuthorResponse;
    emailGuidance: EmailGuide;
}

export interface ImplementationComponent { // Renamed from Component to avoid React conflicts
    id: string; // PyObjectId
    name: string; // From _MongoModel
    description?: string | null;
    category: ComponentCategoryTs;
    status: ComponentStatusTs;
    steps: string[];
    notes?: string | null;
    order: number;
    createdAt: string; // datetime from _MongoModel
    updatedAt: string; // datetime from _MongoModel
}

export interface ImplementationSection { // Renamed from Section
    id: string; // PyObjectId
    name: string; // From _MongoModel
    title: string;
    description?: string | null;
    order: number;
    isDefault: boolean;
    components: ImplementationComponent[];
    createdAt: string; // datetime from _MongoModel
    updatedAt: string; // datetime from _MongoModel
}

export interface ImplementationRoadmap {
    repositoryUrl?: string | null; // AnyUrl
    overallProgress: number;
    sections: ImplementationSection[];
}

export interface ImplementationProgress {
    id: string; // PyObjectId
    paperId: string; // PyObjectId
    status: OverallProgressStatusTs;
    initiatedBy: string; // PyObjectId
    contributors: string[]; // List[PyObjectId]
    authorOutreach: AuthorOutreach;
    implementationRoadmap: ImplementationRoadmap;
    createdAt: string; // datetime
    updatedAt: string; // datetime
}

// --- END NEW TYPES FOR IMPLEMENTATION PROGRESS ---


export interface Paper {
    // Fields from schemas_papers.py::PaperResponse (and BasePaper, camelCased)
    id: string;
    pwcUrl?: string | null; // from pwc_url
    arxivId?: string | null; // from arxiv_id
    title?: string | null; // from title (was string)
    abstract?: string | null; // from abstract
    authors: string[] | null; // from authors
    urlAbs?: string | null; // from url_abs
    urlPdf?: string | null; // from url_pdf
    publicationDate?: string | null; // from publication_date (aliased to publicationDate in backend)
    proceeding?: string | null; // from venue (aliased to proceeding in backend)
    tasks?: string[] | null; // from tags (aliased to tasks in backend)
    upvoteCount: number; // from upvote_count (was optional)
    status: Status; // Use the new Status type
    currentUserImplementabilityVote?: 'up' | 'down' | 'none'; // from current_user_implementability_vote
    currentUserVote?: 'up' | 'none'; // from current_user_vote
    nonImplementableVotes: number; // from not_implementable_votes (was optional)
    isImplementableVotes: number; // from implementable_votes (was optional)
    implementabilityStatus: 'Voting' | 'Community Not Implementable' | 'Community Implementable' | 'Admin Not Implementable' | 'Admin Implementable'; // DO NOT CHANGE

    implementationProgress?: ImplementationProgress; // ADDED
}

// Define the specific actions for implementability voting (matching backend)
export type ImplementabilityAction = 'confirm' | 'dispute' | 'retract';

export type AdminSettableImplementabilityStatus = 'Admin Implementable' | 'Admin Not Implementable' | 'Voting';

export interface PaperSummary {
    id: string;
    pwcUrl?: string | null;
    title: string;
    authors: Author[]; // Kept as Author[] for summaries
    date: string;
    status: Status; // Use the new Status type
    isImplementable: boolean;
}

