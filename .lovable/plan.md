

## Plan: Delete All Ashton's Trips

**User**: Ashton Lightfoot (ashtonlaurenn@gmail.com, ID: `b7868fe8-36f5-48ce-81e1-758fa79aafde`)

**Action**: Permanently delete all 33+ trips and associated data from the following tables (in dependency order):

1. `trip_photos` — photos linked to her trips
2. `trip_notes` — trip notes
3. `trip_learnings` — trip learnings
4. `trip_go_back_list` — go-back-list items
5. `trip_feedback_responses` — feedback responses
6. `trip_departure_summaries` — departure summaries
7. `trip_day_summaries` — day summaries
8. `trip_rental_cars` — rental cars
9. `trip_notifications` — notifications
10. `trip_payments` — payments
11. `trip_collaborators` — collaborators
12. `trip_members` — trip members
13. `trip_activities` — all activities
14. `trip_hotels` — hotel bookings
15. `trip_flights` — flight bookings
16. `trips` — the trip records themselves

All deletions will be filtered by `user_id = 'b7868fe8-36f5-48ce-81e1-758fa79aafde'`.

**Technical approach**: Use the database insert tool to run DELETE statements against each table in order, clearing child records before the parent `trips` table.

