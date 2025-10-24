/*-----------------------------------------------------------------
* File: index.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
"use client"

import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { fetchEvents, setFilters, clearCurrentEvent } from "@/store/slices/eventSlice"
import { motion } from "framer-motion"
import {
  CalendarDaysIcon,
  XMarkIcon,
  ChevronDownIcon,
  ClockIcon,
  RocketLaunchIcon,
  SparklesIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
  ServerIcon,
  MagnifyingGlassIcon,
  ArrowUpRightIcon,
  StarIcon,
  BoltIcon,
  FireIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline"
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid"

// === HÀM CHUẨN HÓA DỮ LIỆU TỪ API ===
const normalizeEvent = (apiEvent) => {
  if (!apiEvent) return null

  return {
    EventID: apiEvent.eventID ?? apiEvent.EventID,
    Title: apiEvent.title ?? apiEvent.Title,
    Description: apiEvent.description ?? apiEvent.Description,
    Category: apiEvent.category ?? apiEvent.Category,
    EventDate: apiEvent.eventDate ?? apiEvent.EventDate,
    EventTime: apiEvent.eventTime ?? apiEvent.EventTime,
    Location: apiEvent.location ?? apiEvent.Location,
    ImageUrl: apiEvent.imageUrl ?? apiEvent.ImageUrl,
    Organizer: apiEvent.organizer ?? apiEvent.Organizer,
    Difficulty: apiEvent.difficulty ?? apiEvent.Difficulty,
    Status: apiEvent.status ?? apiEvent.Status,
    MaxAttendees: apiEvent.maxAttendees,
    CurrentAttendees: apiEvent.currentAttendees,
    Price: apiEvent.price,
  }
}

// Difficulty Badge
const DifficultyBadge = ({ difficulty }) => {
  const badges = {
    beginner: { icon: <StarIcon className="w-3.5 h-3.5" />, label: "Beginner", class: "bg-white text-purple-700 border border-purple-200 shadow-sm" },
    intermediate: { icon: <StarIconSolid className="w-3.5 h-3.5" />, label: "Intermediate", class: "bg-white text-amber-700 border border-amber-200 shadow-sm" },
    advanced: { icon: <BoltIcon className="w-3.5 h-3.5" />, label: "Advanced", class: "bg-white text-orange-700 border border-orange-200 shadow-sm" },
    expert: { icon: <FireIcon className="w-3.5 h-3.5" />, label: "Expert", class: "bg-white text-red-700 border border-red-200 shadow-sm" },
  }

  const badge = badges[difficulty?.toLowerCase()] || badges.beginner
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${badge.class}`}>
      {badge.icon} {badge.label}
    </span>
  )
}

// Status Badge
const StatusBadge = ({ status }) => {
  const badges = {
    upcoming: { label: "Sắp diễn ra", class: "bg-white text-blue-700 border border-blue-200 shadow-sm" },
    ongoing: { label: "Đang diễn ra", class: "bg-white text-purple-700 border border-purple-200 shadow-sm" },
    completed: { label: "Đã kết thúc", class: "bg-white text-gray-700 border border-gray-200 shadow-sm" },
    cancelled: { label: "Đã hủy", class: "bg-white text-red-700 border border-red-200 shadow-sm" },
  }

  const badge = badges[status?.toLowerCase()] || badges.upcoming
  return <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${badge.class}`}>{badge.label}</span>
}

// Category Chip
const CategoryChip = ({ category }) => {
  const categories = {
    "Competitive Programming": { icon: <RocketLaunchIcon className="w-3.5 h-3.5" />, class: "bg-white text-purple-700 border border-purple-200 shadow-sm" },
    Hackathon: { icon: <ClockIcon className="w-3.5 h-3.5" />, class: "bg-white text-blue-700 border border-blue-200 shadow-sm" },
    "Web Development": { icon: <ComputerDesktopIcon className="w-3.5 h-3.5" />, class: "bg-white text-indigo-700 border border-indigo-200 shadow-sm" },
    "AI/ML": { icon: <SparklesIcon className="w-3.5 h-3.5" />, class: "bg-white text-pink-700 border border-pink-200 shadow-sm" },
    "Mobile Development": { icon: <DevicePhoneMobileIcon className="w-3.5 h-3.5" />, class: "bg-white text-cyan-700 border border-cyan-200 shadow-sm" },
    DevOps: { icon: <ServerIcon className="w-3.5 h-3.5" />, class: "bg-white text-emerald-700 border border-emerald-200 shadow-sm" },
    Security: { icon: <ShieldCheckIcon className="w-3.5 h-3.5" />, class: "bg-white text-red-700 border border-red-200 shadow-sm" },
  }

  const chip = categories[category] || { icon: <AcademicCapIcon className="w-3.5 h-3.5" />, class: "bg-white text-gray-700 border border-gray-200 shadow-sm" }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${chip.class}`}>
      {chip.icon} {category}
    </span>
  )
}

// Skeleton Card
const EventCardSkeleton = () => (
  <div className="bg-white rounded-xl overflow-hidden animate-pulse border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col">
    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative"></div>
    <div className="p-4 sm:p-5 space-y-2 sm:space-y-3 flex-1 flex flex-col">
      <div className="h-3 sm:h-4 bg-gray-100 rounded-md w-1/2 mb-1"></div>
      <div className="h-4 sm:h-5 bg-gray-200 rounded-md w-4/5"></div>
      <div className="h-3 sm:h-4 bg-gray-100 rounded-md w-full"></div>
      <div className="h-3 sm:h-4 bg-gray-100 rounded-md w-2/3"></div>
      <div className="flex items-center gap-2 mt-2">
        <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-gray-200"></div>
        <div className="h-2 sm:h-3 bg-gray-100 rounded-md w-12"></div>
        <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-gray-200"></div>
        <div className="h-2 sm:h-3 bg-gray-100 rounded-md w-16"></div>
      </div>
      <div className="mt-auto pt-3 sm:pt-4 flex justify-between items-center border-t border-gray-100 mt-2 sm:mt-3">
        <div className="h-4 sm:h-5 bg-gray-200 rounded-md w-16"></div>
        <div className="h-6 sm:h-8 bg-gray-200 rounded-md w-16 sm:w-20"></div>
      </div>
    </div>
  </div>
)

const renderSkeletons = () => Array(6).fill(0).map((_, i) => <EventCardSkeleton key={`sk-${i}`} />)

const Events = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const filterRef = useRef(null)
  const searchRef = useRef(null)

  const { events = [], loading = false, error = null, filters = {} } = useSelector(state => state.event || {})

  useEffect(() => {
    const loadEvents = async () => {
      try {
        await dispatch(fetchEvents(filters)).unwrap()
      } catch (err) {
        console.error("Error loading events:", err)
      }
    }
    loadEvents()

    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilters(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dispatch, filters])

  const handleFilterChange = (key, value) => dispatch(setFilters({ [key]: value }))

  // === ĐỊNH DẠNG NGÀY + GIỜ ===
  const formatDateTime = (event) => {
    if (!event.EventDate) return "Chưa xác định"
    const date = new Date(event.EventDate)
    const dateStr = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    const time = event.EventTime ? event.EventTime.substring(0, 5) : ""
    return time ? `${dateStr}, ${time}` : dateStr
  }

  // === CHUẨN HÓA DỮ LIỆU ===
  const eventsList = Array.isArray(events)
    ? events.map(normalizeEvent).filter(Boolean)
    : []

  const filteredEvents = eventsList
    .filter(event => activeCategory === "all" || event.Category === activeCategory)
    .filter(event =>
      !searchTerm ||
      event.Title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.Organizer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.Location?.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const handleViewDetail = (eventId) => {
    if (!eventId) return console.error("Invalid event ID")
    dispatch(clearCurrentEvent())
    navigate(`/events/${eventId}`)
  }

  const clearFilters = () => {
    dispatch(setFilters({}))
    setActiveCategory("all")
    setSearchTerm("")
  }

  const eventCategories = [...new Set(eventsList.map(e => e.Category))].filter(Boolean)

  // Loading
  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen pb-8 sm:pb-12">
        <div className="bg-white border-b border-gray-200 mb-4 sm:mb-6">
          <div className="container mx-auto px-4 py-4 sm:py-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Khám phá sự kiện</h1>
            <div className="animate-pulse mt-4 sm:mt-6">
              <div className="h-8 sm:h-10 bg-gray-200 rounded-md w-full max-w-3xl"></div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4">
          <div className="mb-6 sm:mb-8 animate-pulse">
            <div className="h-5 sm:h-6 bg-gray-200 rounded-md w-1/3 mb-2"></div>
            <div className="h-3 sm:h-4 bg-gray-100 rounded-md w-16"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {renderSkeletons()}
          </div>
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="flex flex-col items-center">
          <XMarkIcon className="w-16 h-16 text-red-500 mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">Đã xảy ra lỗi</h3>
          <p className="text-gray-500 mb-6">{typeof error === "string" ? error : error.message}</p>
          <button className="text-purple-600 hover:text-purple-700 flex items-center" onClick={() => dispatch(fetchEvents(filters))}>
            <ArrowUpRightIcon className="w-5 h-5 mr-2" /> Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Khám phá sự kiện</h1>
          
          <div className="flex flex-col space-y-4 mt-6">
            {/* Categories */}
            <div className="overflow-x-auto -mx-4 px-4 pb-1">
              <div className="flex space-x-3 min-w-max">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-4 py-2.5 font-medium rounded-md whitespace-nowrap ${
                    activeCategory === "all" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  Tất cả
                </button>
                {eventCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2.5 font-medium rounded-md whitespace-nowrap ${
                      activeCategory === cat ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full sm:w-auto">
                <select
                  value={filters.difficulty || "all"}
                  onChange={e => handleFilterChange("difficulty", e.target.value)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-md text-sm font-medium border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                >
                  <option value="all">Mọi độ khó</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              <div className="relative w-full">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm sự kiện..."
                  className="w-full px-4 py-2.5 rounded-md text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredEvents.map((event, index) => (
            <motion.div
              key={event.EventID}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group cursor-pointer"
              onClick={() => handleViewDetail(event.EventID)}
            >
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 h-full flex flex-col">
                <div className="relative overflow-hidden">
                  <img
                    src={event.ImageUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=60'}
                    alt={event.Title}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>

                <div className="p-4 sm:p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug line-clamp-2">
                      {event.Title}
                    </h3>
                    <StatusBadge status={event.Status} />
                  </div>

                  <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">
                    {event.Description || "Tham gia sự kiện để học hỏi và giao lưu."}
                  </p>

                  <div className="text-xs text-gray-500 mt-auto space-y-1.5">
                    <div className="flex items-center">
                      <ClockIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                      <span>{formatDateTime(event)}</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>{event.Difficulty || 'Trung bình'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredEvents.length === 0 && (
          <div className="col-span-full py-8 sm:py-12 text-center">
            <div className="bg-white rounded-xl p-6 sm:p-8 max-w-md mx-auto shadow-sm">
              <div className="bg-gray-50 rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mx-auto mb-4">
                <CalendarDaysIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Không tìm thấy sự kiện</h3>
              <p className="text-gray-600 text-sm sm:text-base mb-5 sm:mb-6">
                {searchTerm ? `Không có sự kiện nào phù hợp với "${searchTerm}".` : 'Chưa có sự kiện nào trong danh mục này.'}
              </p>
              <button
                onClick={searchTerm ? () => setSearchTerm('') : clearFilters}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
              >
                {searchTerm ? 'Xóa tìm kiếm' : 'Xóa bộ lọc'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Events