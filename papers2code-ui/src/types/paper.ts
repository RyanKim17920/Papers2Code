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
  id: string; // Stringified _id from MongoDB
  pwcUrl?: string | null; // Mark optional if they might be missing
  arxivId?: string | null;
  title: string;
  abstract?: string | null;
  authors: Author[];
  urlAbs?: string | null; // Make sure these match optionality from backend
  urlPdf?: string | null;
  date: string; // Backend sends string 'YYYY-MM-DD'
  proceeding?: string | null; // Mapped from 'venue'
  tasks?: string[] | null;
  isImplementable: boolean;
  implementationStatus: ImplementationStatus | string; // Allow string for flexibility if DB has other statuses
  implementationSteps: ImplementationStep[];
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