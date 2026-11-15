# 23. Showing the user's name and fixing the trend window

## What changed

The app now keeps the user's full name and shows it. A round badge with the initials and the name sits at the right of the top bar. Pressing it opens a small form to add or change the name. The Dashboard greets the person by first name once a name is saved.

The name is stored by the backend in a new table, user_profile, with one row per user id. There is no login yet, so the id is the same placeholder user id the transactions already use. The endpoints are GET and PUT on /api/profile. The name is trimmed, repeated spaces are collapsed, a blank name is rejected, and the limit is 80 characters.

## The chart that was flat

The two trend charts on the Dashboard always looked at the six months ending today. A person whose statements were older than that saw a flat line, with movement only in the last month or two. The charts now look back twelve months and then drop the empty months before the first month that has data, so the chart starts where the person's history starts. When the months span two years the labels carry the year, for example "Dec 25".

## How it was checked

Backend tests cover reading, saving, tidying and rejecting a name. Frontend tests cover the initials, the first name, the greeting, the add name prompt and the trimming of empty months. The page was also opened in a browser to check the layout. The privacy line in the top bar now hides on screens narrower than 1500 pixels so the name has room.

## Limits

History older than twelve months is not charted. Without login, the name belongs to the one placeholder user, so everyone who opens the same installation sees the same name.
