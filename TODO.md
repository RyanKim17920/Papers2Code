


# TODO: check boxes that are done

1. Basic UI FIXES:
* [X] Add border to search bar on top 
* [X] Add animation when hiding filters in papers --> extend the cards to fill the full width 
* [X] Add some more spacing on top of the cards along with the Search Papers (include a Filter title there too, slightly differing color scheme around filter) 
* [X] Cards should always have the text aligned/same height (papers that have two lines of authors are have the tags, date, etc. lower than other cards which makes spacing uneven)
* [X] Spacing issues are common for a lot of things such as within the papers, spacing above implementability, information above the info, community implementation progress spacing, etc.
* [X] Make up to 3 cards in a row when filter is gone (already implemented - grid shows 1/2/2/3 columns on mobile/sm/lg/xl screens)
* [X] Make updates page collapsable or just smaller (added collapsible functionality to SiteUpdates component)
    * [X] Needs to be collapsable like actually collapsable (updates sidebar fully hides and feed expands to multi-column)
    * [ ] Make updates pages a real thing in the backend, very basic information (do not implement right now, however edit the TODO to include ideas on how to incorporate an easy blog-like system to append new information on from the admin side)
        * **Blog System Ideas for Admin Updates:**
          - Create `/api/admin/updates` endpoint for creating/editing/deleting updates
          - Add rich text editor for update content (markdown support)
          - Include categories/tags for updates (e.g., "Feature", "Bug Fix", "Announcement")
          - Timestamp and author tracking for each update
          - Simple approval workflow for updates before publishing
          - Admin dashboard section for managing updates
          - Support for media attachments (images, links)
          - SEO-friendly slugs for individual update pages
          - RSS feed for updates
          - Email notification system for major updates (Future)
* [X] Increase information density of paper pages further
* [ ] Still needs fixing on space above title in the paper Detail and the Progress
* [ ] If authors is long enough, make it have a ... that can be expanded and re hidden. 
* [ ] Increase information density of the paper page further
* [ ] Clicking on the user profiles in the upvotes should go to their profile
* [X] Improve the 404 Page not found to be styled exquisitely
* [X] 404 Page should occur for any error including 500 errors, etc. (perhaps it should be a seperate title for each so it matches the error and the other information found such as: Error loading paper: Request failed with status code 500 )
* [X] Remove all links to papersWithCode to it
* [X] Make all the hearts into likes, all saved into upvotes, and unify this text throughout everything
* [ ] Have links to website, twitter, linkedin, bluesky, huggingface if they exist in the user profile
* [ ] Timeline visualization
* [ ] Switch My papers and recent in dashboard


2. BASIC BACKEND FIXES:
* [X] logging out (sign out) goes directly to the papers if logged out from dashboard (in either case), otherwise just go to the page
* [X] Make the "joined" date in the user profile accurate
* [X] Make the "last seen" date in the user profile accurate
* [ ?? ] Modify paper views to override any old views by the same userID to the same paper in order to not just spam data (no repeated paperId and userID essentially s) --> It seems that the paper views don't even have the user Id saved to it... neeeds to be fixed.
* [X] Thumbs up/loving papers in dashboard does not change backend, connect it properly
* [X] Saved/Thumbs/Loved doesn't display any papers in dashboard (works in profile though, UNIFY if it's upvoted or saved, let's stick with upvoted first) but it does work in user profile
* [ ] In user profile, upvoted papers should already be highlighted for the thumbs up instead of being not fille
3. FUTURE CHANGES (mixed) [DO NOT IMPLEMENT RIGHT NOW]:
 * [ ] Search works for all cases
 * [ ] Improve tagging and tags
 * [ ] Improve search in general 
 * [ ] more papers in the dashboard for implementation 
 * [ ] for both profile's Updated/Contrbuting and the dashboard cards should be identical, and have ability to go directly to paper link, or github link, along with showing the abstract rather than repeating the title twice
* [ ] Date of publishing for papers in dashbaord not like 6 months ago or somethhing
* [ ] Condense all the various careds into some similar method instead of having so many different ones of the same hting
* [ ] If user has too many contributed to or upvoted have a pagination but vertical on the right side in the white space of the area.
* [ ] integrate settings into profile as a tab or something, at least improve that UI significantly
* [ ] implementaiton tracking becomes a timeline not just random information texted 
* [ ] works for MOBILE
* [ ] everything to tailwind
