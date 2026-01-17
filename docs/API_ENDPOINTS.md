# Trip Sharing & Multi-City API Endpoints

## Friend Management
Already implemented in `/api/v1/friends/*`

## Trip Sharing Endpoints

### Add/Remove Travelers
- `POST /api/v1/trips/:tripId/travelers` - Add friends to trip
- `GET /api/v1/trips/:tripId/travelers` - Get trip travelers & group profile
- `DELETE /api/v1/trips/:tripId/travelers/:userId` - Remove traveler
- `PATCH /api/v1/trips/:tripId/travelers/:userId/permissions` - Update permissions

### Activity Management
- `POST /api/v1/activities/save` - Save activity to favorites
- `GET /api/v1/activities/saved` - Get user's saved activities
- `GET /api/v1/trips/:tripId/group-favorites` - Get activities saved by multiple members

### Trip Invitations
- `POST /api/v1/trips/:tripId/accept` - Accept trip invitation
- `GET /api/v1/trips/shared` - Get all shared trips for user

## Multi-City Endpoints

### Option Generation
- `POST /api/v1/trips/:tripId/add-cities` - Generate 3-tier options for adding cities
- `GET /api/v1/trips/:tripId/multi-city-options` - Get saved options

### Option Management
- `POST /api/v1/trips/:tripId/multi-city-options/:optionId/adjust-nights` - Redistribute nights
- `POST /api/v1/trips/:tripId/confirm-multi-city` - Book selected option

### Information
- `GET /api/v1/multi-city/pricing` - Get pricing structure
- `GET /api/v1/multi-city/popular-routes` - Get popular multi-city combinations

## Implementation Notes

### Pending Backend Tasks
1. Create database tables (see `src/db/schema/friend-trip-schema.md`)
2. Implement missing service methods marked with TODO
3. Add Redis caching for multi-city options
4. Implement credit deduction logic
5. Add email notifications for invites

### Frontend Integration
1. Add friend management UI in profile section
2. Create trip sharing controls in trip editor
3. Build multi-city option comparison view
4. Add saved activities section
5. Update trip cards to show shared status

### Security Considerations
- All endpoints require authentication
- Trip ownership verified before modifications
- Friend relationships required for sharing
- Permission levels enforced (view/edit/full)

### Testing
Test the endpoints with:
```bash
# Add friend (existing endpoint)
curl -X POST http://localhost:3001/api/v1/friends/request \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"handle": "friend@email.com"}'

# Add travelers to trip
curl -X POST http://localhost:3001/api/v1/trips/TRIP_ID/travelers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"travelerIds": ["USER_ID"], "permissions": "edit"}'

# Generate multi-city options
curl -X POST http://localhost:3001/api/v1/trips/TRIP_ID/add-cities \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "potentialCities": [
      {"cityId": "1", "cityName": "Barcelona", "countryName": "Spain"},
      {"cityId": "2", "cityName": "Rome", "countryName": "Italy"}
    ]
  }'
```