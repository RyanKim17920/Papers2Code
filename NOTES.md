# Agent Notes

A place for the agent to keep short-term notes, observations, and approaches to problems.

## 2025-10-21 - Progress Tracking System Enhancement

-   **Task**: Implement three-path progress tracking system for paper implementation
-   **Observation**: The current system had a single linear path. Requirements specify three distinct paths:
    1. Official Code Posted (direct from authors)
    2. Refactoring Path (authors provide code that needs work)
    3. Community Implementation (authors refuse/don't respond)
    
-   **Approach**: 
    - Added new ProgressStatus enum values: REFACTORING_STARTED, REFACTORING_FINISHED, VALIDATION_IN_PROGRESS, OFFICIAL_CODE_POSTED, GITHUB_CREATED, CODE_STARTED
    - Updated HorizontalTimeline component to dynamically show the correct path based on current status
    - Added UI controls in ImplementationProgressDialog for progressing through each path
    - Added GitHub repo requirement validation before code/refactoring can start
    - Timeline now shows ideal future steps (community path by default)
    
-   **Testing**: 
    - All Pydantic schemas validated successfully
    - TypeScript compilation passes
    - Python formatting (black) applied
    
-   **User Question - GitHub as Backend for Validation**: 
    The user asked: "What if we had a GitHub repo where it's like the confirmed working code, and then if someone wants to add to it, they have to do a pull request, but the pull request needs to be validated by someone who didn't work on it, right? So what if we treat GitHub as a backend for this cases lol or would it be better to just implement it out like normal than doing this funny thing?"
    
    **My Response**: This is actually a really good idea! Here's my analysis:
    
    **Why it's a good idea:**
    1. **Leverages existing infrastructure**: GitHub already has robust PR review, approval, and merge workflows
    2. **Natural for developers**: Anyone contributing code is likely familiar with PRs
    3. **Built-in features**: Comments, suggested changes, CI/CD integration, required reviewers
    4. **Transparency**: All code review history is preserved
    5. **No reinventing the wheel**: You don't have to build a code review system from scratch
    
    **Implementation approach if you go this route:**
    1. Use GitHub API to monitor PR status
    2. Map PR events to your progress statuses:
       - PR opened → Code Started / Refactoring Started
       - Review requested → Validation In Progress
       - PR approved by non-contributor → Mark as validated
       - PR merged → Official Code Posted
    3. Use GitHub webhooks to automatically update your backend when PR status changes
    4. Store the PR URL in the progress details for reference
    
    **Challenges to consider:**
    1. Need GitHub OAuth integration for the app
    2. Requires users to have GitHub accounts
    3. Depends on external service (GitHub downtime affects your app)
    4. Need to handle permissions carefully (who can approve PRs?)
    
    **My recommendation**: 
    - For MVP, keep the current manual status updates (what I implemented)
    - As a Phase 2 enhancement, add GitHub integration as an OPTIONAL workflow
    - This gives flexibility: technical users can use GitHub workflow, non-technical users can use manual status updates
    - You could even have a "Connect to GitHub PR" button that auto-syncs status when available
    
    It's not a "funny thing" at all - it's actually a smart architectural decision to use existing, battle-tested infrastructure rather than building everything custom. Many successful apps do this (e.g., Netlify uses GitHub for deployment triggers, Vercel integrates with GitHub for previews, etc.).
