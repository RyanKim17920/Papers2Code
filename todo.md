# Papers2Code Project To-Do List

## Phase 1: Core Functionality & User Experience Enhancements

### 1.1. Code Recreation & Progress Tracking for Papers Without Code
    - **Goal:** Facilitate and track the community progress to recreate code for academic papers that do not have publicly available implementations. This includes an initial step of contacting the original authors, a structured progress tracker for the implementation progress, and a peer-review system for verified code.
    - **Tasks:**
        - [ ] **Paper Identification & Author Outreach:**
            - [X] Mechanism for users to identify and submit papers that lack open-source code.
            - [~] **System to guide/facilitate users in emailing the first author:** (e.g., providing email guidance, tracking if contact was made and any response, or if the author was unresponsive). *Part of new Implementation Progress feature.*
                - [X] Backend: Data model for `authorOutreach` within `implementation_progresss` finalized (includes `firstContact`, `authorResponse`, `emailGuidance`).
                - [ ] UI: Present email guidance, allow user to confirm contact initiation, log response.
            - [X] Display status: "Author Contact Pending," "Author Contacted - Awaiting Response," "Author Approved Open Sourcing" (link to their code), "Author Declined/No Response - Open for Community Implementation." *(This will now be managed via `implementation_progresss.status` and `implementation_progresss.authorOutreach.status`).*
        - [~] **Implementation Progress Tracker (for community progresss):**
            - [~] **Allow users to initiate or join a code recreation progress for a specific paper.**
                - [ ] UI: "Start/Join Implementation Progress" button on Paper Detail page.
                - [ ] Backend: Endpoints to create progress and add contributors.
            - [~] **Users can collaboratively define and track progress on distinct code components/stages.**
                - [X] **Backend: Define data model for `implementation_progresss` collection.**
                    - Finalized schema includes `paperId`, overall `status`, `initiatedBy`, `contributors`, `authorOutreach` object, and `implementationRoadmap` object.
                    - `implementationRoadmap` contains `repositoryUrl`, `overallProgress`, and `sections` array.
                    - Each `section` has `title`, `description`, `order`, `isDefault`, and a `components` array.
                    - Each `component` has `name`, `description`, `status`, `assignedTo`, `notes`, and `order`.
                - [ ] Provide suggestions for components in "Core Functionalities" section by default.
                - [ ] Allow users to add custom sections and components.
            - [ ] Status for each component: "To Do," "In Progress," "Completed," "Blocked/Stuck (with notes)," "Skipped (with reason)."
            - [ ] Visual progress bar or checklist for overall implementation. *(Future UI enhancement)*
            - [ ] A section for notes, discussions, or challenges encountered during implementation. *(Future enhancement within `implementation_progresss.implementationRoadmap.sections.components.notes` or a dedicated discussion feature later)*
        - [ ] **Code Submission & Peer Review:**
            - [ ] Allow users to submit their recreated code (e.g., link to a dedicated GitHub repository for the community implementation).
            - [ ] System for users to flag their implementation as "Ready for Peer Review."
            - [ ] Peer review workflow:
                - Other registered and qualified users can volunteer or be assigned to review.
                - Reviewers assess if the code faithfully implements the paper's described methods and ideally can reproduce key results/figures.
                - Reviewers can provide feedback, request changes, or approve ("checkmark") the implementation.
            - [ ] Display status: "Implementation in Progress," "Submitted for Peer Review," "Peer Review Ongoing," "Peer Reviewed & Verified," "Revisions Requested by Reviewers."
        - [~] **Backend & UI Development:**
            - [~] **Develop backend logic to store and manage all aspects:** paper status, **author communication logs (within `implementation_progresss.authorOutreach`)**, **implementation components and their statuses (within `implementation_progresss.implementationRoadmap`)**, peer review assignments and feedback.
                - [X] Define MongoDB collection: `implementation_progresss` (schema finalized).
                - [ ] Create Pydantic schemas for new models.
                - [ ] Develop FastAPI services and routers for `implementation_progresss`.
            - [~] **Create intuitive UI elements for users to navigate this entire workflow:** submitting papers, **initiating/contributing to implementations, guiding author outreach, tracking progress,** and participating in peer reviews.
                - [ ] New "Implementation" tab/section on Paper Detail page.

### 1.2. Enhanced User Account Management & Dashboard
    - **Goal:** Improve user engagement and provide a centralized place for users to manage their information and contributions.
    - **Tasks:**
        - [ ] **User Dashboard:**
            - [ ] Display when a user is signed in.
            - [ ] Show user's submitted papers/code implementations.
            - [ ] Track status of their submissions (e.g., pending review, approved).
            - [ ] Potentially show statistics (e.g., views on their linked papers).
        - [ ] **Navigation/User Menu:**
            - [ ] Replace simple "Logout" with a dropdown menu.
            - [ ] Dropdown to include:
                - User Profile/Information (avatar, name).
                - Link to Dashboard.
                - User Settings (e.g., email preferences, if applicable).
                - Logout.
        - [ ] **User Profile Page:** (Consider if distinct from dashboard or a section within it)
            - [ ] Allow users to view/edit basic profile information.

