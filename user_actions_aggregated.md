# Definitive List of Logged User Actions

This document provides a definitive, validated list of all action types currently being logged to the `user_actions` collection in the backend.

## Currently Logged Actions
- `upvote`
- `profile_updated`
- `Project Started`
- `Project Joined`
- `Community Implementable`
- `Community Not Implementable`
- `Admin Implementable`
- `Admin Not Implementable`
- `Voting`

---

## Future Actions to Implement

This section lists actions that are defined in the original schema but are **not currently logged**. They can be implemented in the future to provide more detailed user analytics.

- `paper_viewed`
- `paper_downvoted`
- `paper_vote_removed`
- `paper_implementation_started`
- `implementation_progress_viewed`
- `implementation_email_sent`
- `implementation_email_response`
- `implementation_github_added`
- `implementation_github_updated`
- `user_login`
- `user_registered`
- `search_performed`
- `filter_applied`
- `dashboard_viewed`
- `stats_viewed`

---

**Note:**
- The `actionType` field in the database stores the string values listed under "Currently Logged Actions".
- This document should be updated whenever a new action is logged.
