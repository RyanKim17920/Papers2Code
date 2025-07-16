# To-Do List

This list will be used to track the project's progress.

## Pre-Production Steps

 - [ ] Fix paper_views to actually increment when a user views a paper. This is crucial for analytics and user engagement tracking.

### Frontend (`papers2code-ui`)
- [x] Fix active contributions not showing up on the user's profile page. ✅ **COMPLETED** - Fixed backend user service to properly identify contributed papers from both implementation progress records AND user actions (Project Started/Project Joined).
- [ ] Implement the main dashboard to display popular repositories and the user's repositories. WIP --> need better design, some glitches to finish

### Backend (`papers2code_app2`) & Scripts
- [ ] **Database & Scripts:**
    - [ ] Review and fix the database update scripts (e.g., `scripts/update_pwc_data.py`) to be more up to date and more efficient.
    - [x] Fix copy_prod_data_to_test.py to be also more up-to-date and relevant. ✅ **COMPLETED** - Enhanced script with better error handling, related data copying, database summaries, and configurable options.
    - [x] Fix recurring cron jobs (e.g., `api/cron/email-updater.py`, popular-papers.py ). These need extensive testing ✅ **COMPLETED** - Created comprehensive cron job system with optimized email-updater, view analytics, popular-papers analytics using sliding window/incremental approaches. Removed redundant user_recent_views collection. All tests passing with cleanup scripts.
- [ ] **Improving Profile:**
    - [ ] Make the profile call for data as necessary, not at the start to reduce loading time significantly (depending on the tab instead of loading it all in at the first reload), and create a navigation similar to the paperlist if upvotes/contributions are large
    - [ ] Show successful contributions and be able to better organize it as necessary
- [ ] **ML & Data Filtering:**
    - [ ] Train a BERT model on the output of `scripts/LLM_annotator.py` to filter irrelevant papers.
    - [ ] Integrate the trained model to filter new incoming papers.
    - [ ] Define and implement the logic for handling unofficial paper implementations.
- [ ] **Code Organization:**
    - [ ] Review and improve the overall file and code structure across the repository.
- [ ] **Deployment:**
    - [ ] Ensure all code is functional and ready for deployment.
    - [ ] Configure the project for deployment on Render (`render.yaml`).
    - [ ] Deploy the application.

## Post-Production Steps
- [ ] **UI Improvements**
    - [ ] Dark Mode
    - [ ] Add your own ideas! 