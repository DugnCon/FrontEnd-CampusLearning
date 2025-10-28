import {
  ArrowLeftIcon,
  ArrowPathIcon,
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ClockIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  UserCircleIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components';
import { useAuth } from '@/contexts/AuthContext'; // ĐÚNG ĐƯỜNG DẪN

const API_URL = import.meta.env.VITE_API_URL;

const Friends = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const userId = queryParams.get('userId');

  // LẤY USER TỪ AUTH CONTEXT
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id || currentUser?.userID;

  // State
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem('friendsActiveTab');
    return savedTab || 'all';
  });
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState({ type: null, message: null });
  const [viewingUser, setViewingUser] = useState(null);
  const [isOwnFriends, setIsOwnFriends] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchDiff, setTouchDiff] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [mobileSearchVisible, setMobileSearchVisible] = useState(false);

  // === QUẢN LÝ CACHE THEO USER ===
  const getCacheKey = (type) => {
    if (!currentUserId) return null;
    return `${type}_${currentUserId}`;
  };

  const getCachedData = (type) => {
    const key = getCacheKey(type);
    if (!key) return [];
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  };

  const setCachedData = (type, data) => {
    const key = getCacheKey(type);
    if (key) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  // Load cache khi user thay đổi
  useEffect(() => {
    if (currentUserId) {
      setFriends(getCachedData('friends'));
      setPendingRequests(getCachedData('pendingRequests'));
      setSentRequests(getCachedData('sentRequests'));
    } else {
      setFriends([]);
      setPendingRequests([]);
      setSentRequests([]);
    }
  }, [currentUserId]);

  // === END CACHE ===

  // Handle resize
  useEffect(() => {
    const handleResize = () => setShowSidebar(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fix viewport height
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  const fetchFriendships = useCallback(async () => {
    if (!currentUserId) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);

      if (!isOnline) {
        showNotification('error', 'Không có kết nối mạng. Hiển thị dữ liệu đã lưu.');
        setLoading(false);
        return;
      }

      let endpoint = `${API_URL}/friendships`;
      if (userId) endpoint = `${API_URL}/friendships/user/${userId}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { state: { message: 'Phiên đăng nhập đã hết hạn' } });
        return;
      }

      if (!response.ok) throw new Error('Không thể tải danh sách bạn bè');

      const data = await response.json();

      if (userId) {
        setFriends(data);
      } else {
        const friendsList = data?.friends || [];
        const pendingList = data?.pendingRequests || [];
        const sentList = data?.sentRequests || [];

        setFriends(friendsList);
        setPendingRequests(pendingList);
        setSentRequests(sentList);

        // Lưu cache theo user
        setCachedData('friends', friendsList);
        setCachedData('pendingRequests', pendingList);
        setCachedData('sentRequests', sentList);
        localStorage.setItem('friendsLastFetched', Date.now().toString());
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching friendships:', err);
        setError(err.message);
      }
      // Fallback cache
      setFriends(getCachedData('friends'));
      setPendingRequests(getCachedData('pendingRequests'));
      setSentRequests(getCachedData('sentRequests'));
    } finally {
      setLoading(false);
    }
  }, [userId, navigate, isOnline, currentUserId]);

  // Search users
  const searchUsers = useCallback(async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      searchTimeoutRef.current = setTimeout(async () => {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/login');

        const response = await fetch(`${API_URL}/users/search?query=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }

        if (!response.ok) throw new Error('Không thể tìm kiếm');

        const data = await response.json();
        const friendIds = new Set(friends.map(f => f.userID));
        const pendingIds = new Set(pendingRequests.map(p => p.userID));
        const sentIds = new Set(sentRequests.map(s => s.userID));

        const filtered = data.filter(user =>
          user.userID !== currentUserId &&
          !friendIds.has(user.userID) &&
          !pendingIds.has(user.userID) &&
          !sentIds.has(user.userID)
        );

        setSearchResults(filtered);
        if (filtered.length > 0) setActiveTab('search');
      }, 500);
    } catch (err) {
      showNotification('error', 'Không thể tìm kiếm');
    } finally {
      setSearchLoading(false);
    }
  }, [friends, pendingRequests, sentRequests, currentUserId, navigate]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    searchUsers(value);
  };

  useEffect(() => {
    if (userId) {
      fetchUserInfo();
      setIsOwnFriends(false);
      setActiveTab('all');
    } else {
      setIsOwnFriends(true);
    }
    fetchFriendships();
  }, [userId, fetchFriendships]);

  useEffect(() => {
    if (activeTab === 'suggestions' && isOwnFriends && suggestions.length === 0) {
      fetchSuggestions();
    }
  }, [activeTab, isOwnFriends]);

  useEffect(() => {
    if (activeTab === 'pending' && isOwnFriends) {
      fetchFriendships();
    }
  }, [activeTab, isOwnFriends, fetchFriendships]);

  useEffect(() => {
    if (activeTab === 'sent' && isOwnFriends) {
      fetchFriendships();
    }
  }, [activeTab, isOwnFriends, fetchFriendships]);

  const fetchSentRequestsOnly = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      const res = await fetch(`${API_URL}/friendships`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      return data.sentRequests || [];
    } catch {
      return getCachedData('sentRequests');
    }
  };

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setViewingUser(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/friendships/suggestions/random`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const loadMoreSuggestions = async () => {
    await fetchSuggestions();
  };

  const acceptFriendRequest = async (userId) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/friendships/${userId}/accept`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();

      const user = pendingRequests.find(u => u.userID === userId);
      const newFriends = [...friends, user];
      const newPending = pendingRequests.filter(u => u.userID !== userId);

      setFriends(newFriends);
      setPendingRequests(newPending);
      setCachedData('friends', newFriends);
      setCachedData('pendingRequests', newPending);

      showNotification('success', 'Đã chấp nhận lời mời');
    } catch {
      showNotification('error', 'Không thể chấp nhận');
    } finally {
      setActionLoading(false);
    }
  };

  const rejectFriendRequest = async (userId) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/friendships/${userId}/reject`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();

      const newPending = pendingRequests.filter(u => u.userID !== userId);
      setPendingRequests(newPending);
      setCachedData('pendingRequests', newPending);

      showNotification('success', 'Đã từ chối');
    } catch {
      showNotification('error', 'Không thể từ chối');
    } finally {
      setActionLoading(false);
    }
  };

  const cancelFriendRequest = async (userId) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/friendships/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();

      const newSent = sentRequests.filter(u => u.userID !== userId);
      setSentRequests(newSent);
      setCachedData('sentRequests', newSent);

      showNotification('success', 'Đã hủy lời mời');
    } catch {
      showNotification('error', 'Không thể hủy');
    } finally {
      setActionLoading(false);
    }
  };

  const removeFriend = async (userId) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/friendships/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();

      const newFriends = friends.filter(u => u.userID !== userId);
      setFriends(newFriends);
      setCachedData('friends', newFriends);

      showNotification('success', 'Đã hủy kết bạn');
    } catch {
      showNotification('error', 'Không thể hủy');
    } finally {
      setActionLoading(false);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');

      console.log('GỬI LỜI MỜI:', { requesterId: currentUserId, addresseeId: userId });

      const res = await fetch(`${API_URL}/friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ addresseeId: userId })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Lỗi API:', err);
        throw new Error();
      }

      const data = await res.json();
      const requestedUser = suggestions.find(u => u.userID === userId) || searchResults.find(u => u.userID === userId);

      if (requestedUser) {
        const newRequest = {
          ...requestedUser,
          FriendshipID: data.friendship.friendshipID,
          Status: 'pending',
          CreatedAt: data.friendship.requestedAt
        };
        const newSent = [...sentRequests, newRequest];
        setSentRequests(newSent);
        setCachedData('sentRequests', newSent);

        setSuggestions(suggestions.filter(u => u.userID !== userId));
      }

      setTimeout(async () => {
        const updated = await fetchSentRequestsOnly();
        setSentRequests(updated);
        setCachedData('sentRequests', updated);
      }, 800);

      showNotification('success', 'Đã gửi lời mời');
    } catch (err) {
      console.error('Lỗi gửi lời mời:', err);
      showNotification('error', 'Không thể gửi lời mời');
    } finally {
      setActionLoading(false);
    }
  };

  const navigateToProfile = (id) => navigate(`/profile/${id}`);
  const navigateToChat = (user) => {
    navigate('/chat', {
      state: {
        selectedUser: {
          UserID: user.userID,
          FullName: user.fullName || user.username,
          Username: user.username,
          Image: user.image || user.avatar
        },
        source: 'friends'
      }
    });
  };

  const showNotification = (type, msg) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification({ type: null, message: null }), 3000);
  };

  const navigateBack = () => navigate(userId ? `/profile/${userId}` : '/profile');

  const filterUsers = (users) => {
    if (!searchTerm.trim()) return users;
    return users.filter(u =>
      [u.fullName, u.username, u.school].some(field =>
        field?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  };

  // Pull to refresh
  useEffect(() => {
    const handleTouchStart = (e) => window.scrollY === 0 && setTouchStartY(e.touches[0].clientY);
    const handleTouchMove = (e) => touchStartY > 0 && window.scrollY === 0 && setTouchDiff(Math.min(e.touches[0].clientY - touchStartY, 100));
    const handleTouchEnd = () => { if (touchDiff > 70) handleRefresh(); setTouchStartY(0); setTouchDiff(0); };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStartY, touchDiff]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFriendships();
    if (activeTab === 'suggestions') await fetchSuggestions();
    setIsRefreshing(false);
    setLastRefreshed(new Date());
  };

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  useEffect(() => {
    if (!isOwnFriends || activeTab !== 'pending' || !isOnline) return;
    const check = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/friendships`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const newPending = data.pendingRequests || [];
        if (newPending.length > pendingRequests.length) {
          setPendingRequests(newPending);
          setCachedData('pendingRequests', newPending);
          showNotification('success', `Bạn có ${newPending.length - pendingRequests.length} lời mời mới`);
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [activeTab, isOwnFriends, isOnline, pendingRequests.length]);

  useEffect(() => {
    sessionStorage.setItem('friendsActiveTab', activeTab);
  }, [activeTab]);

  if (loading && friends.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Đang tải...</p>
        </div>
      </div>
    );
  }

  const displayedUsers = activeTab === 'all' ? friends :
    activeTab === 'pending' ? pendingRequests :
    activeTab === 'sent' ? sentRequests :
    activeTab === 'suggestions' ? suggestions :
    activeTab === 'search' ? searchResults : [];

  const filteredUsers = activeTab !== 'search' ? filterUsers(displayedUsers) : displayedUsers;
  const showTabLoading = (activeTab === 'suggestions' && suggestionsLoading) || (activeTab === 'search' && searchLoading);
  const showSentLoading = activeTab === 'sent' && loading;

  return (
    <div className="w-full min-h-screen bg-gray-50/50" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Network & Notifications */}
      {!isOnline && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-700 px-4 py-2 rounded-full text-sm shadow-md border border-red-100 z-50 flex items-center">
          <ExclamationCircleIcon className="h-5 w-5 mr-2" />
          <span>Không có mạng - Dữ liệu từ bộ nhớ</span>
        </div>
      )}
      {notification.message && (
        <div className={`fixed top-4 right-4 ${notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} px-6 py-4 rounded-xl shadow-lg z-50 flex items-center justify-between backdrop-blur-sm border max-w-md`}>
          <div className="flex items-center">
            {notification.type === 'success' ? <CheckIcon className="h-5 w-5 mr-3 text-green-500" /> : <ExclamationCircleIcon className="h-5 w-5 mr-3 text-red-500" />}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification({ type: null, message: null })}><XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
      )}
      {lastRefreshed && !isRefreshing && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-gray-500 shadow-sm border z-40">
          Cập nhật: {lastRefreshed.toLocaleTimeString()}
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={navigateBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl"><ArrowLeftIcon className="h-5 w-5" /></button>
            <h1 className="ml-2 text-lg font-bold">Bạn bè</h1>
          </div>
          <div className="flex items-center">
            <button onClick={() => setMobileSearchVisible(!mobileSearchVisible)} className="p-2 mr-1 text-gray-600 hover:bg-gray-100 rounded-xl"><MagnifyingGlassIcon className="h-5 w-5" /></button>
            <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 mr-1 text-gray-600 hover:bg-gray-100 rounded-xl"><ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
            <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl"><Bars3Icon className="h-5 w-5" /></button>
          </div>
        </div>
        {mobileSearchVisible && (
          <div className="px-3 pb-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex h-screen md:pt-0 pt-16" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        {/* Sidebar */}
        <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static top-0 left-0 bottom-0 z-30 md:w-80 w-3/4 bg-white border-r flex flex-col h-full md:pt-0 pt-16`}>
          {isRefreshing && <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"><div className="h-full bg-blue-300 animate-pulse w-1/3"></div></div>}
          <div className="md:hidden absolute top-4 right-4"><button onClick={() => setShowSidebar(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl"><XMarkIcon className="h-5 w-5" /></button></div>

          <div className="p-4 md:p-6 border-b">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <button onClick={navigateBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl md:block hidden"><ArrowLeftIcon className="h-5 w-5" /></button>
              <h1 className="text-xl font-bold md:block hidden">Bạn bè</h1>
              <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl md:block hidden"><ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="relative md:block hidden">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50" placeholder="Tìm kiếm..." value={searchTerm} onChange={handleSearchChange} />
            </div>
          </div>

          {isOwnFriends && (
            <div className="p-2 md:p-3 overflow-auto">
              <nav className="space-y-1">
                {[
                  { id: 'all', icon: UsersIcon, label: 'Tất cả bạn bè', count: friends.length },
                  { id: 'pending', icon: ClockIcon, label: 'Lời mời nhận', count: pendingRequests.length },
                  { id: 'sent', icon: UserPlusIcon, label: 'Đã gửi', count: sentRequests.length },
                  { id: 'suggestions', icon: SparklesIcon, label: 'Gợi ý', count: null },
                  { id: 'search', icon: MagnifyingGlassIcon, label: 'Tìm kiếm', count: searchResults.length > 0 ? searchResults.length : null }
                ].map(tab => (
                  <button key={tab.id} className={`w-full px-3 md:px-4 py-3 rounded-xl font-medium flex items-center justify-between ${activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => { setActiveTab(tab.id); if (window.innerWidth < 768) setShowSidebar(false); }}>
                    <div className="flex items-center">
                      <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'} mr-2 md:mr-3`} />
                      <span className="text-sm md:text-base">{tab.label}</span>
                    </div>
                    {tab.count !== null && <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg text-xs ${activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{tab.count}</span>}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>

        {showSidebar && window.innerWidth < 768 && <div className="fixed inset-0 bg-black bg-opacity-50 z-20" onClick={() => setShowSidebar(false)}></div>}

        {/* Main Content */}
        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          {isRefreshing && <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"><div className="h-full bg-blue-300 animate-pulse w-1/3"></div></div>}
          <div className="p-3 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold">
                {activeTab === 'all' && 'Tất cả bạn bè'}
                {activeTab === 'pending' && 'Lời mời kết bạn'}
                {activeTab === 'sent' && 'Lời mời đã gửi'}
                {activeTab === 'suggestions' && 'Gợi ý kết bạn'}
                {activeTab === 'search' && 'Kết quả tìm kiếm'}
              </h2>
              {activeTab === 'suggestions' && <button onClick={loadMoreSuggestions} className="flex items-center px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100"><ArrowPathIcon className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Tải thêm</span><span className="sm:hidden">Tải</span></button>}
              {activeTab === 'sent' && <button onClick={() => { setLoading(true); fetchFriendships().finally(() => setLoading(false)); }} className="flex items-center px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100"><ArrowPathIcon className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Làm mới</span><span className="sm:hidden">Làm mới</span></button>}
            </div>

            {(showTabLoading || showSentLoading) && (
              <div className="flex items-center justify-center h-40 md:h-64">
                <div className="flex flex-col items-center space-y-3 md:space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 md:h-10 md:w-10 border-[3px] border-blue-600 border-t-transparent"></div>
                  <p className="text-sm text-gray-500 font-medium">Đang tải...</p>
                </div>
              </div>
            )}

            {/* User List */}
            {!showTabLoading && !showSentLoading && filteredUsers.length > 0 && (
              <>
                {/* Mobile List */}
                <div className="grid grid-cols-1 gap-3 sm:hidden px-2">
                  {filteredUsers.map(user => (
                    <div key={user.userID} className="bg-white rounded-xl p-4 border flex items-center gap-4">
                      <Avatar src={user.image || user.avatar} name={user.fullName || user.username} size="lg" className="rounded-xl" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate text-base">{user.fullName || user.username}</div>
                        <div className="text-sm text-gray-500 truncate mb-1">@{user.username}</div>
                        <div className="flex items-center text-xs text-gray-400 mb-3">
                          <div className={`h-2.5 w-2.5 rounded-full mr-1.5 ${user.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          {user.status === 'ONLINE' ? 'Đang hoạt động' : 'Ngoại tuyến'}
                        </div>
                        {isOwnFriends && (
                          <div className="flex gap-2">
                            {activeTab === 'all' && (
                              <>
                                <button onClick={() => navigateToChat(user)} className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center font-medium"><ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" /> Nhắn tin</button>
                                <button onClick={() => removeFriend(user.userID)} className="px-3 py-2 text-sm border border-red-100 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center font-medium"><UserMinusIcon className="h-4 w-4" /></button>
                              </>
                            )}
                            {activeTab === 'pending' && (
                              <>
                                <button onClick={() => acceptFriendRequest(user.userID)} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium"><CheckIcon className="h-4 w-4 mr-1.5" /> Đồng ý</button>
                                <button onClick={() => rejectFriendRequest(user.userID)} className="flex-1 px-3 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center font-medium"><XMarkIcon className="h-4 w-4 mr-1.5" /> Từ chối</button>
                              </>
                            )}
                            {activeTab === 'sent' && (
                              <>
                                <div className="flex items-center text-xs text-gray-400 mb-2"><ClockIcon className="h-4 w-4 mr-1" /> Đã gửi: {new Date(user.CreatedAt || Date.now()).toLocaleDateString('vi-VN')}</div>
                                <button onClick={() => cancelFriendRequest(user.userID)} className="flex-1 px-3 py-2 text-sm border border-red-100 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center font-medium"><XMarkIcon className="h-4 w-4 mr-1.5" /> Hủy</button>
                              </>
                            )}
                            {(activeTab === 'suggestions' || activeTab === 'search') && (
                              <button onClick={() => sendFriendRequest(user.userID)} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium"><UserPlusIcon className="h-4 w-4 mr-1.5" /> Kết bạn</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Grid */}
                <div className={`hidden sm:grid ${activeTab === 'sent' ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'} gap-4 md:gap-6`}>
                  {filteredUsers.map(user => (
                    <div key={user.userID} className={`bg-white rounded-xl ${activeTab === 'sent' ? 'p-5 md:p-6' : 'p-4 md:p-5'} border hover:shadow-md transition-all group`}>
                      <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                        <div className="relative">
                          <Avatar src={user.image || user.avatar} name={user.fullName || user.username} size="xl" className="rounded-2xl" />
                          <div className={`absolute -bottom-1 -right-1 h-4 w-4 md:h-5 md:w-5 rounded-full border-2 border-white ${user.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        </div>
                        <div className="flex-1 w-full">
                          <div className="cursor-pointer mb-2" onClick={() => navigateToProfile(user.userID)}>
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate text-base md:text-lg">{user.fullName || user.username}</h3>
                            <p className="text-sm md:text-base text-gray-500 truncate">@{user.username}</p>
                            {user.school && <p className="text-xs md:text-sm text-gray-500 mt-1 truncate">{user.school}</p>}
                          </div>
                          <div className="flex items-center justify-center text-xs md:text-sm text-gray-400 mb-3 md:mb-4">
                            <div className={`h-2.5 w-2.5 rounded-full mr-1.5 ${user.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            {user.status === 'ONLINE' ? 'Đang hoạt động' : 'Ngoại tuyến'}
                          </div>
                          <div className="flex flex-col space-y-2">
                            {isOwnFriends && (
                              <>
                                {activeTab === 'sent' && (
                                  <>
                                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 mb-2"><ClockIcon className="h-4 w-4" /> <span>Đã gửi: {new Date(user.CreatedAt || Date.now()).toLocaleDateString('vi-VN')}</span></div>
                                    <button onClick={() => cancelFriendRequest(user.userID)} className="w-full px-4 py-2.5 text-sm border border-red-100 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center"><XMarkIcon className="h-4 w-4 mr-2" /> Hủy lời mời</button>
                                  </>
                                )}
                                {activeTab === 'all' && (
                                  <>
                                    <button onClick={() => navigateToChat(user)} className="w-full px-4 py-2.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center font-medium"><ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" /> Nhắn tin</button>
                                    <button onClick={() => removeFriend(user.userID)} className="w-full px-4 py-2.5 text-sm border border-red-100 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center font-medium"><UserMinusIcon className="h-4 w-4 mr-2" /> Hủy kết bạn</button>
                                  </>
                                )}
                                {activeTab === 'pending' && (
                                  <>
                                    <button onClick={() => acceptFriendRequest(user.userID)} className="w-full px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium"><CheckIcon className="h-4 w-4 mr-2" /> Đồng ý</button>
                                    <button onClick={() => rejectFriendRequest(user.userID)} className="w-full px-4 py-2.5 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center font-medium"><XMarkIcon className="h-4 w-4 mr-2" /> Từ chối</button>
                                  </>
                                )}
                                {(activeTab === 'suggestions' || activeTab === 'search') && (
                                  <button onClick={() => sendFriendRequest(user.userID)} className="w-full px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium"><UserPlusIcon className="h-4 w-4 mr-2" /> Kết bạn</button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Empty State */}
            {!showTabLoading && !showSentLoading && filteredUsers.length === 0 && (
              <div className="text-center py-12 md:py-16">
                <div className="bg-gray-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5">
                  <UserCircleIcon className="h-8 w-8 md:h-10 md:w-10 text-gray-400" />
                </div>
                <h3 className="text-lg md:text-xl font-medium text-gray-900 mb-2 md:mb-3">
                  {activeTab === 'all' ? 'Chưa có bạn bè nào' : activeTab === 'pending' ? 'Không có lời mời nào' : activeTab === 'sent' ? 'Chưa gửi lời mời nào' : activeTab === 'suggestions' ? 'Chưa có gợi ý' : 'Không tìm thấy'}
                </h3>
                <p className="text-sm md:text-base text-gray-500 max-w-sm md:max-w-md mx-auto">
                  {activeTab === 'all' ? 'Hãy kết bạn để mở rộng mạng lưới.' : activeTab === 'pending' ? 'Bạn chưa có lời mời nào.' : activeTab === 'sent' ? 'Bạn chưa gửi lời mời cho ai.' : activeTab === 'suggestions' ? 'Chúng tôi sẽ gợi ý sớm.' : 'Thử tìm kiếm khác.'}
                </p>
                {activeTab === 'sent' && (
                  <button onClick={() => { setLoading(true); fetchFriendships().finally(() => setLoading(false)); }} className="mt-4 md:mt-5 px-5 py-2.5 text-sm md:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
                    Làm mới danh sách
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 md:hidden">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'all', icon: UsersIcon, label: 'Bạn bè' },
            { id: 'pending', icon: ClockIcon, label: 'Lời mời', badge: pendingRequests.length },
            { id: 'suggestions', icon: SparklesIcon, label: 'Gợi ý' },
            { id: 'sent', icon: UserPlusIcon, label: 'Đã gửi', badge: sentRequests.length }
          ].map(tab => (
            <button key={tab.id} className={`flex flex-col items-center justify-center px-2 py-1 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab(tab.id)}>
              <div className="relative">
                <tab.icon className="h-5 w-5" />
                {tab.badge > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{tab.badge}</span>}
              </div>
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const style = document.createElement('style');
style.innerHTML = `
  @keyframes fadeDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  .animate-fadeDown { animation: fadeDown 0.2s ease-out; }
`;
document.head.appendChild(style);

export default Friends;