### 1.3. Improved Homepage
    - **Goal:** Clearly communicate the purpose of Papers2Code and provide relevant entry points for users.
    - **Tasks:**
        - [ ] **Logged-out View:**
            - [ ] Design a compelling homepage that explains the platform's value proposition.
            - [ ] Include calls to action (e.g., "Browse Papers," "Submit Your Code," "Sign Up/Login").
        - [ ] **Logged-in View:**
            - [ ] Redirect to the User Dashboard (as per existing todo).

## Phase 2: Pre-Production & Infrastructure

### 2.1. Backend Strategy & Standardization
    - **Goal:** Ensure a stable, maintainable, and scalable backend.
    - **Tasks:**
        - [ ] **Clarify Backend Architecture:**
            - [ ] Define the roles of `papers2code_app` (Flask) and `papers2code_app2` (FastAPI).
            - [ ] If migrating, create a plan to complete the migration to FastAPI and deprecate the Flask app.
            - [ ] If microservices, document their interaction and ensure `API_BASE_URL` in `auth.ts` correctly points to the intended service or gateway.
        - [ ] **API Consistency:**
            - [ ] Complete the standardization of API request/response formats (e.g., snake_case vs. camelCase) across all endpoints.

### 2.2. Database Setup
    - **Goal:** Establish separate environments for development, testing, and production.
    - **Tasks:**
        - [ ] Set up distinct Development, Staging/Testing, and Production databases.
        - [ ] Implement scripts or processes for schema migrations.
        - [ ] Ensure `copy_prod_data_to_test.py` (or similar) is robust for creating realistic test environments.

### 2.3. Testing & CI/CD
    - **Goal:** Improve code quality and automate deployment processes.
    - **Tasks:**
        - [ ] **Expand Test Coverage:**
            - [ ] Write more unit tests for frontend (React/TypeScript) and backend (Python) components.
            - [ ] Implement integration tests for API endpoints and key user flows.
            - [ ] Consider end-to-end tests for critical paths.
        - [ ] **Setup CI/CD Pipeline:**
            - [ ] Automate running tests on commits/pull requests.
            - [ ] Automate deployment to staging and production environments.

### 2.4. Security Review
    - **Goal:** Ensure the platform is secure.
    - **Tasks:**
        - [ ] **Authentication & Authorization:** Thoroughly review all auth logic.
        - [ ] **CSRF Protection:** Verify robust CSRF token handling across all relevant backend endpoints.
        - [ ] **Input Validation:** Ensure all user inputs are validated on both frontend and backend.
        - [ ] **Dependency Audit:** Regularly check for vulnerabilities in third-party libraries.

## Phase 3: Post-Production & Feature Expansion

### 3.1. Search & Discovery Improvements
    - **Goal:** Make it easier for users to find relevant papers and code.
    - **Tasks:**
        - [ ] **Advanced Search Capabilities:**
            - [ ] Filter by keywords, authors, publication date, conference/journal.
            - [ ] Filter by code implementation details (e.g., language, framework, availability of pre-trained models).
        - [ ] **Ordering/Sorting:**
            - [ ] Add citation count (requires integrating with a citation data source like Semantic Scholar, OpenAlex, or CrossRef).
            - [ ] Allow sorting by citation count, relevance, date added, etc.
        - [ ] **Grouping/Categorization:**
            - [ ] Group papers by research areas, tasks, or other relevant types (e.g., "Computer Vision," "NLP," "Object Detection").

### 3.2. Content Enrichment & Automation
    - **Goal:** Enhance the quality and quantity of data, and reduce manual progress.
    - **Tasks:**
        - [ ] **Automated Data Ingestion:**
            - [ ] Further automate and refine scripts like `process_pwc_data.py` and `update_pwc_data.py`.
            - [ ] Explore integrating with more data sources (e.g., arXiv API, other code repositories).
        - [ ] **LLM-Powered Filtering/Tagging (Experimental):**
            - [ ] Investigate using LLMs to automatically categorize papers or suggest tags.
            - [ ] Use LLMs to help filter or summarize paper content to reduce the "count" (perhaps referring to the number of papers a user needs to sift through). *Needs careful validation.*

### 3.3. Community & Moderation Features
    - **Goal:** Foster a community and ensure data quality.
    - **Tasks:**
        - [ ] **User Comments/Discussions:** Consider allowing comments on paper/code pages.
        - [ ] **Rating System:** Allow users to rate the quality/completeness of linked code.
        - [ ] **Enhanced Moderation Tools:** Improve tools for admins/moderators to manage submissions, flags, and user reports.

## Ongoing Tasks
    - [ ] **Documentation:**
        - [ ] Maintain and update API documentation.
        - [ ] Keep architectural documentation current.
        - [ ] Ensure `README.md` files are comprehensive for setup and contribution.
    - [ ] **Dependency Management:** Regularly update frontend and backend dependencies.
    - [ ] **Performance Monitoring & Optimization:** Continuously monitor and improve application performance.
