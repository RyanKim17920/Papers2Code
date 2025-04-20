// src/types/paper.ts (Review and adjust if needed)

export interface Author {
  name: string; // Backend now sends this structure
}

export enum ImplementationStatus {
    // Make sure these string values match the 'status' field in MongoDB
    // or the defaults provided in transform_paper
    NotStarted = 'Not Started',
    ContactingAuthor = 'Contacting Author',
    DefiningRequirements = 'Defining Requirements',
    ImplementationInProgress = 'Implementation In Progress',
    AnnotatingCode = 'Annotating Code',
    Completed = 'Completed',
    AuthorDeclined = 'Author Declined (Proceeding)',
    AwaitingReview = 'Awaiting Review',
    // Add any other statuses present in your DB data
    NeedsCode = 'Needs Code', // From your example
}

export interface ImplementationStep {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
}

export interface Paper {
  id: string; // MongoDB ObjectId as string
  pwcUrl?: string; // PapersWithCode URL
  arxivId?: string; // arXiv ID (e.g., '2310.12345')
  title: string;
  abstract: string;
  authors: Author[];
  urlAbs?: string; // URL to abstract page (e.g., arXiv page)
  urlPdf?: string; // URL to PDF
  date: string; // Publication date (YYYY-MM-DD)
  proceeding?: string; // Conference or journal name
  tasks?: string[]; // Associated ML tasks
  isImplementable: boolean; // Flag set by owner
  implementationStatus: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  implementationSteps: ImplementationStep[];
  upvoteCount: number; // Add upvote count
  currentUserVote: 'up' | 'none'; // Add current user's vote status ('down' can be added later)
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