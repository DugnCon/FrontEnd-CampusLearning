/*-----------------------------------------------------------------
* File: index.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Adventure-style landing page optimized for responsive layout - Campus Learning platform.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
"use client"

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchEnrolledCourses, addEnrolledCourse, loadCachedAllCourses, preloadAllCourses } from '@/store/slices/courseSlice';
import courseApi from '@/api/courseApi';
import postService from '@/services/postService'; 

import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from "framer-motion"
import SEOHelmet from '@/components/SEO/SEOHelmet.jsx';
import {
  BookOpenIcon,
  UserGroupIcon,
  CodeBracketIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
  PlayIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  LightBulbIcon,
  ServerIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  CommandLineIcon,
  StarIcon,
  SparklesIcon,
  AcademicCapIcon,
  TrophyIcon,
  CheckBadgeIcon,
  FireIcon,
  BoltIcon,
  CheckIcon,
  HeartIcon,
  CpuChipIcon,
  CloudIcon,
  ChartBarIcon,
  CalendarIcon,
  MapPinIcon,
  EyeIcon,
  HandRaisedIcon,
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  UsersIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"
import { setUser } from '@/store/slices/authSlice';
import { injectJsonLdScript, removeJsonLdScript } from '../../utils/safeScriptInjection';

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, isAuthenticated } = useAuth()
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)
  const [popularCourses, setPopularCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [blogPosts, setBlogPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const dispatch = useDispatch();
  const userFromRedux = useSelector(state => state.auth.user);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Check if user is coming from verification
  useEffect(() => {
    if (location.state?.fromVerification && location.state?.verified) {
      // Show welcome message
      toast.success(`Chào mừng ${currentUser?.fullName || currentUser?.username || 'bạn'} đã tham gia Campus Learning!`, {
        autoClose: 6000,
        position: "top-center",
        className: "welcome-toast",
        icon: "🎉"
      });
      
      // Clear the state to prevent showing the message again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, currentUser, navigate]);

  // SEO structured data for homepage
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Campus Learning - Trang chủ",
    "description": "Nền tảng học lập trình trực tuyến hàng đầu Việt Nam với 500+ khóa học chất lượng cao",
    "url": "https://campuslearning.online/",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Campus Learning",
      "url": "https://campuslearning.online"
    },
    "about": {
      "@type": "Thing",
      "name": "Học lập trình trực tuyến"
    },
    "audience": {
      "@type": "Audience",
      "audienceType": "Students, Developers, IT Professionals"
    },
    "provider": {
      "@type": "EducationalOrganization",
      "name": "Campus Learning",
      "url": "https://campuslearning.online"
    }
  };

  // SEO Meta tags dynamic update
  useEffect(() => {
    // Update meta description dynamically
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Campus Learning - Nền tảng học lập trình trực tuyến hàng đầu với 500+ khóa học từ cơ bản đến nâng cao. AI cá nhân hóa, thực hành trực tuyến, mentor 1-1. Tham gia 50,000+ học viên thành công!'
      );
    }

    // Update page title
    document.title = 'Campus Learning - Nền tảng học lập trình hàng đầu Việt Nam | 500+ khóa học chất lượng';

    // Add breadcrumb structured data
    const breadcrumbData = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Trang chủ",
          "item": "https://campuslearning.online/"
        }
      ]
    };
    injectJsonLdScript(breadcrumbData, 'databreadcrumb', 'home');

    // Add FAQ structured data
    const faqData = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Campus Learning có miễn phí không?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Campus Learning cung cấp nhiều khóa học miễn phí và có phí. Bạn có thể đăng ký miễn phí để truy cập các khóa học cơ bản và nâng cấp để học các khóa học premium."
          }
        },
        {
          "@type": "Question", 
          "name": "Tôi có thể học lập trình từ đầu tại Campus Learning không?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Hoàn toàn có thể! Campus Learning có các khóa học từ cơ bản đến nâng cao, phù hợp cho người mới bắt đầu với lộ trình học cá nhân hóa và mentor hỗ trợ 1-1."
          }
        },
        {
          "@type": "Question",
          "name": "Campus Learning có cấp chứng chỉ không?",
          "acceptedAnswer": {
            "@type": "Answer", 
            "text": "Có, Campus Learning cấp chứng chỉ hoàn thành khóa học được công nhận bởi các công ty công nghệ hàng đầu như Google, Microsoft, Amazon."
          }
        }
      ]
    };
    injectJsonLdScript(faqData, 'datafaq', 'home');

    return () => {
      // Cleanup scripts on unmount
      removeJsonLdScript('databreadcrumb', 'home');
      removeJsonLdScript('datafaq', 'home');
    };
  }, []);

  // Load user data from localStorage if not in Redux - only once
  useEffect(() => {
    if (!userFromRedux || Object.keys(userFromRedux).length === 0) {
      const userDataString = localStorage.getItem('user');
      if (userDataString) {
        try {
          const userData = JSON.parse(userDataString);
          dispatch(setUser(userData));
        } catch (error) {
          console.error('Error parsing user data from localStorage:', error);
        }
      }
    }
  }, [dispatch, userFromRedux]);

  // Authentication check - removed redirect logic to allow viewing home without login
  useEffect(() => {
    setAuthChecked(true);
  }, []);

  const famousQuotes = [
    {
      quote: "Mọi người nghĩ rằng khoa học máy tính là nghệ thuật của những thiên tài, nhưng thực tế ngược lại, chỉ là nhiều người làm việc cùng nhau, giống như xây dựng một bức tường gạch nhỏ.",
      author: "Alan Kay",
      role: "Nhà khoa học máy tính",
    },
    {
      quote: "Đoạn code đầu tiên mà bạn viết sẽ luôn là đoạn code tồi tệ nhất.",
      author: "Jeff Atwood",
      role: "Đồng sáng lập Stack Overflow",
    },
    {
      quote: "Học lập trình không phải là học ngôn ngữ, mà là học cách giải quyết vấn đề.",
      author: "Edsger W. Dijkstra",
      role: "Nhà khoa học máy tính",
    },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => (prevIndex === famousQuotes.length - 1 ? 0 : prevIndex + 1))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchPopularCourses = async () => {
      try {
        // Fetch courses without requiring authentication for public viewing
        const response = await courseApi.getAllCourses()
        if (response.data && response.data.success) {
          // Lọc và sắp xếp các khóa học theo số lượng học viên
          const courses = response.data.data || []
          const sortedCourses = courses
            .sort((a, b) => (b.EnrolledCount || 0) - (a.EnrolledCount || 0))
            .slice(0, 4) // Lấy 4 khóa học cho adventure categories

          setPopularCourses(sortedCourses)
        }
      } catch (error) {
        console.error('Error fetching popular courses:', error)
        // Still set loading to false even if API fails, so page can render
      } finally {
        setLoading(false)
      }
    }

    fetchPopularCourses()
  }, [])

  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        // Fetch posts without requiring authentication for public viewing
        const token = localStorage.getItem('token');
        const headers = {};
        
        // Only add Authorization header if token exists
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('http://localhost:8080/api/posts?limit=3', {
          headers
        });
        
        if (!response.ok) {
          // If unauthorized but we're in public mode, just show empty state
          if (response.status === 401) {
            console.log('No authentication provided, showing public view');
            setBlogPosts([]);
            setPostsLoading(false);
            return;
          }
          throw new Error('Không thể tải bài viết');
        }

        const contentType = response.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          throw new Error('Server returned non-JSON response');
        }

        const postsWithDefaults = (data.posts || []).map(post => ({
          ...post,
          IsLiked: post.IsLiked !== undefined ? post.IsLiked : false,
          IsBookmarked: post.IsBookmarked !== undefined ? post.IsBookmarked : false,
          LikesCount: post.LikesCount !== undefined ? post.LikesCount : 0,
          BookmarksCount: post.BookmarksCount !== undefined ? post.BookmarksCount : 0,
          CommentsCount: post.CommentsCount !== undefined ? post.CommentsCount : 0
        }));

        // Sắp xếp theo thời gian tạo (mới nhất trước) và lấy 3 bài đầu
        const sortedPosts = postsWithDefaults
          .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
          .slice(0, 3);

        setBlogPosts(sortedPosts);
      } catch (error) {
        console.error('Error fetching blog posts:', error)
        // Fallback to empty array if API fails - still allow page to render
        setBlogPosts([])
      } finally {
        setPostsLoading(false)
      }
    }

    fetchBlogPosts()
  }, [])

  const adventureCategories = [
    {
      title: "Lập trình cơ bản",
      subtitle: "services",
      description: "Khởi đầu hành trình với HTML, CSS, JavaScript cơ bản",
      image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop",
      icon: CodeBracketIcon,
      courses: "25+",
      students: "5,240"
    },
    {
      title: "Framework hiện đại",
      subtitle: "và thư viện",
      description: "React, Vue, Angular - Công nghệ frontend hàng đầu",
      image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&h=300&fit=crop",
      icon: RocketLaunchIcon,
      courses: "30+",
      students: "8,150"
    },
    {
      title: "Backend và API",
      subtitle: "Development",
      description: "Node.js, Python, Database - Xây dựng hệ thống mạnh mẽ",
      image:"https://vtiacademy.edu.vn/upload/images/front-end-back-end-la-gi-phan-biet-va-so-sanh-front-end-va-back-end-trong-lap-trinh.jpg",
      icon: ServerIcon,
      courses: "40+",
      students: "6,890"
    },
    {
      title: "Mobile & AI",
      subtitle: "Technologies",
      description: "React Native, Flutter, Machine Learning - Tương lai công nghệ",
      image: "https://www.addevice.io/storage/ckeditor/uploads/images/65f82dcd3866a_ai.in.mobile.app.development.1920.1080.png",
      icon: DevicePhoneMobileIcon,
      courses: "20+",
      students: "4,320"
    },
  ]

  const features = [
    {
      title: "An toàn và uy tín",
      description: "Chúng tôi đảm bảo an toàn thông tin và chất lượng giáo dục hàng đầu với chứng chỉ quốc tế.",
      icon: ShieldCheckIcon,
    },
    {
      title: "Giá ưu đãi và hấp dẫn",
      description: "Chúng tôi đưa ra giá ưu đãi và mỗi ngày đều có khóa học tốt nhất theo từng thể loại.",
      icon: StarIcon,
    },
    {
      title: "Hướng dẫn viên đáng tin cậy",
      description: "Đội ngũ mentor giàu kinh nghiệm từ các công ty lớn như Google, Facebook, Amazon hướng dẫn trực tiếp.",
      icon: CheckBadgeIcon,
    },
  ]

  const experienceFeatures = [
    { label: "Lập trình Frontend", percentage: 89 },
    { label: "Backend Development", percentage: 76 },
    { label: "Mobile Apps", percentage: 95 },
    { label: "AI & Machine Learning", percentage: 82 },
    { label: "DevOps & Cloud", percentage: 68 },
  ]

  const stats = [
    { number: "50K+", label: "Học viên thành công", icon: UserGroupIcon },
    { number: "500+", label: "Khóa học chất lượng", icon: BookOpenIcon },
    { number: "98%", label: "Tỷ lệ hài lòng", icon: HeartIcon },
    { number: "24/7", label: "Hỗ trợ mentor", icon: TrophyIcon },
  ]

  // Hàm xử lý navigation - cho phép xem public content, yêu cầu login cho chi tiết
  const handleNavigation = (path) => {
    // Allow navigation to public pages without authentication
    const publicPaths = ['/courses', '/posts'];
    const isPublicPath = publicPaths.some(publicPath => path.startsWith(publicPath));
    
    if (!isAuthenticated && !isPublicPath) {
      // For non-public paths, redirect to login
      navigate("/login");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } else if (!isAuthenticated && isPublicPath) {
      // For public paths when not authenticated, go to login first
      navigate("/login", { 
        state: { 
          from: path,
          message: "Vui lòng đăng nhập để xem chi tiết" 
        }
      });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } else {
      // User is authenticated, navigate normally
      navigate(path);
    }
  }

  // Hàm navigation cho các link public (không yêu cầu login ngay)
  const handlePublicNavigation = (path) => {
    navigate(path);
  }

  // Hàm helper để navigate với scroll to top
  const navigateWithScrollToTop = (path) => {
    navigate(path);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }

  return (
    <>
      <SEOHelmet
        title="Campus Learning - Nền tảng học lập trình hàng đầu Việt Nam | 500+ khóa học chất lượng"
        description="Campus Learning - Nền tảng học lập trình trực tuyến hàng đầu với 500+ khóa học từ cơ bản đến nâng cao. AI cá nhân hóa, thực hành trực tuyến, mentor 1-1. Tham gia 50,000+ học viên thành công!"
        keywords="học lập trình, khóa học online, frontend, backend, mobile app, AI machine learning, campus learning, học code, khoá học IT, lập trình viên, React, JavaScript, Python, Java"
        image="https://campuslearning.online/images/campus-learning-homepage.jpg"
        url="https://campuslearning.online/"
        type="website"
        structuredData={structuredData}
      />
      
      {/* Main Container */}
      <main className="min-h-screen bg-white overflow-x-hidden">
        
        {/* Hero Section with Large Background Image */}
        <section className="relative min-h-screen bg-cover bg-center bg-no-repeat flex items-center" 
                 style={{
                   backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')`
                 }}>
          
          <div className="w-full">
            <div className="text-center text-white px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
              
              {/* Course & Training Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
                className="inline-block bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-6 sm:mb-8"
              >
                Course & Training
              </motion.div>

              {/* Main Title */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-tight"
              >
                Khám phá vùng đất lập trình
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.4 }}
                className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 opacity-90 max-w-4xl mx-auto leading-relaxed px-4"
              >
                Hành trình chinh phục công nghệ cùng đội ngũ mentor chuyên nghiệp.
                <span className="block mt-2">
                  Từ zero đến hero, cùng phát triển kỹ năng coding của bạn thực sự.
                </span>
              </motion.p>

              {/* CTA Button */}
                <motion.button
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.6 }}
                                      onClick={() => handlePublicNavigation("/courses")}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                >
                Bắt đầu ngay
                </motion.button>
            </div>

            {/* Search Bar at Bottom - Compact & Aligned */}
              <motion.div
              initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="absolute bottom-2 sm:bottom-4 left-4 right-4 max-w-6xl mx-auto"
            >
              <div className="bg-white rounded-lg sm:rounded-xl shadow-xl p-3 sm:p-4">
                
                {/* Mobile: Stacked Layout */}
                <div className="block md:hidden space-y-2">
                  {/* Row 1: Field and Course Type */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer min-h-[60px]">
                      <CodeBracketIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 truncate">Chọn lĩnh vực</div>
                        <div className="font-medium text-gray-900 text-xs truncate">Frontend, Backend...</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer min-h-[60px]">
                      <BookOpenIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 truncate">Chọn loại khóa học</div>
                        <div className="font-medium text-gray-900 text-xs truncate">Cơ bản, Nâng cao</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Row 2: Schedule and Level */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer min-h-[60px]">
                      <CalendarIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 truncate">Chọn lịch học</div>
                        <div className="font-medium text-gray-900 text-xs truncate">Linh hoạt</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer min-h-[60px]">
                      <UsersIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 truncate">Trình độ</div>
                        <div className="font-medium text-gray-900 text-xs truncate">Tất cả level</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Search Button - Full Width */}
                  <button 
                    onClick={() => handlePublicNavigation("/courses")}
                    className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-2.5 font-medium text-sm transition-all duration-300 flex items-center justify-center space-x-2 mt-2"
                  >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    <span>Tìm khóa học</span>
                  </button>
                </div>

                {/* Desktop: Horizontal Layout */}
                <div className="hidden md:grid md:grid-cols-5 gap-2 items-center">
                  
                  {/* Choose Field */}
                  <div className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer h-[56px]">
                    <CodeBracketIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 truncate">Chọn lĩnh vực</div>
                      <div className="font-medium text-gray-900 text-sm truncate">Frontend, Backend, AI...</div>
                    </div>
                  </div>

                  {/* Choose Course Type */}
                  <div className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer h-[56px]">
                    <BookOpenIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 truncate">Chọn loại khóa học</div>
                      <div className="font-medium text-gray-900 text-sm truncate">Cơ bản, Nâng cao, Dự án</div>
                    </div>
                  </div>

                  {/* Choose Schedule */}
                  <div className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer h-[56px]">
                    <CalendarIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 truncate">Chọn lịch học</div>
                      <div className="font-medium text-gray-900 text-sm truncate">Linh hoạt</div>
                    </div>
                  </div>

                  {/* Choose Level */}
                  <div className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer h-[56px]">
                    <UsersIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 truncate">Trình độ</div>
                      <div className="font-medium text-gray-900 text-sm truncate">Tất cả level</div>
                    </div>
                  </div>

                  {/* Search Button */}
                  <button 
                    onClick={() => handlePublicNavigation("/courses")}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-3 font-medium text-sm transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 h-[56px] min-w-[140px]"
                  >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    <span>Tìm khóa học</span>
                  </button>
                </div>
                </div>
              </motion.div>
        </div>
      </section>

        {/* Adventure Categories Section */}
        <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16">
              <div className="text-orange-500 font-semibold text-base sm:text-lg mb-4">HOẠT ĐỘNG NỔI BẬT</div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Khám phá lĩnh vực lập trình
              </h2>
            </div>

            {/* Categories Grid - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {adventureCategories.map((category, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                  className="group cursor-pointer"
                  onClick={() => handlePublicNavigation("/courses")}
                >
                  <div className="relative overflow-hidden rounded-2xl shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2">
                    {/* Background Image */}
                    <div className="relative h-64 sm:h-80">
                      <img
                        src={category.image}
                        alt={category.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                </div>

                    {/* Content Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg sm:text-xl font-bold truncate pr-2">{category.title}</h3>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                          <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                      </div>
                      <p className="text-sm opacity-90 mb-2 truncate">{category.subtitle}</p>
                      <p className="text-sm opacity-75 line-clamp-2 mb-3">{category.description}</p>
                      
                      {/* Stats */}
                      <div className="flex items-center space-x-4 text-xs">
                        <span className="flex items-center">
                          <BookOpenIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{category.courses} khóa học</span>
                        </span>
                        <span className="flex items-center">
                          <UserGroupIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{category.students} học viên</span>
                        </span>
                      </div>
                    </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

        {/* Amazing Learning Experience Section */}
        <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              
              {/* Left Column - Image */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
                className="relative order-2 lg:order-1"
              >
                <div className="relative">
                  {/* Main Image */}
                  <img
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                    alt="Amazing Learning Experience"
                    className="w-full rounded-2xl shadow-2xl"
                  />
                  
                  {/* Small Overlay Image */}
                  <div className="absolute -bottom-4 sm:-bottom-8 -left-4 sm:-left-8 w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-2xl shadow-xl p-2">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
                      alt="Student Success"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>

                  {/* Success Badge */}
                  <div className="absolute -bottom-2 sm:-bottom-4 -right-2 sm:-right-4 bg-orange-500 text-white rounded-2xl p-3 sm:p-4 shadow-xl">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold">18</div>
                      <div className="text-xs">Tuần kinh nghiệm</div>
                    </div>
                  </div>

                  {/* Green Circle Decoration */}
                  <div className="absolute -top-4 sm:-top-8 -left-4 sm:-left-8 w-16 h-16 sm:w-20 sm:h-20 bg-green-600 rounded-full opacity-80"></div>
                </div>
              </motion.div>

              {/* Right Column - Content */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="space-y-6 sm:space-y-8 order-1 lg:order-2"
              >
                <div>
                  <div className="text-orange-500 font-semibold text-base sm:text-lg mb-4">HỌC TẬP CÓ CÁO CHỖ</div>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
                    Trải nghiệm học tập tuyệt vời
            </h2>
                </div>

                {/* Features List */}
                <div className="space-y-6">
                  {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                      className="flex items-start space-x-4"
              >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
                      <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                        <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{feature.description}</p>
                </div>
              </motion.div>
            ))}
                </div>
              </motion.div>
          </div>
        </div>
      </section>

        {/* Experience Adventure Section - Dark Theme */}
        <section className="py-16 sm:py-20 bg-gray-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              
              {/* Left Column - Content */}
          <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
                className="space-y-6 sm:space-y-8"
              >
                <div>
                  <div className="text-orange-500 font-semibold text-base sm:text-lg mb-4">HOẠT ĐỘNG NỔI BẬT</div>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
                    Cảm giác thành thạo lập trình
            </h2>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-base sm:text-lg leading-relaxed mb-6 sm:mb-8">
                  <strong>Cuộc phiêu lưu thực sự với việc tận hưởng những chuyến đi mạo hiểm của học</strong>
                </p>

                <p className="text-gray-400 leading-relaxed mb-6 sm:mb-8 text-sm sm:text-base">
                  Chúng tôi đều trải qua cảm xúc này với nhóm vốn câu sáng tóa. 
                  dũ lên, đó chính là những phút giây đã mà hiếu có thể đưa hướng dẫn vũ trụ của họ trở nên.
                </p>

                {/* Progress Bars */}
                <div className="space-y-4 mb-6 sm:mb-8">
                  {experienceFeatures.map((item, index) => (
              <motion.div
                key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                      className="space-y-2"
                    >
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-300 truncate pr-4">{item.label}</span>
                        <span className="text-sm text-gray-300 flex-shrink-0">{item.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${item.percentage}%` }}
                          transition={{ duration: 1, delay: index * 0.1 }}
                          viewport={{ once: true }}
                          className="bg-green-600 h-2 rounded-full"
                        ></motion.div>
                      </div>
          </motion.div>
                  ))}
                  </div>
                  
                                {/* Tech Stack Icons */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3">
                    {/* React */}
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
                      <img 
                        src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" 
                        alt="React" 
                        className="w-6 h-6"
                      />
                    </div>
                    
                    {/* JavaScript */}
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
                      <img 
                        src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" 
                        alt="JavaScript" 
                        className="w-6 h-6"
                      />
                  </div>
                  
                    {/* Python */}
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
                      <img 
                        src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" 
                        alt="Python" 
                        className="w-6 h-6"
                      />
                      </div>
                    
                    {/* Node.js */}
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
                      <img 
                        src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" 
                        alt="Node.js" 
                        className="w-6 h-6"
                      />
                      </div>
                    
                    {/* Plus Icon for more */}
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
                      <PlusIcon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right Column - Image */}
                <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                  viewport={{ once: true }}
                className="relative"
              >
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                  alt="Coding Adventure"
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/20 to-transparent rounded-2xl"></div>
              </motion.div>
                      </div>
                      </div>

          {/* Tent Icon */}
          <div className="absolute top-8 sm:top-16 left-8 sm:left-16 text-green-600 opacity-20 hidden lg:block">
            <div className="w-16 h-16 sm:w-24 sm:h-24 border-4 border-current rounded-lg flex items-center justify-center">
              <CodeBracketIcon className="w-8 h-8 sm:w-12 sm:h-12" />
                    </div>
                    </div>
        </section>

        {/* CTA Section - Green Theme */}
        <section className="py-12 sm:py-16 bg-gradient-to-r from-green-600 to-green-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8"
            >
              {/* Mobile: Stacked Layout */}
              <div className="block sm:hidden text-center space-y-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <RocketLaunchIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                    Sẵn sàng phiêu lưu và tận hưởng thiên nhiên
                      </h3>
                  <p className="text-green-100 text-base">
                    Hãy cùng chúng tôi khám phá thế giới lập trình đầy thú vị
                      </p>
                        </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (isAuthenticated) {
                      handleNavigation("/courses");
                    } else {
                      navigateWithScrollToTop("/register");
                    }
                  }}
                  className="w-full bg-white text-green-600 px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
                >
                      <span>Khám phá ngay</span>
                  <ArrowRightIcon className="w-5 h-5" />
                </motion.button>
                      </div>

              {/* Desktop: Horizontal Layout */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <RocketLaunchIcon className="w-8 h-8 text-white" />
                    </div>
                  <div className="min-w-0">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2 leading-tight">
                      Sẵn sàng phiêu lưu và tận hưởng thiên nhiên
                    </h3>
                    <p className="text-green-100 text-lg">
                      Hãy cùng chúng tôi khám phá thế giới lập trình đầy thú vị
                    </p>
                  </div>
          </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (isAuthenticated) {
                      handleNavigation("/courses");
                    } else {
                      navigateWithScrollToTop("/register");
                    }
                  }}
                  className="bg-white text-green-600 px-6 lg:px-8 py-3 lg:py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 flex-shrink-0"
                >
                  <span>Khám phá ngay</span>
                  <ArrowRightIcon className="w-5 h-5" />
                </motion.button>
                </div>
              </motion.div>
        </div>
      </section>

        {/* Popular Courses Section */}
        <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className="text-green-600 font-semibold text-base sm:text-lg mb-4">TÍNH NĂNG TUYỆT VỜI</div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Các khóa học thú vị
            </h2>
          </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
                // Loading skeleton
                Array(4).fill(0).map((_, index) => (
                  <div key={index} className="bg-gray-200 animate-pulse rounded-lg h-80"></div>
              ))
            ) : (
                popularCourses.slice(0, 4).map((course, index) => (
                <motion.div
                  key={course.CourseID || index}
                    initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                    className="bg-white rounded-lg overflow-hidden shadow-lg group hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      if (!isAuthenticated) {
                        toast.info("Vui lòng đăng nhập để xem chi tiết khóa học", {
                          position: "top-center",
                          autoClose: 3000
                        });
                        setTimeout(() => {
                          navigate("/login", { 
                            state: { 
                              from: `/courses/${course.CourseID}`,
                              message: "Đăng nhập để xem chi tiết khóa học" 
                            }
                          });
                        }, 1000);
                      } else {
                        handleNavigation(`/courses/${course.CourseID}`);
                      }
                    }}
                >
                    <div className="relative h-48">
                      <img
                        src={course.ImageUrl || `https://images.unsplash.com/photo-${1461749280684 + index}-dccba630e2f6?w=400&h=300&fit=crop`}
                        alt={course.Title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                          MỚI NHẤT
                        </span>
                        </div>
                      </div>
                    <div className="p-4">
                      <div className="flex items-center mb-2">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon 
                            key={i} 
                            className={`w-4 h-4 ${i < Math.floor(course.Rating || 4) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                          />
                        ))}
                        <span className="text-sm text-gray-600 ml-2">{course.Rating || '4.0'}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-2 text-sm line-clamp-2 min-h-[2.5rem]">
                        {course.Title || `Khóa học ${index + 1}`}
                      </h3>
                      <p className="text-gray-600 text-xs mb-3 line-clamp-2 min-h-[2rem]">
                        {course.ShortDescription || `Mô tả khóa học ${index + 1}`}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{course.EnrolledCount || 0} học viên</span>
                        <span className="font-semibold text-green-600">
                          {course.DiscountPrice > 0 
                            ? `${new Intl.NumberFormat('vi-VN').format(course.DiscountPrice)}₫`
                            : course.Price > 0 
                              ? `${new Intl.NumberFormat('vi-VN').format(course.Price)}₫`
                              : 'Miễn phí'
                          }
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
                        </div>
                      </div>
        </section>

        {/* Features Grid Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="flex items-start space-x-4"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckIcon className="w-6 h-6 text-green-600" />
                      </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Chuyên tự do chính</h3>
                  <p className="text-gray-600 text-sm">
                    Tự do chọn thời gian học phù hợp với lịch trình cá nhân và hoạt động khác.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="flex items-start space-x-4"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserGroupIcon className="w-6 h-6 text-green-600" />
                        </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Hướng dẫn viên chuyên nghiệp</h3>
                  <p className="text-gray-600 text-sm">
                    Đội ngũ mentor giàu kinh nghiệm từ các công ty công nghệ hàng đầu.
                  </p>
                        </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="flex items-start space-x-4"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <HeartIcon className="w-6 h-6 text-green-600" />
                      </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Chất lượng dịch vụ cao</h3>
                  <p className="text-gray-600 text-sm">
                    Cam kết chất lượng cao với hệ thống đánh giá và phản hồi liên tục.
                  </p>
                    </div>
                </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
                className="flex items-start space-x-4"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="w-6 h-6 text-green-600" />
        </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Địa điểm đa dạng</h3>
                  <p className="text-gray-600 text-sm">
                    Học tập mọi lúc mọi nơi với nền tảng online hiện đại và tiện lợi.
                  </p>
                  </div>
                </motion.div>

          <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
                className="flex items-start space-x-4"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AcademicCapIcon className="w-6 h-6 text-green-600" />
          </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Trải nghiệm độc đáo</h3>
                  <p className="text-gray-600 text-sm">
                    Phương pháp học tập sáng tạo với AI và công nghệ VR/AR tiên tiến.
                  </p>
                </div>
          </motion.div>

          <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
            viewport={{ once: true }}
                className="flex items-start space-x-4"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="w-6 h-6 text-green-600" />
                  </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Hỗ trợ dịch vụ 24/7</h3>
                  <p className="text-gray-600 text-sm">
                    Đội ngũ hỗ trợ sẵn sàng giải đáp mọi thắc mắc 24/7 qua nhiều kênh.
                  </p>
                </div>
          </motion.div>
          </div>
        </div>
      </section>

        {/* Video Hero Section */}
        <section 
          className="py-20 bg-cover bg-center bg-no-repeat relative"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')`
          }}
        >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Column - Content */}
          <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
                className="text-white"
              >
                <div className="text-green-400 font-semibold text-lg mb-4">BẠN ĐÃ SẴN SÀNG ĐỂ HỌC CHƯA?</div>
                <h2 className="text-4xl lg:text-5xl font-bold mb-8 leading-tight">
                  Sẵn sàng học tập với cuộc
                  <br />
                  phiêu lưu thực sự
            </h2>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePublicNavigation("/courses")}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-3"
                >
                  <PlayIcon className="w-6 h-6" />
                  <span>Bắt đầu ngay</span>
                </motion.button>
          </motion.div>

              {/* Right Column - Features */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="grid grid-cols-2 gap-6"
              >
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserGroupIcon className="w-8 h-8" />
                      </div>
                  <h3 className="font-bold mb-2">Chuyên lập trình</h3>
                  <h3 className="font-bold">ứng dụng thực tế</h3>
                    </div>
                
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LightBulbIcon className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold mb-2">Trải nghiệm</h3>
                  <h3 className="font-bold">Công nghệ tiên tiến</h3>
                </div>
                  
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPinIcon className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold mb-2">Công nghệ tương lai</h3>
                  <h3 className="font-bold">AI và VR/AR</h3>
                </div>
                
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <GlobeAltIcon className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold mb-2">Công nghệ hiện đại</h3>
                  <h3 className="font-bold">Đa dạng</h3>
                </div>
              </motion.div>
          </div>
        </div>
      </section>

        {/* Tech Stack Gallery */}
        <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
              initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
                  viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="text-green-600 font-semibold text-lg mb-4">NHỮNG CÔNG NGHỆ TUYỆT VỜI</div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Công nghệ nổi bật tại Campus Learning
              </h2>
            </motion.div>
              
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Tech Stack Items */}
                  <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=300&h=200&fit=crop"
                  alt="React"
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute top-3 left-3">
                                    <span className="bg-indigo-500 text-white px-2 py-1 rounded text-xs font-bold">
                    10 KHÓA HỌC
                        </span>
                      </div>
                                <div className="absolute bottom-3 left-3 text-white">
                  <h3 className="font-bold text-lg">React.js</h3>
                  <p className="text-xs opacity-90">Frontend Framework</p>
                        </div>
                  </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=300&h=200&fit=crop"
                  alt="Python"
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute top-3 left-3">
                  <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">
                    22 KHÓA HỌC
                  </span>
                      </div>
                                <div className="absolute bottom-3 left-3 text-white">
                  <h3 className="font-bold text-lg">Python</h3>
                  <p className="text-xs opacity-90">AI & Backend</p>
                          </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer"
            >
              <img
                  src="https://www.infoworld.com/wp-content/uploads/2025/05/2263137-0-24139200-1747637392-shutterstock_1361674454-100939444-orig.jpg?quality=50&strip=all"
                  alt="JavaScript"
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute top-3 left-3">
                  <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-bold">
                    28 KHÓA HỌC
                  </span>
                          </div>
                                <div className="absolute bottom-3 left-3 text-white">
                  <h3 className="font-bold text-lg">JavaScript</h3>
                  <p className="text-xs opacity-90">Full-stack Development</p>
                        </div>
            </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&h=200&fit=crop"
                  alt="Node.js"
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute top-3 left-3">
                  <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                    12 KHÓA HỌC
                  </span>
                      </div>
                                <div className="absolute bottom-3 left-3 text-white">
                  <h3 className="font-bold text-lg">Node.js</h3>
                  <p className="text-xs opacity-90">Backend Runtime</p>
                    </div>
              </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1518773553398-650c184e0bb3?w=300&h=200&fit=crop"
                  alt="AI & ML"
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute top-3 left-3">
                  <span className="bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold">
                    8 KHÓA HỌC
                  </span>
                      </div>
                <div className="absolute bottom-3 left-3 text-white">
                  <h3 className="font-bold text-lg">AI & ML</h3>
                  <p className="text-xs opacity-90">Machine Learning</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer"
              >
                <img
                  src="https://phoenixnap.com/glossary/wp-content/uploads/2024/03/what-is-a-website-database.jpg"
                  alt="Database"
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute top-3 left-3">
                  <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">
                    15 KHÓA HỌC
                          </span>
                        </div>
                                <div className="absolute bottom-3 left-3 text-white">
                  <h3 className="font-bold text-lg">Database</h3>
                  <p className="text-xs opacity-90">SQL & NoSQL</p>
                        </div>
            </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=300&h=200&fit=crop"
                  alt="DevOps"
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute top-3 left-3">
                  <span className="bg-cyan-500 text-white px-2 py-1 rounded text-xs font-bold">
                    6 KHÓA HỌC
                  </span>
                      </div>
                                <div className="absolute bottom-3 left-3 text-white">
                  <h3 className="font-bold text-lg">DevOps</h3>
                  <p className="text-xs opacity-90">Cloud & CI/CD</p>
                  </div>
                </motion.div>

              {/* CTA Box */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              viewport={{ once: true }}
                className="bg-green-600 rounded-lg p-6 flex flex-col justify-center items-center text-white cursor-pointer hover:bg-green-700 transition-colors duration-300 h-40"
                onClick={() => handlePublicNavigation("/courses")}
              >
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AcademicCapIcon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-center">Đăng ký khóa học</h3>
                <h3 className="font-bold text-lg mb-4 text-center">với ưu đãi đặc biệt</h3>
                <button className="bg-white text-green-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors">
                  Khám phá ngay
              </button>
            </motion.div>
        </div>
        </div>
      </section>

        {/* Achievement Stats */}
        <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
              initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
              <div className="text-green-600 font-semibold text-lg mb-4">CHUYÊN GIA TUYỆT VỜI</div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Thành tựu đạt được
            </h2>
          </motion.div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-lg shadow-lg"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserGroupIcon className="w-8 h-8 text-green-600" />
                  </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">3500+</div>
                <div className="text-gray-600 font-semibold">Học viên thân thiết</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-lg shadow-lg"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpenIcon className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">1650+</div>
                <div className="text-gray-600 font-semibold">Khóa học hoạt động</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-lg shadow-lg"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HeartIcon className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">99.5%</div>
                <div className="text-gray-600 font-semibold">Đánh giá tốt tuyệt</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-lg shadow-lg"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrophyIcon className="w-8 h-8 text-green-600" />
            </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">62+</div>
                <div className="text-gray-600 font-semibold">Chuyên viên kinh nghiệm</div>
          </motion.div>
          </div>
        </div>
      </section>

        {/* Customer Reviews Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              {/* Left Column - Content */}
          <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
                className="space-y-6"
              >
                <div className="text-green-600 font-semibold text-lg mb-4">CHẤT LƯỢNG DỊCH VỤ</div>
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  Đánh giá tích cực từ
                  <br />
                  khách hàng
            </h2>
                <p className="text-gray-600 leading-relaxed">
                  Đánh giá tích cực từ khách hàng là động lực để chúng tôi tiếp
                  tục cung cấp dịch vụ du lịch tốt nhất. Chúng tôi luôn cố gắng
                  không ngừng nâng cao chất lượng dịch vụ và mang đến những trải
                  nghiệm tuyệt vời cho mọi khách hàng.
            </p>
          </motion.div>

              {/* Right Column - Testimonial Card */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="bg-gray-50 rounded-2xl p-8 relative">
                  {/* Quote Icon */}
                  <div className="absolute top-4 right-4 w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">"</span>
                  </div>
                  
                  {/* Stars */}
                  <div className="flex items-center mb-6">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  
                  {/* Testimonial Text */}
                  <blockquote className="text-gray-800 text-lg leading-relaxed mb-6 italic">
                    "Chúng tôi đã được trải qua những điều tốt đẹp nhất, với các
                    hướng dẫn viên rất chuyên nghiệp và tận tâm. Cảm ơn vì đã mang đến
                    cho chúng tôi những kỷ niệm đáng nhớ!"
                  </blockquote>
                  
                  {/* Author */}
                  <div className="flex items-center">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Jessica_Brown_Findlay_in_2017.png"
                      alt="Jessica Brown"
                      className="w-12 h-12 rounded-full mr-4 object-cover"
                    />
                    <div>
                      <div className="font-bold text-gray-900">Jessica Brown</div>
                      <div className="text-sm text-gray-600">Khách hàng</div>
                      </div>
                    </div>
                  </div>
              </motion.div>
          </div>
        </div>
      </section>

        {/* Blog Articles Section */}
        <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Section Header */}
            <div className="flex justify-between items-end mb-12">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
                <div className="text-green-600 font-semibold text-lg mb-4">TIN TỨC MỚI NHẤT</div>
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
                  Bài viết và tin tức
                  <br />
                  về công nghệ
              </h2>
              </motion.div>
              
              <motion.button
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                onClick={() => handlePublicNavigation("/posts")}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors duration-300"
              >
                Xem tất cả
              </motion.button>
                  </div>

            {/* Blog Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {postsLoading ? (
                // Loading skeleton
                Array(3).fill(0).map((_, index) => (
                  <div key={index} className="bg-gray-200 animate-pulse rounded-xl h-80"></div>
                ))
              ) : blogPosts.length > 0 ? (
                blogPosts.map((post, index) => {
                  // Helper function to get category color based on post type
                  const getCategoryColor = (post) => {
                    if (post.Type) {
                      const colors = {
                        'article': 'bg-blue-500',
                        'question': 'bg-green-500', 
                        'announcement': 'bg-purple-500',
                        'regular': 'bg-orange-500'
                      };
                      return colors[post.Type] || 'bg-gray-500';
                    }
                    // Fallback to tags if available
                    if (post.tags && post.tags.length > 0) {
                      const tag = post.tags[0].Name || post.tags[0];
                      const colors = {
                        'Technology': 'bg-blue-500',
                        'Programming': 'bg-green-500', 
                        'Tutorial': 'bg-purple-500',
                        'News': 'bg-orange-500',
                        'Tips': 'bg-yellow-500'
                      };
                      return colors[tag] || 'bg-gray-500';
                    }
                    return 'bg-gray-500';
                  };

                  // Helper function to get post image
                  const getPostImage = (media) => {
                    if (media && media.length > 0 && media[0].MediaUrl) {
                      return media[0].MediaUrl;
                    }
                    // Fallback images based on index
                    const fallbackImages = [
                      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop",
                      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=250&fit=crop", 
                      "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=400&h=250&fit=crop"
                    ];
                    return fallbackImages[index % 3];
                  };

                  // Helper function to format date
                  const formatDate = (dateString) => {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('vi-VN', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    });
                  };

                  // Helper function to extract excerpt from content
                  const getExcerpt = (content) => {
                    if (!content) return 'Nội dung bài viết...';
                    // Remove HTML tags and limit to 100 characters
                    const text = content.replace(/<[^>]*>/g, '');
                    return text.length > 100 ? text.substring(0, 100) + '...' : text;
                  };

                  return (
                    <motion.article
                      key={post.PostID}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
                      className="bg-white rounded-xl overflow-hidden shadow-lg group hover:shadow-xl transition-all duration-300 cursor-pointer"
                      onClick={() => {
                        if (!isAuthenticated) {
                          toast.info("Vui lòng đăng nhập để xem chi tiết bài viết", {
                            position: "top-center",
                            autoClose: 3000
                          });
                          setTimeout(() => {
                            navigate("/login", { 
                              state: { 
                                from: `/posts?postId=${post.PostID}`,
                                message: "Đăng nhập để xem chi tiết bài viết" 
                              }
                            });
                          }, 1000);
                        } else {
                          handleNavigation(`/posts?postId=${post.PostID}`);
                        }
                      }}
                    >
                      <div className="relative">
                        <img
                          src={getPostImage(post.media)}
                          alt={post.Content ? post.Content.substring(0, 50) : 'Bài viết'}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3">
                          <span className={`${getCategoryColor(post)} text-white px-2 py-1 rounded text-xs font-bold`}>
                            {post.Type === 'article' && 'Bài viết' ||
                             post.Type === 'question' && 'Câu hỏi' ||
                             post.Type === 'announcement' && 'Thông báo' ||
                             post.Type === 'regular' && 'Chia sẻ' ||
                             (post.tags && post.tags.length > 0 ? (post.tags[0].Name || post.tags[0]) : 'Bài viết')}
                          </span>
                </div>
                        <div className="absolute top-3 right-3">
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">
                            {formatDate(post.CreatedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center text-xs text-gray-500 mb-3">
                          <UserGroupIcon className="w-4 h-4 mr-1" />
                          <span className="mr-4">{post.FullName || post.Username || 'Tác giả'}</span>
                          <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" />
                          <span>{post.CommentsCount || 0} Comments</span>
                        </div>
                        <h3 className="font-bold text-gray-900 mb-3 line-clamp-2">
                          {post.Title || 
                           (post.Content ? 
                             (post.Content.length > 60 ? post.Content.substring(0, 60) + '...' : post.Content) : 
                             `Bài viết ${index + 1}`)}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {getExcerpt(post.Content)}
                        </p>
                        <button className="text-green-600 font-semibold text-sm hover:text-green-700 transition-colors">
                          Xem thêm →
                        </button>
                      </div>
                    </motion.article>
                  );
                })
              ) : (
                // No posts fallback
                <div className="col-span-3 text-center py-12">
                  <p className="text-gray-500">Hiện tại chưa có bài viết nào.</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {!isAuthenticated 
                      ? "Đăng nhập để xem thêm bài viết hoặc tạo bài viết mới."
                      : "Hãy tạo bài viết đầu tiên của bạn!"
                    }
                  </p>
                  {!isAuthenticated && (
                    <button
                      onClick={() => navigate("/login")}
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Đăng nhập ngay
                    </button>
                  )}
                </div>
              )}
          </div>
        </div>
      </section>

        {/* IT Learning Gallery Section */}
        <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="text-green-600 font-semibold text-lg mb-4">TRẢI NGHIỆM HỌC TẬP</div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Không gian học tập IT hiện đại
              </h2>
                  </motion.div>
            
            {/* Gallery Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              
              {/* Large Image 1 - Programming */}
                  <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                className="col-span-2 md:col-span-2 row-span-2 relative group overflow-hidden rounded-lg cursor-pointer"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=600&fit=crop"
                  alt="Programming Workspace"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="font-bold text-xl">Frontend Development</h3>
                  <p className="text-sm opacity-90">HTML, CSS, JavaScript</p>
              </div>
                  </motion.div>

              {/* Small Image 1 - Code Editor */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
            >
              <img
                  src="https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=300&h=300&fit=crop"
                  alt="Code Editor"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <p className="text-xs font-semibold">Code Editor</p>
              </div>
            </motion.div>

              {/* Small Image 2 - AI/ML */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
            >
              <img
                  src="https://images.unsplash.com/photo-1518773553398-650c184e0bb3?w=300&h=300&fit=crop"
                  alt="AI Machine Learning"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <p className="text-xs font-semibold">AI & ML</p>
          </div>
            </motion.div>

              {/* Small Image 3 - Mobile Development */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=300&h=300&fit=crop"
                  alt="Mobile Development"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <p className="text-xs font-semibold">Mobile Dev</p>
          </div>
              </motion.div>

              {/* Small Image 4 - Database */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://cloud-web-cms-beta.s3.cloud.cmctelecom.vn/cac_loai_data_base_602449a39f.jpeg"
                  alt="Database Management"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <p className="text-xs font-semibold">Database</p>
              </div>
            </motion.div>

              {/* Large Image 2 - Team Collaboration */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true }}
                className="col-span-2 md:col-span-2 row-span-2 relative group overflow-hidden rounded-lg cursor-pointer"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=600&fit=crop"
                  alt="Team Collaboration"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="font-bold text-xl">Team Collaboration</h3>
                  <p className="text-sm opacity-90">Agile & Project Management</p>
              </div>
            </motion.div>

              {/* Small Image 5 - Cloud Computing */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=300&h=300&fit=crop"
                  alt="Cloud Computing"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <p className="text-xs font-semibold">Cloud & DevOps</p>
          </div>
              </motion.div>

              {/* Small Image 6 - Cybersecurity */}
          <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
            viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=300&h=300&fit=crop"
                  alt="Cybersecurity"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <p className="text-xs font-semibold">Cybersecurity</p>
        </div>
              </motion.div>

              {/* CTA Box */}
          <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48 bg-gradient-to-br from-green-600 to-green-700 flex flex-col justify-center items-center text-white p-4"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <div className="text-center">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CodeBracketIcon className="w-6 h-6" />
            </div>
                  <div className="font-bold text-sm mb-1">Bắt đầu học</div>
                  <div className="font-bold text-sm">NGAY HÔM NAY</div>
                </div>
              </motion.div>

                            {/* Small Image 7 - Data Science */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                viewport={{ once: true }}
                className="relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&h=300&fit=crop"
                  alt="Data Science"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <p className="text-xs font-semibold">Data Science</p>
            </div>
              </motion.div>

              {/* Horizontal Image - UI/UX Design */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 1.0 }}
                viewport={{ once: true }}
                className="col-span-2 relative group overflow-hidden rounded-lg cursor-pointer h-32 md:h-48"
                onClick={() => handlePublicNavigation("/courses")}
              >
                <img
                  src="https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=600&h=300&fit=crop"
                  alt="UI/UX Design & Web Development"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="font-bold text-lg">UI/UX Design</h3>
                  <p className="text-sm opacity-90">Creative & User Experience</p>
            </div>
          </motion.div>
            </div>
        </div>
      </section>
    </main>
    </>
  )
}

export default Home
