


# TODO: check boxes that are done

1. Basic UI FIXES:
* [X] Add border to search bar on top 
* [X] Add some more spacing on top of the cards along with the Search Papers (include a Filter title there too, slightly differing color scheme around filter) 
* [X] Cards should always have the text aligned/same height (papers that have two lines of authors are have the tags, date, etc. lower than other cards which makes spacing uneven)
* [X] Spacing issues are common for a lot of things such as within the papers, spacing above implementability, information above the info, community implementation progress spacing, etc.
* [X] Increase information density of paper pages further
* [ ] Make up to 3 cards in a row when filter is gone
* [ ] Make updates page collapsable or just smaller
    * [ ] Make updates pages a real thing in the backend, very basic information (do not implement right now, however edit the TODO to include ideas on how to incorporate an easy blog-like system to append new information on from the admin side)

* [ ] Improve the 404 Page not found to be styled exquisitely
* [ ] Fix the view Likes popup of everyone that di so that it doesn't come from top left (should pop out from same location)
* [ ] Remove all links to papersWithCode to it
* [X] Make all the hearts into likes, all saved into upvotes, and unify this text throughout everything
* [ ] Have links to website, twitter, linkedin, bluesky, huggingface if they exist in the user profile

2. BASIC BACKEND FIXES:
* [ ] logging out (sign out) goes directly to the papers if logged out from dashboard (in either case), otherwise just go to the page
* [ ] Make the "joined" date in the user profile accurate
* [ ] Make the "last seen" date in the user profile accurate
* [ ] Modify paper views to override any old views by the same userID to the same paper in order to not just spam data (no repeated paperId and userID essentially s)
* [ ] Thumbs up/loving papers in dashboard does not change backend, connect it properly
* [ ] Saved/Thumbs/Loved doesn't display any papers in dashboard (works in profile though, UNIFY if it's upvoted or saved, let's stick with upvoted first) but it does work in user profile
* [ ] In user profile, upvoted papers should already be highlighted for the thumbs up instead of being not filled
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