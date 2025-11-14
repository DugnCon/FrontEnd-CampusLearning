/*-----------------------------------------------------------------
* File: App.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CallInterface } from './components/Call';
import MainLayout from './components/Layout/MainLayout';
import { CallProvider } from './contexts/CallContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthMiddleware from './middleware/AuthMiddleware';
import AIChat from './pages/AIChat';
import AiTestLocal from './pages/AiTestLocal';
import ForcedTwoFASetup from './pages/Auth/ForcedTwoFASetup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Login from './pages/Auth/Login';
import OtpLogin from './pages/Auth/OtpLogin';
import Register from './pages/Auth/Register';
import ResetPassword from './pages/Auth/ResetPassword';
import UnlockAccount from './pages/Auth/UnlockAccount';
import Chat from './pages/Chat';
import CompetitionsPage from './pages/Competitions';
import CompetitionDetail from './pages/Competitions/CompetitionDetail';
import ProblemDetail from './pages/Competitions/ProblemDetail';
import Courses from './pages/Courses';
import CourseDetail from './pages/Courses/CourseDetail';
import CourseLearning from './pages/Courses/CourseLearning';
import EditCode from './pages/Courses/EditCode';
import Events from './pages/Events';
import EventDetail from './pages/Events/EventDetail';
import Exams from './pages/Exams';
import Friends from './pages/Friends';
import Home from './pages/Home';
import Notifications from './pages/Notifications';
import OtherCourses from './pages/OtherCourses';
import Payment from './pages/Payment';
import PaymentVietQR from './pages/Payment/VietQRPayment';
import PaymentHistory from './pages/PaymentHistory';
import CoursePrint from './pages/PaymentHistory/print';
import PaymentResult from './pages/PaymentResult';
import Posts from './pages/Posts';
import Profile from './pages/Profile';
import Ranking from './pages/Ranking';
import Reports from './pages/Reports/index';
import Roadmaps from './pages/Roadmaps';
import Settings from './pages/Settings';
import Stories from './pages/Stories';
import FAQ from './pages/Support/FAQ';
import HelpCenter from './pages/Support/HelpCenter';
import PrivacyPolicy from './pages/Support/PrivacyPolicy';
import TermsOfUse from './pages/Support/TermsOfUse';

// Custom CSS for toast notifications
import './toast-custom.css';

function App() {
  return (
    <ThemeProvider>
      <CallProvider>
        <MainLayout>
          <ToastContainer 
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            className="toast-container-custom"
            toastClassName="toast-custom"
            style={{ top: '70px' }}
          />
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                marginTop: '70px',
              },
            }}
          />
          <CallInterface />
          <Routes>
            {/* Public routes */}
            <Route path="/user/login" element={<Login />} />
            <Route path="/user/login-otp" element={<OtpLogin />} />
            <Route path="/user/register" element={<Register />} />
            <Route path="/user/forgot-password" element={<ForgotPassword />} />
            <Route path="/user/reset-password" element={<ResetPassword />} />
            <Route path="/user/unlock-account" element={<UnlockAccount />} />
            <Route path="/user/setup-2fa" element={<ForcedTwoFASetup />} />
            
            {/* Public course and event routes */}
            <Route path="/user/courses/*" element={<Courses />} />
            <Route path="/user/courses/:courseId" element={<CourseDetail />} />
            <Route path="/user/events/:eventId" element={<EventDetail />} />
            <Route path="/user/roadmaps" element={<Roadmaps />} />
            
            {/* Payment callback routes */}
            <Route path="/user/payment/callback" element={<PaymentResult />} />
            <Route path="/user/payment/paypal/success" element={<PaymentResult />} />
            <Route path="/user/payment/paypal/cancel" element={<PaymentResult />} />

            {/* Protected routes */}
            {[
              { path: '/user/home', element: <Home /> },
              { path: '/user/profile', element: <Profile /> },
              { path: '/user/profile/:userId', element: <Profile /> },
              { path: '/user/friends', element: <Friends /> },
              { path: '/user/events', element: <Events /> },
              { path: '/user/posts', element: <Posts /> },
              { path: '/user/notifications', element: <Notifications /> },
              { path: '/user/ranking', element: <Ranking /> },
              { path: '/user/ai-chat', element: <AIChat /> },
              { path: '/user/ai-test-local', element: <AiTestLocal /> },
              { path: '/user/other-courses', element: <OtherCourses /> },
              { path: '/user/chat', element: <Chat /> },
              { path: '/user/stories', element: <Stories /> },
              { path: '/user/reports', element: <Reports /> },
              { path: '/user/settings', element: <Settings /> },
              { path: '/user/exams/*', element: <Exams /> },
              { path: '/user/competitions', element: <CompetitionsPage /> },
              { path: '/user/competitions/:id', element: <CompetitionDetail /> },
              { path: '/user/competitions/:competitionId/problems/:problemId', element: <ProblemDetail /> },
              { path: '/user/courses/:courseId/learn', element: <CourseLearning /> },
              { path: '/user/courses/:courseId/edit-code/:lessonId', element: <EditCode /> },
              { path: '/user/payment/:courseId', element: <Payment /> },
              { path: '/user/payment/vietqr/:transactionCode', element: <PaymentVietQR /> },
              { path: '/user/payment-history', element: <PaymentHistory /> },
              { path: '/user/payment-history/print-course', element: <CoursePrint /> }
            ].map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={<AuthMiddleware>{element}</AuthMiddleware>}
              />
            ))}

            {/* Root route */}
            <Route 
              path="/user/"
              element={
                localStorage.getItem('token') ? 
                <Navigate to="/user/home" replace /> : 
                <Navigate to="/user/login" replace />
              } 
            />

            {/* Catch all route */}
            <Route 
              path="/user/*"
              element={
                localStorage.getItem('token') ? 
                <Navigate to="/user/home" replace /> : 
                <Navigate to="/user/login" replace />
              }
            />

            {/* Support routes */}
            <Route path="/user/support/faq" element={<FAQ />} />
            <Route path="/user/support/help-center" element={<HelpCenter />} />
            <Route path="/user/support/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/user/support/terms-of-use" element={<TermsOfUse />} />
          </Routes>
        </MainLayout>
      </CallProvider>
    </ThemeProvider>
  );
}

export default App;