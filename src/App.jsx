import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'

// Public pages
import Home from './pages/public/Home'
import About from './pages/public/About'
import MissionVision from './pages/public/MissionVision'
import Services from './pages/public/Services'
import Future from './pages/public/Future'
import WhyChooseUs from './pages/public/WhyChooseUs'
import Packages from './pages/public/Packages'
import IncomeRules from './pages/public/IncomeRules'
import MarketingPlan from './pages/public/MarketingPlan'
import ReferralDirect from './pages/public/ReferralDirect'
import ROILevels from './pages/public/ROILevels'
import Bonanza from './pages/public/Bonanza'
import Terms from './pages/public/Terms'
import Contact from './pages/public/Contact'
import AuthPage from './pages/public/AuthPage'

// User app
import UserDashboard from './pages/user/Dashboard'
import UserPackages from './pages/user/Packages'
import UserReferrals from './pages/user/Referrals'
import UserProfile from './pages/user/Profile'
import UserNotifications from './pages/user/Notifications'
import UserSupport from './pages/user/Support'
import UserWallet from './pages/user/Wallet'
import UserIncomeHistory from './pages/user/IncomeHistory'
import UserWithdraw from './pages/user/Withdraw'
import UserTransfer from './pages/user/Transfer'
import UserTransferHistory from './pages/user/TransferHistory'
import UserActivateUser from './pages/user/ActivateUser'
import UserActivationHistory from './pages/user/ActivationHistory'

// Admin
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminBranding from './pages/admin/Branding'
import AdminContent from './pages/admin/Content'
import AdminServices from './pages/admin/Services'
import AdminPackages from './pages/admin/Packages'
import AdminMarketingPlan from './pages/admin/MarketingPlan'
import AdminIncomeRules from './pages/admin/IncomeRules'
import AdminBonanza from './pages/admin/Bonanza'
import AdminTerms from './pages/admin/Terms'
import AdminContact from './pages/admin/Contact'
import AdminUsers from './pages/admin/Users'
import AdminWallets from './pages/admin/Wallets'
import AdminWithdrawals from './pages/admin/Withdrawals'
import AdminWithdrawalSettings from './pages/admin/WithdrawalSettings'
import AdminTransfers from './pages/admin/Transfers'
import AdminActivations from './pages/admin/Activations'
import AdminFeatureSettings from './pages/admin/FeatureSettings'
import AdminSettings from './pages/admin/Settings'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import UserLayout from './layouts/UserLayout'
import AdminLayout from './layouts/AdminLayout'

function ProtectedRoute({ children, requireAdmin = false, requireSuperAdmin = false }) {
  const { user, loading, isAdmin, isSuperAdmin } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />
  }
  
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/app/dashboard" replace />
  }
  
  if (requireAdmin && !isAdmin && !isSuperAdmin) {
    return <Navigate to="/app/dashboard" replace />
  }
  
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="mission-vision" element={<MissionVision />} />
        <Route path="services" element={<Services />} />
        <Route path="future" element={<Future />} />
        <Route path="why-choose-us" element={<WhyChooseUs />} />
        <Route path="packages" element={<Packages />} />
        <Route path="income-rules" element={<IncomeRules />} />
        <Route path="marketing-plan" element={<MarketingPlan />} />
        <Route path="referral-direct" element={<ReferralDirect />} />
        <Route path="roi-levels" element={<ROILevels />} />
        <Route path="bonanza" element={<Bonanza />} />
        <Route path="terms" element={<Terms />} />
        <Route path="contact" element={<Contact />} />
        <Route path="auth" element={<AuthPage />} />
      </Route>

      {/* User app routes */}
      <Route path="/app" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="packages" element={<UserPackages />} />
        <Route path="referrals" element={<UserReferrals />} />
        <Route path="profile" element={<UserProfile />} />
        <Route path="wallet" element={<UserWallet />} />
        <Route path="income-history" element={<UserIncomeHistory />} />
        <Route path="withdraw" element={<UserWithdraw />} />
        <Route path="transfer" element={<UserTransfer />} />
        <Route path="transfer-history" element={<UserTransferHistory />} />
        <Route path="activate-user" element={<UserActivateUser />} />
        <Route path="activation-history" element={<UserActivationHistory />} />
        <Route path="notifications" element={<UserNotifications />} />
        <Route path="support" element={<UserSupport />} />
      </Route>

      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="branding" element={<AdminBranding />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="packages" element={<AdminPackages />} />
        <Route path="marketing-plan" element={<AdminMarketingPlan />} />
        <Route path="income-rules" element={<AdminIncomeRules />} />
        <Route path="bonanza" element={<AdminBonanza />} />
        <Route path="terms" element={<AdminTerms />} />
        <Route path="contact" element={<AdminContact />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="wallets" element={<AdminWallets />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="withdrawal-settings" element={<AdminWithdrawalSettings />} />
        <Route path="transfers" element={<AdminTransfers />} />
        <Route path="activations" element={<AdminActivations />} />
        <Route path="feature-settings" element={<AdminFeatureSettings />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <Toaster position="top-right" />
      </Router>
    </AuthProvider>
  )
}

export default App

