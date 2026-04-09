export interface AppTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: string
  screenCount: number
  accentColor: string
  prompt: string
}

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'fitness',
    name: 'Fitness Tracker',
    description: 'Workout stats, exercise library, progress charts, and profile',
    icon: '💪',
    category: 'Health',
    screenCount: 5,
    accentColor: '#22C55E',
    prompt: 'Build me a fitness tracking app with 5 screens: a Home dashboard showing today\'s workout stats (calories, steps, heart rate) with quick action buttons and a motivational streak counter, a Workouts screen with exercise categories (Strength, Cardio, Yoga, HIIT) as cards with images, a Workout Detail screen showing exercise list with sets/reps/timer, a Progress screen with weekly charts and body measurement stats, and a Profile screen with avatar, fitness goals, achievement badges, and settings link. Use a green accent color and dark theme.',
  },
  {
    id: 'food-delivery',
    name: 'Food Delivery',
    description: 'Restaurants, menus, cart, and live order tracking',
    icon: '🍔',
    category: 'Lifestyle',
    screenCount: 5,
    accentColor: '#F97316',
    prompt: 'Build me a food delivery app with 5 screens: a Home screen with search bar, cuisine category chips (Pizza, Sushi, Burgers, Thai), featured restaurant promo banner, and nearby restaurant cards with ratings and delivery time, a Restaurant Detail screen with header image, menu categories, food items with prices and add-to-cart buttons, a Cart screen with ordered items, quantity controls, price breakdown (subtotal, delivery, total), and checkout button, an Order Tracking screen with order status steps (Confirmed, Preparing, On the way, Delivered) and a map placeholder showing delivery progress, and a Profile screen with addresses, payment methods, and order history. Use an orange accent color and dark theme.',
  },
  {
    id: 'social-media',
    name: 'Social Media',
    description: 'Feed, profile, messages, and notifications',
    icon: '📱',
    category: 'Social',
    screenCount: 5,
    accentColor: '#8B5CF6',
    prompt: 'Build me a social media app with 5 screens: a Feed screen with stories row at top (circular avatars), post cards with user avatar, image placeholder, like/comment/share buttons, and caption text, a Profile screen with cover photo area, profile avatar, follower/following/posts stats, bio text, and a photo grid, a Messages screen with search bar and conversation list showing avatars, names, last message preview, and time stamps, a Notifications screen with grouped notifications (likes, comments, follows, mentions) with icons and timestamps, and a Search/Explore screen with search bar, trending topics, and a grid of popular posts. Use a purple accent color and dark theme.',
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Product grid, details, cart, and checkout',
    icon: '🛍️',
    category: 'Shopping',
    screenCount: 5,
    accentColor: '#EC4899',
    prompt: 'Build me an e-commerce shopping app with 5 screens: a Home screen with search bar, category chips, flash sale banner, and product cards in a 2-column grid showing image, name, price, and star rating, a Product Detail screen with image carousel, product title, price, star rating with review count, color selector circles, size selector chips, description text, and Add to Cart button, a Cart screen with cart items (image, name, size, color, quantity controls, price), price breakdown, and Checkout button, a Checkout screen with shipping address card, payment method card, order summary, and Place Order button, and a Profile screen with order history, wishlist, addresses, and settings. Use a pink accent color and dark theme.',
  },
  {
    id: 'banking',
    name: 'Banking & Finance',
    description: 'Balance, transactions, transfers, and card management',
    icon: '🏦',
    category: 'Finance',
    screenCount: 5,
    accentColor: '#3B82F6',
    prompt: 'Build me a banking app with 5 screens: a Home dashboard showing total balance as hero number, a horizontal scroll of bank cards, quick action buttons (Send, Request, Pay, Top Up), and recent transactions list with merchant icons and amounts, a Transactions screen with search, filter tabs (All, Income, Expenses), and a full transaction list with dates and categories, a Transfer screen with recipient selector, amount input with currency, note field, and Send Money button, a Cards screen showing virtual card display with card number dots, CVV, expiry, and options to freeze/block/set limits, and a Profile screen with personal info, security settings (biometrics toggle, change PIN), and notification preferences. Use a blue accent color and dark theme.',
  },
  {
    id: 'music',
    name: 'Music Streaming',
    description: 'Player, playlists, search, and library',
    icon: '🎵',
    category: 'Entertainment',
    screenCount: 5,
    accentColor: '#A855F7',
    prompt: 'Build me a music streaming app with 5 screens: a Home screen with greeting, Recently Played horizontal scroll cards, Made For You playlist suggestions, and trending charts section, a Search screen with search bar, genre category grid (Pop, Rock, Hip-Hop, Jazz, Electronic, Classical) with colored cards, and recent searches, a Now Playing screen with large album art, song title, artist name, progress bar with timestamps, playback controls (shuffle, previous, play/pause, next, repeat), volume slider, and like button, a Library screen with tabs (Playlists, Albums, Artists, Downloads) and a list of saved items with thumbnails, and a Profile screen with listening stats, recently played artists, and settings. Use a purple accent color and dark theme.',
  },
]
