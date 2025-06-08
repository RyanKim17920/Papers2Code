import type { UserBasic } from './user';

export enum StepProgressStatus {
    NOT_STARTED = 'Not Started',
    STARTED = 'Started',
    WORK_IN_PROGRESS = 'Work in Progress',
    COMPLETED = 'Completed',
}

export interface StepComment {
    id: string;
    user: UserBasic;
    text: string;
    createdAt: string;
    updatedAt?: string;
}

export interface ImplementationStep {
    id: string;
    order: number;
    name: string;
    description: string | null;
    status: StepProgressStatus;
    github_url: string | null;
    created_at: string;
    updated_at: string;
    comments?: StepComment[];
}

export enum AuthorOutreachStatusTs {
    NOT_INITIATED = 'Not Initiated',
    CONTACT_SENT = 'Contact Initiated - Awaiting Response',
    RESPONSE_APPROVED = 'Response Received - Approved Proceeding',
    RESPONSE_DECLINED = 'Response Received - Declined Proceeding',
    RESPONSE_OWN_CODE = 'Response Received - Provided Own Code',
    NO_RESPONSE = 'No Response - Grace Period Ended',
}

export enum ComponentCategoryTs {
    CORE = 'core',
    ADDON = 'addon',
}

export enum ComponentStatusTs {
    TO_DO = 'To Do',
    IN_PROGRESS = 'In Progress',
    COMPLETED = 'Completed',
    BLOCKED = 'Blocked',
    SKIPPED = 'Skipped',
}

export enum OverallProgressStatusTs {
    JUST_CREATED = 'Just Created',
    AUTHOR_OUTREACH_PENDING = 'Author Outreach Pending',
    AUTHOR_CONTACT_INITIATED = 'Author Contact Initiated',
    ROADMAP_DEFINITION = 'Roadmap Definition',
    IMPLEMENTATION_ACTIVE = 'Implementation Active',
    IMPLEMENTATION_PAUSED = 'Implementation Paused',
    REVIEW_READY = 'Review Ready',
    COMPLETED = 'Completed',
    ABANDONED = 'Abandoned',
}

export interface ContactLog {
    dateInitiated?: string | null;
    method?: string | null;
    recipient?: string | null;
    responseDeadline?: string | null;
}

export interface AuthorResponse {
    dateReceived?: string | null;
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

export interface ImplementationComponent {
    id: string;
    name: string;
    description?: string | null;
    category: ComponentCategoryTs;
    status: ComponentStatusTs;
    steps: string[];
    notes?: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export interface ImplementationSection {
    id: string;
    name: string;
    title: string;
    description?: string | null;
    order: number;
    isDefault: boolean;
    components: ImplementationComponent[];
    createdAt: string;
    updatedAt: string;
}

export interface ImplementationRoadmap {
    repositoryUrl?: string | null;
    overallProgress: number;
    sections: ImplementationSection[];
}

export interface ImplementationProgress {
    id: string;
    paperId: string;
    status: OverallProgressStatusTs;
    initiatedBy: string;
    contributors: string[];
    authorOutreach: AuthorOutreach;
    implementationRoadmap: ImplementationRoadmap;
    createdAt: string;
    updatedAt: string;
}
