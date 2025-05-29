// src/types/paper.ts (Review and adjust if needed)
export type Status = 'Not Implementable' | 'Not Started' | 'Started' | 'Waiting for Author Response' | 'Work in Progress' | 'Completed' | 'Official Code Posted';

// New type for the status of an implementation step
export type ProgressStatus = 'Not Started' | 'Started' | 'Work in Progress' | 'Completed';

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
    status: ProgressStatus; // Use the new ProgressStatus type
    github_url: string | null;
    created_at: string;
    updated_at: string;
}

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

