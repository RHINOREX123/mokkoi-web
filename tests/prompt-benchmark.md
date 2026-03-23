# Mokkoi Prompt Quality Benchmark

Run each prompt through Mokkoi and rate the output 1-5 on: color palette match, content richness, layout variety, icon usage, image presence.

## Test Prompts (25 total across categories)

### Fitness (3)
1. "Create a fitness dashboard with calories, steps, heart rate"
2. "Peloton workout tracking screen with today's classes"
3. "Running tracker with map, pace, distance stats"

### Finance (3)
4. "Banking app home with balance, accounts, recent transactions"
5. "CRED-style credit card payment screen"
6. "Crypto portfolio with Bitcoin, Ethereum, total value chart"

### Food (2)
7. "Food delivery home screen with restaurant listings and categories"
8. "Restaurant menu screen with food photos and prices"

### Social (2)
9. "Instagram-style profile with posts grid, followers, bio"
10. "Chat inbox with conversation list and unread badges"

### E-commerce (2)
11. "Nike sneaker product page with photos, sizes, price, add to cart"
12. "Shopping cart with items, quantities, total, checkout button"

### Travel (2)
13. "Hotel booking detail page with photos, price, amenities, book button"
14. "Flight search results with airline, times, prices"

### Music (2)
15. "Spotify-style now playing screen with album art, controls, progress"
16. "Music library with playlists, recently played, recommendations"

### Streaming (1)
17. "Netflix-style home with hero banner, continue watching, trending"

### Education (1)
18. "Duolingo-style lesson screen with progress, streak, XP"

### Dating (1)
19. "Dating app profile card with photo, name, age, bio, like/dislike buttons"

### Wellness (1)
20. "Meditation app home with daily streak, recommended sessions, timer"

### Productivity (1)
21. "Task manager with today's tasks, categories, progress bar"

### Weather (1)
22. "Weather app with current conditions, hourly forecast, 5-day forecast"

### Ride-hailing (1)
23. "Uber-style ride booking with map, pickup/destination, car options"

### Vague prompts (2)
24. "Zillow"
25. "Spotify"

## Scoring Criteria (1-5 each)

- **Colors**: Does it use the right category palette? (not default purple)
- **Content**: Is it rich with realistic data? (not sparse/empty)
- **Layout**: Does it use varied layout patterns? (not just vertical stack)
- **Icons**: Does it use Icon components? (not emoji or broken letters)
- **Images**: Does it include searchQuery images or DiceBear avatars where appropriate?
- **SVG**: Does it use SVG progress rings/charts where relevant? (dashboards, fitness)

## Results

| # | Prompt | Colors | Content | Layout | Icons | Images | SVG | Total |
|---|--------|--------|---------|--------|-------|--------|-----|-------|
| 1 | | /5 | /5 | /5 | /5 | /5 | /5 | /30 |
| 2 | | /5 | /5 | /5 | /5 | /5 | /5 | /30 |
| ... | | | | | | | | |

Target: Average score ≥ 22/30 across all prompts.
