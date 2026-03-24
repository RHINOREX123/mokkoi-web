export const listTemplatesTool = {
  name: 'list_templates',
  description:
    'List available screen templates and categories. Use these as inspiration or starting points for screen generation.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description:
          'Filter by category (fitness, ecommerce, social, finance, productivity, onboarding, settings, profile, dashboard, auth)',
      },
    },
    required: [],
  },
};

interface Template {
  name: string;
  category: string;
  description: string;
  previewPrompt: string;
}

const TEMPLATES: Template[] = [
  // Fitness
  {
    name: 'Fitness Dashboard',
    category: 'fitness',
    description: 'Workout stats dashboard with progress rings, step counter, and daily goals',
    previewPrompt: 'fitness dashboard with circular progress rings for steps calories and distance, daily workout summary, and quick-start workout button',
  },
  {
    name: 'Workout Tracker',
    category: 'fitness',
    description: 'Active workout tracking screen with timer, exercise list, and sets',
    previewPrompt: 'workout tracker screen with exercise timer, current exercise name, sets and reps counter, rest timer, and next exercise preview',
  },
  {
    name: 'Activity Feed',
    category: 'fitness',
    description: 'Social fitness feed with workout completions and achievements',
    previewPrompt: 'fitness social feed showing friends workout completions with avatars, workout type icons, duration, and like/comment buttons',
  },

  // E-commerce
  {
    name: 'Product Listing',
    category: 'ecommerce',
    description: 'Product grid with images, prices, and add-to-cart buttons',
    previewPrompt: 'ecommerce product listing grid with product images, names, prices, star ratings, and add to cart buttons with a search bar and filter chips at top',
  },
  {
    name: 'Product Detail',
    category: 'ecommerce',
    description: 'Scrollable PDP with image carousel, title/price/rating, color selector, size grid, features list, description, shipping info, and sticky CTA',
    previewPrompt: 'scrollable product detail page with hero image carousel with dot pagination, product title and brand label, price with star rating and review count, color selector row with circular swatches, size grid with selectable chips, product features list with 3-4 items each having icon and label in styled cards, short description paragraph, shipping and returns info with icons, and sticky bottom bar with favorite button and add to cart CTA',
  },
  {
    name: 'Shopping Cart',
    category: 'ecommerce',
    description: 'Cart with item list, quantities, subtotal, and checkout button',
    previewPrompt: 'shopping cart screen with list of cart items showing image name price and quantity controls, subtotal, shipping estimate, promo code input, and checkout button',
  },

  // Social
  {
    name: 'Social Feed',
    category: 'social',
    description: 'Timeline feed with posts, likes, comments, and shares',
    previewPrompt: 'social media feed with user posts showing avatar, username, post text, image, and like comment share buttons with post timestamps',
  },
  {
    name: 'Chat Conversation',
    category: 'social',
    description: 'Messaging screen with chat bubbles, input field, and send button',
    previewPrompt: 'chat conversation screen with message bubbles in alternating colors, timestamps, read receipts, text input with send and attachment buttons',
  },
  {
    name: 'User Profile',
    category: 'social',
    description: 'User profile with avatar, stats, bio, and post grid',
    previewPrompt: 'social media profile screen with cover photo, circular avatar, username, bio text, followers/following/posts stats row, edit profile button, and photo grid',
  },

  // Finance
  {
    name: 'Banking Dashboard',
    category: 'finance',
    description: 'Account overview with balance, recent transactions, and quick actions',
    previewPrompt: 'banking dashboard with total balance display, account cards, recent transactions list with merchant icons and amounts, and quick action buttons for send pay and request',
  },
  {
    name: 'Transaction History',
    category: 'finance',
    description: 'List of transactions with categories, amounts, and date grouping',
    previewPrompt: 'transaction history screen with date-grouped transactions showing merchant name, category icon, amount in green or red, and running balance',
  },
  {
    name: 'Investment Portfolio',
    category: 'finance',
    description: 'Portfolio overview with holdings, chart, and performance metrics',
    previewPrompt: 'investment portfolio screen with total value, daily change percentage, mini line chart, and list of holdings with ticker symbol current price and gain/loss',
  },

  // Productivity
  {
    name: 'Task Board',
    category: 'productivity',
    description: 'Kanban-style task board with columns and drag indicators',
    previewPrompt: 'task management board with todo in-progress and done columns, task cards with title priority badge and assignee avatar, and add task button',
  },
  {
    name: 'Notes Editor',
    category: 'productivity',
    description: 'Clean note-taking screen with formatting toolbar',
    previewPrompt: 'minimal notes editor with title field, formatting toolbar with bold italic list and heading buttons, and clean text area with placeholder content',
  },
  {
    name: 'Calendar View',
    category: 'productivity',
    description: 'Monthly calendar with event indicators and daily agenda',
    previewPrompt: 'calendar screen with month grid showing event dots on dates, selected date highlight, and agenda list below showing scheduled events with time and color coding',
  },

  // Onboarding
  {
    name: 'Welcome Screen',
    category: 'onboarding',
    description: 'App welcome screen with hero illustration and get-started button',
    previewPrompt: 'app welcome screen with centered emoji illustration, bold welcome title, short subtitle text, get started button, and sign in link at bottom',
  },
  {
    name: 'Feature Carousel',
    category: 'onboarding',
    description: 'Swipeable feature highlights with dot pagination',
    previewPrompt: 'onboarding carousel screen with large feature illustration, feature title and description, dot pagination indicator, skip and next buttons',
  },
  {
    name: 'Permissions Request',
    category: 'onboarding',
    description: 'Screen requesting app permissions with clear explanations',
    previewPrompt: 'permissions request screen with notification and location permission cards each showing icon title description and toggle, continue button at bottom',
  },

  // Settings
  {
    name: 'App Settings',
    category: 'settings',
    description: 'Settings list with sections, toggles, and navigation arrows',
    previewPrompt: 'settings screen with grouped sections for account notifications privacy and about, each item with icon label and chevron or toggle switch',
  },
  {
    name: 'Notification Settings',
    category: 'settings',
    description: 'Granular notification preference controls',
    previewPrompt: 'notification settings screen with master toggle, grouped notification types like messages updates and promotions each with individual toggle switches',
  },

  // Profile
  {
    name: 'Edit Profile',
    category: 'profile',
    description: 'Profile editing form with avatar upload and input fields',
    previewPrompt: 'edit profile screen with circular avatar with camera icon overlay, text inputs for name username bio email and phone, and save button',
  },
  {
    name: 'Account Security',
    category: 'profile',
    description: 'Security settings with password change and 2FA',
    previewPrompt: 'account security screen with change password section, two-factor authentication toggle, active sessions list, and delete account button in red at bottom',
  },

  // Dashboard
  {
    name: 'Analytics Dashboard',
    category: 'dashboard',
    description: 'Data dashboard with charts, metrics cards, and summaries',
    previewPrompt: 'analytics dashboard with key metric cards showing numbers and percentage changes, mini bar chart, top items list, and date range selector at top',
  },
  {
    name: 'Admin Panel',
    category: 'dashboard',
    description: 'Admin overview with user stats, system health, and quick actions',
    previewPrompt: 'admin panel with user count active sessions and revenue metric cards, system status indicators, recent activity log, and quick action buttons',
  },

  // Auth
  {
    name: 'Login Screen',
    category: 'auth',
    description: 'Clean login form with email, password, and social sign-in options',
    previewPrompt: 'login screen with app logo, email and password inputs with icons, sign in button, forgot password link, or divider, and social login buttons for Google and Apple',
  },
  {
    name: 'Sign Up Screen',
    category: 'auth',
    description: 'Registration form with name, email, password, and terms checkbox',
    previewPrompt: 'sign up screen with name email and password inputs, password strength indicator, terms and conditions checkbox, create account button, and sign in link',
  },
  {
    name: 'Forgot Password',
    category: 'auth',
    description: 'Password reset flow with email input and verification',
    previewPrompt: 'forgot password screen with lock icon, instruction text, email input field, send reset link button, and back to login link',
  },
];

export async function handleListTemplates(args: {
  category?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let filtered = TEMPLATES;

  if (args.category) {
    const cat = args.category.toLowerCase();
    filtered = TEMPLATES.filter(t => t.category === cat);
  }

  const categories = [...new Set(TEMPLATES.map(t => t.category))].sort();

  const result = {
    templates: filtered.map(t => ({
      name: t.name,
      category: t.category,
      description: t.description,
      previewPrompt: t.previewPrompt,
    })),
    totalTemplates: filtered.length,
    availableCategories: categories,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
