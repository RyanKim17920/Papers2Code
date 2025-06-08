// src/types/paper.ts (Review and adjust if needed)
export type Status = 'Not Implementable' | 'Not Started' | 'Started' | 'Waiting for Author Response' | 'Work in Progress' | 'Completed' | 'Official Code Posted';

// MODIFIED: Renamed to avoid conflict with overall progress status
// export type StepProgressStatus = 'Not Started' | 'Started' | 'Work in Progress' | 'Completed';
export enum StepProgressStatus {
    NOT_STARTED = 'Not Started',
    STARTED = 'Started',
    WORK_IN_PROGRESS = 'Work in Progress',
    COMPLETED = 'Completed',
}

export interface UserBasic { // Simple user representation for assignment
    id: string; // Assuming user IDs are strings (e.g., MongoDB ObjectIds or UUIDs)
    name: string;
    avatarUrl?: string;
}

export interface StepComment {
    id: string; // Comment ID (e.g., MongoDB ObjectId or UUID)
    user: UserBasic; // User who made the comment
    text: string;
    createdAt: string; // ISO date string
    updatedAt?: string; // ISO date string, if comments can be edited
}

export interface ImplementationStep {
    id: string; // Changed to string to align with typical MongoDB ObjectId usage for IDs
    order: number;
    name: string;
    description: string | null; // Potentially rich text
    status: StepProgressStatus;
    github_url: string | null;
    created_at: string;
    updated_at: string;
    comments?: StepComment[]; // Array of comments for this step
    // Consider adding: dueDate?: string | null;
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
    isImplementable: boolean; // from is_implementable (computed field in backend)

    implementationProgress?: ImplementationProgress; // ADDED
}

// Define the specific actions for implementability voting (matching backend)
export type ImplementabilityAction = 'confirm' | 'dispute' | 'retract';

export type AdminSettableImplementabilityStatus = 'Admin Implementable' | 'Admin Not Implementable' | 'Voting';

export interface PaperSummary {
    id: string;
    pwcUrl?: string | null;
    title: string;
    authors: String[]; // Kept as Author[] for summaries
    date: string;
    status: Status; // Use the new Status type
    isImplementable: boolean;
}

