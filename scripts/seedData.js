// Seed data script for Malaysian Trade Net
// Run this after setting up Firebase: node scripts/seedData.js
// Make sure to set up Firebase Admin SDK credentials

const admin = require('firebase-admin')
const serviceAccount = require('../mlmplan-firebase-adminsdk-fbsvc-fc1bec0203.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

async function seedData() {
  console.log('Starting data seed...')

  // Site Configuration
  await db.collection('siteConfig').doc('main').set({
    brandName: 'Malaysian Trade Net',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#DC2626',
    secondaryColor: '#B91C1C',
    website: 'www.malaysiantradenet.com',
    email: 'info@malaysiantradenet.com',
  })

  // Pages
  await db.collection('pages').doc('about').set({
    title: 'About Us',
    subtitle: 'Your Trusted Investment Partner',
    body: 'Malaysian Trade Net is a trusted name in Real Estate and Forex Trading. We have been serving our clients with integrity and excellence, providing them with opportunities to grow their wealth through various investment channels including Forex Trading, Share Market, Real Estate, Gold Mining, and Crypto Mining.',
  })

  await db.collection('pages').doc('mission-vision').set({
    mission: 'To empower individuals and businesses with innovative investment solutions, providing them with opportunities to achieve financial independence through trusted and transparent investment channels.',
    vision: 'To become a leading global investment platform, recognized for excellence, integrity, and innovation in Forex Trading, Real Estate, and emerging investment opportunities.',
  })

  await db.collection('pages').doc('future').set({
    title: 'Future Plans',
    body: 'Company planning to launch own crypto coin in future. This will provide additional investment opportunities and expand our portfolio of services to better serve our clients.',
  })

  await db.collection('pages').doc('why-choose-us').set({
    benefits: [
      { icon: 'IndianRupee', title: 'Dual Income', description: 'Multiple income streams from packages and referrals' },
      { icon: 'Coins', title: 'INR & Crypto Friendly', description: 'Support for both traditional and digital currencies' },
      { icon: 'Wallet', title: 'Instant Wallet Credit', description: 'Fast and secure wallet transactions' },
      { icon: 'Gift', title: 'Excellent Bonanzas', description: 'Regular bonuses and special promotions' },
      { icon: 'Building2', title: 'Real Estate Investment', description: 'Diversified portfolio including real estate' },
      { icon: 'Award', title: 'Awards & Rewards', description: 'Recognition and rewards for top performers' },
    ],
  })

  // Services
  const services = [
    { name: 'Forex Trading', icon: 'TrendingUp', description: 'Professional forex trading services with expert analysis and market insights.' },
    { name: 'Share Market', icon: 'BarChart3', description: 'Stock market investment opportunities with comprehensive market research.' },
    { name: 'Real Estate', icon: 'Building2', description: 'Premium real estate investment options with guaranteed returns.' },
    { name: 'Gold Mining', icon: 'Coins', description: 'Secure gold mining investments with transparent operations.' },
    { name: 'Crypto Mining', icon: 'Bitcoin', description: 'Advanced cryptocurrency mining solutions with high ROI potential.' },
  ]

  for (const service of services) {
    await db.collection('services').add(service)
  }

  // Packages (Bronze to Double Crown)
  const packages = [
    { name: 'Bronze', usdPrice: 100, inrPrice: 8300, order: 1, visibility: 'public' },
    { name: 'Silver', usdPrice: 250, inrPrice: 20750, order: 2, visibility: 'public' },
    { name: 'Gold', usdPrice: 500, inrPrice: 41500, order: 3, visibility: 'public' },
    { name: 'Diamond', usdPrice: 1000, inrPrice: 83000, order: 4, visibility: 'public' },
    { name: 'Platinum', usdPrice: 2500, inrPrice: 207500, order: 5, visibility: 'public' },
    { name: 'Platinum+', usdPrice: 5000, inrPrice: 415000, order: 6, visibility: 'public' },
    { name: 'Crown', usdPrice: 10000, inrPrice: 830000, order: 7, visibility: 'public' },
    { name: 'Double Crown', usdPrice: 20000, inrPrice: 1660000, order: 8, visibility: 'public' },
  ]

  for (const pkg of packages) {
    await db.collection('packages').add(pkg)
  }

  // Marketing Config
  await db.collection('marketingConfig').doc('main').set({
    directReferralPercent: 5,
    levelPercentages: [
      { levelFrom: 1, levelTo: 5, percent: 5 },
      { levelFrom: 6, levelTo: 10, percent: 4 },
      { levelFrom: 11, levelTo: 15, percent: 3 },
      { levelFrom: 16, levelTo: 20, percent: 2 },
      { levelFrom: 21, levelTo: 25, percent: 1 },
    ],
    qualificationRules: 'Total Level Income on ROI = 100%. Qualification rules apply based on direct referrals and package activations.',
  })

  // Income Rules
  await db.collection('incomeRules').doc('main').set({
    withSecurity: {
      minPackageInr: 50000,
      dailyPercent: 2,
      maxWorkingDays: 60,
      note: 'After 60 working days, you will receive 120% return and land return.',
    },
    withoutSecurity: {
      dailyPercent: 1.5,
      maxWorkingDays: 60,
    },
  })

  // Bonanza
  await db.collection('bonanza').doc('main').set({
    title: 'Bonanza Coming Soon',
    enabled: true,
    description: '',
  })

  // Terms
  await db.collection('terms').doc('main').set({
    content: `Terms & Conditions

1. ROI is paid weekly (Monday to Friday working days)
2. Cutoff time: Friday 5:00 PM
3. Payout release: Monday
4. Admin charges: 10% on all transactions
5. Payment methods: INR and USDT
6. ID renewal required after 3x package activation
7. All incomes are added to wallet balance
8. Terms and conditions are subject to change without prior notice`,
    requireAcceptance: false,
    adminChargesPercent: 10,
    payoutSchedule: 'ROI is paid weekly from Monday to Friday. Cutoff time is Friday 5:00 PM. Payouts are released on Monday.',
  })

  // Contact
  await db.collection('contact').doc('main').set({
    website: 'www.malaysiantradenet.com',
    email: 'info@malaysiantradenet.com',
    phone: '',
    socialLinks: {},
  })

  // Settings
  await db.collection('settings').doc('main').set({
    requireEmailVerification: false,
    requireKYC: false,
    enablePayments: false,
    enableWalletCrediting: false,
    seoTitle: 'Malaysian Trade Net - Investment Platform',
    seoDescription: 'Malaysian Trade Net offers Forex Trading, Real Estate, and Investment opportunities with comprehensive marketing plans.',
  })

  console.log('Data seed completed successfully!')
  process.exit(0)
}

seedData().catch(console.error)

