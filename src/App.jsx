import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { hasPermission } from './utils/permissions'

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
import ForgotPassword from './pages/public/ForgotPassword'
import ResetPassword from './pages/public/ResetPassword'

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
import UserRenewal from './pages/user/Renewal'
import UserBankDetailsOnboarding from './pages/user/BankDetailsOnboarding'
import UserChooseProgram from './pages/user/ChooseProgram'
import UserLevelTree from './pages/user/LevelTree'
import MyTeamLayout from './layouts/MyTeamLayout'
import MyDirect from './pages/user/my-team/MyDirect'
import UserLevelReport from './pages/user/my-team/LevelReport'

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
import AdminUserDetails from './pages/admin/UserDetails'
import AdminKYCManagement from './pages/admin/KYCManagement'
import AdminBankVerification from './pages/admin/BankVerification'
import AdminLevelTree from './pages/admin/LevelTree'
import AdminWallets from './pages/admin/Wallets'
import AdminWithdrawals from './pages/admin/Withdrawals'
import AdminWithdrawalSettings from './pages/admin/WithdrawalSettings'
import AdminTransfers from './pages/admin/Transfers'
import AdminActivations from './pages/admin/Activations'
import AdminFeatureSettings from './pages/admin/FeatureSettings'
import AdminUserMenuSettings from './pages/admin/UserMenuSettings'
import AdminSettings from './pages/admin/Settings'
import AdminRenewalSettings from './pages/admin/RenewalSettings'
import AdminRenewals from './pages/admin/Renewals'
import AdminProgramSettings from './pages/admin/ProgramSettings'
import AdminActivationRules from './pages/admin/ActivationRules'
import AdminReferralIncomeSettings from './pages/admin/ReferralIncomeSettings'
import AdminReferralIncomeReport from './pages/admin/ReferralIncomeReport'
import AdminPayoutSettings from './pages/admin/PayoutSettings'
import AdminSubAdmins from './pages/admin/SubAdmins'
import ReportsLayout from './layouts/ReportsLayout'
import LevelReport from './pages/admin/reports/LevelReport'
import DirectReferralReport from './pages/admin/reports/DirectReferralReport'
import ROIReport from './pages/admin/reports/ROIReport'
import LevelOnROIReport from './pages/admin/reports/LevelOnROIReport'
import ConsolidatedPayoutReport from './pages/admin/reports/ConsolidatedPayoutReport'
import ConsolidatedWithoutDirectReport from './pages/admin/reports/ConsolidatedWithoutDirectReport'
import AllUserIncomeReport from './pages/admin/reports/AllUserIncomeReport'
import PayoutReportsLayout from './layouts/PayoutReportsLayout'
import PayoutReport from './pages/admin/payout-reports/PayoutReport'
import PayoutHistory from './pages/admin/payout-reports/PayoutHistory'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import UserLayout from './layouts/UserLayout'
import AdminLayout from './layouts/AdminLayout'

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
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
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
        <Route path="renewal" element={<UserRenewal />} />
        <Route path="onboarding/bank-details" element={<UserBankDetailsOnboarding />} />
        <Route path="choose-program" element={<UserChooseProgram />} />
        <Route path="notifications" element={<UserNotifications />} />
        <Route path="support" element={<UserSupport />} />
        <Route path="level-tree" element={<UserLevelTree />} />
        <Route path="my-team" element={<MyTeamLayout />}>
          <Route index element={<Navigate to="my-direct" replace />} />
          <Route path="my-direct" element={<MyDirect />} />
          <Route path="level-report" element={<UserLevelReport />} />
        </Route>
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
        <Route path="users/:uid" element={<AdminUserDetails />} />
        <Route path="kyc-management" element={<AdminKYCManagement />} />
        <Route path="bank-verification" element={<AdminBankVerification />} />
        <Route path="level-tree" element={<AdminLevelTree />} />
        <Route path="wallets" element={<AdminWallets />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="withdrawal-settings" element={<AdminWithdrawalSettings />} />
        <Route path="transfers" element={<AdminTransfers />} />
        <Route path="activations" element={<AdminActivations />} />
        <Route path="feature-settings" element={<AdminFeatureSettings />} />
        <Route path="user-menu-settings" element={<AdminUserMenuSettings />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="renewal-settings" element={<AdminRenewalSettings />} />
        <Route path="renewals" element={<AdminRenewals />} />
        <Route path="program-settings" element={<AdminProgramSettings />} />
        <Route path="activation-rules" element={<AdminActivationRules />} />
        <Route path="referral-income-settings" element={<AdminReferralIncomeSettings />} />
        <Route path="referral-income" element={<AdminReferralIncomeReport />} />
        <Route path="payout-settings" element={<AdminPayoutSettings />} />
        <Route path="sub-admins" element={<AdminSubAdmins />} />
        <Route path="reports" element={<ReportsLayout />}>
          <Route index element={<Navigate to="level" replace />} />
          <Route path="level" element={<LevelReport />} />
          <Route path="direct-referral" element={<DirectReferralReport />} />
          <Route path="roi" element={<ROIReport />} />
          <Route path="level-on-roi" element={<LevelOnROIReport />} />
          <Route path="consolidated" element={<ConsolidatedPayoutReport />} />
          <Route path="consolidated-without-direct" element={<ConsolidatedWithoutDirectReport />} />
          <Route path="all-user-income" element={<AllUserIncomeReport />} />
        </Route>
        <Route path="payout-reports" element={<PayoutReportsLayout />}>
          <Route index element={<Navigate to="payout-report" replace />} />
          <Route path="payout-report" element={<PayoutReport />} />
          <Route path="payout-history" element={<PayoutHistory />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// ProtectedRoute must be defined outside AppRoutes but will be used inside AuthProvider context
function ProtectedRoute({ children, requireAdmin = false, requireSuperAdmin = false }) {
    const { user, userData, loading, isAdmin, isSuperAdmin } = useAuth()
    const location = window.location.pathname
    
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
      // Check if sub-admin has permission for this route
      if (userData?.role === 'subAdmin') {
        if (!hasPermission(userData, location)) {
          return <Navigate to="/admin/dashboard" replace />
        }
      } else {
        return <Navigate to="/app/dashboard" replace />
      }
    }
    
    // User route checks (not for admin routes)
    if (!requireAdmin && userData) {
      // Check if user is blocked
      if (userData.status === 'AUTO_BLOCKED' || userData.status === 'blocked') {
        // Allow access to support page only
        if (location !== '/app/support' && location !== '/app/onboarding/bank-details') {
          return <Navigate to="/app/support" replace />
        }
      }
      
      // Check if bank details are required (skip for onboarding pages and profile page)
      // Allow profile page so user can view/edit their bank details
      if (!userData.bankDetailsCompleted && 
          location !== '/app/onboarding/bank-details' && 
          location !== '/app/support' &&
          location !== '/app/profile') {
        return <Navigate to="/app/onboarding/bank-details" replace />
      }
      
      // Check if program selection is required (skip for onboarding pages)
      if (userData.bankDetailsCompleted && 
          !userData.programType && 
          userData.status === 'PENDING_ACTIVATION' &&
          location !== '/app/choose-program' &&
          location !== '/app/onboarding/bank-details' &&
          location !== '/app/support' &&
          location !== '/app/profile') {
        return <Navigate to="/app/choose-program" replace />
      }
    }
    
    return children
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

