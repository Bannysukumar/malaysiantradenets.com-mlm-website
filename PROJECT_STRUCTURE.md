# Project Structure

## Directory Overview

```
malaysian-trade-net/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   └── layout/         # Navbar, Footer
│   ├── contexts/            # React contexts
│   │   └── AuthContext.jsx # Authentication context
│   ├── hooks/              # Custom React hooks
│   │   └── useFirestore.js # Firestore data hooks
│   ├── layouts/            # Page layouts
│   │   ├── PublicLayout.jsx
│   │   ├── UserLayout.jsx
│   │   └── AdminLayout.jsx
│   ├── pages/
│   │   ├── public/         # Public marketing pages
│   │   │   ├── Home.jsx
│   │   │   ├── About.jsx
│   │   │   ├── MissionVision.jsx
│   │   │   ├── Services.jsx
│   │   │   ├── Future.jsx
│   │   │   ├── WhyChooseUs.jsx
│   │   │   ├── Packages.jsx
│   │   │   ├── IncomeRules.jsx
│   │   │   ├── MarketingPlan.jsx
│   │   │   ├── ReferralDirect.jsx
│   │   │   ├── ROILevels.jsx
│   │   │   ├── Bonanza.jsx
│   │   │   ├── Terms.jsx
│   │   │   ├── Contact.jsx
│   │   │   └── AuthPage.jsx
│   │   ├── user/           # User dashboard pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Packages.jsx
│   │   │   ├── Referrals.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Notifications.jsx
│   │   │   └── Support.jsx
│   │   └── admin/          # Admin panel pages
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Branding.jsx
│   │       ├── Content.jsx
│   │       ├── Services.jsx
│   │       ├── Packages.jsx
│   │       ├── MarketingPlan.jsx
│   │       ├── IncomeRules.jsx
│   │       ├── Bonanza.jsx
│   │       ├── Terms.jsx
│   │       ├── Contact.jsx
│   │       ├── Users.jsx
│   │       └── Settings.jsx
│   ├── config/
│   │   └── firebase.js     # Firebase configuration
│   ├── utils/
│   │   └── helpers.js       # Utility functions
│   ├── App.jsx             # Main app component with routing
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── scripts/
│   ├── seedData.js         # Firestore seed script
│   └── README.md
├── firebase.json           # Firebase config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── storage.rules           # Storage security rules
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── README.md
├── SETUP.md
└── PROJECT_STRUCTURE.md
```

## Key Features by Section

### Public Pages (`src/pages/public/`)
- All pages match PDF structure exactly
- Content is editable via admin panel
- Responsive mobile-first design
- Dark theme with red accents

### User Dashboard (`src/pages/user/`)
- Package browsing and activation
- Referral link generation
- Profile management
- Wallet display (read-only by default)
- Support ticket system

### Admin Panel (`src/pages/admin/`)
- Full white-label branding control
- Content management system
- Package and service management
- Marketing plan configuration
- User management
- Security and payment settings

## Firestore Collections

### Configuration Collections
- `siteConfig` - Branding and site-wide settings
- `settings` - System settings and feature toggles
- `marketingConfig` - Referral and level income config
- `incomeRules` - Income calculation rules
- `terms` - Terms and conditions
- `contact` - Contact information
- `bonanza` - Bonanza configuration

### Content Collections
- `pages` - Public page content (keyed by slug)
- `services` - Service listings
- `packages` - Investment packages

### User Collections
- `users` - User accounts and profiles
- `userPackages` - Package activations
- `supportTickets` - Support requests
- `auditLogs` - Admin action logs

## Security Model

### Roles
- `user` - Regular member
- `admin` - Content and user management
- `superAdmin` - Full access including deletion

### Firestore Rules
- Public read for content collections
- Admin-only write for configuration
- Users can read/write own data
- Admin can read/write all user data

### Storage Rules
- Public read for branding/content
- Admin-only write for branding/content
- Users can upload own files (KYC, profile)
- Admin can read all user uploads

## Routing Structure

### Public Routes
- `/` - Home
- `/about` - About Us
- `/mission-vision` - Mission & Vision
- `/services` - Services
- `/future` - Future Plans
- `/why-choose-us` - Why Choose Us
- `/packages` - Packages
- `/income-rules` - Income Rules
- `/marketing-plan` - Marketing Plan
- `/referral-direct` - Direct Referral
- `/roi-levels` - ROI Levels
- `/bonanza` - Bonanza
- `/terms` - Terms & Conditions
- `/contact` - Contact
- `/auth` - Authentication

### User Routes (Protected)
- `/app/dashboard` - User Dashboard
- `/app/packages` - User Packages
- `/app/referrals` - Referrals
- `/app/profile` - Profile
- `/app/notifications` - Notifications
- `/app/support` - Support

### Admin Routes (Protected)
- `/admin/login` - Admin Login
- `/admin/dashboard` - Admin Dashboard
- `/admin/branding` - Branding
- `/admin/content` - Content Management
- `/admin/services` - Services Management
- `/admin/packages` - Packages Management
- `/admin/marketing-plan` - Marketing Plan
- `/admin/income-rules` - Income Rules
- `/admin/bonanza` - Bonanza
- `/admin/terms` - Terms
- `/admin/contact` - Contact
- `/admin/users` - User Management
- `/admin/settings` - Settings

## Styling

- **Framework**: Tailwind CSS
- **Theme**: Dark background with red accents
- **Responsive**: Mobile-first approach
- **Components**: Reusable card, button, input styles

## State Management

- **Auth**: React Context (AuthContext)
- **Data**: Firestore real-time listeners via hooks
- **Forms**: React Hook Form
- **Notifications**: React Hot Toast

## Build & Deploy

- **Build Tool**: Vite
- **Hosting**: Firebase Hosting
- **Database**: Firestore
- **Storage**: Firebase Storage
- **Auth**: Firebase Authentication

