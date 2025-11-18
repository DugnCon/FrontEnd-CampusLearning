import adminApi from './config';

const API_URL = '/events';

/**
 * Get all events
 * @returns {Promise} Promise object represents the list of events
 */
export const getAllEvents = () => {
  return adminApi.get(API_URL);
};

/**
 * Get event by ID
 * @param {string} id Event ID
 * @returns {Promise} Promise object represents the event
 */
export const getEventById = (id) => {
  return adminApi.get(`${API_URL}/${id}`);
};

/**
 * Create new event
 * @param {Object} data Event data following the database schema
 * @returns {Promise} Promise object represents the created event
 */
export const createEvent = (data) => {
  // Đảm bảo dữ liệu khớp với schema của bảng Events
  const eventData = {
    title: data.title,
    description: data.description,
    category: data.category,
    eventDate: data.eventDate,
    eventTime: data.eventTime,
    location: data.location,
    imageUrl: data.imageUrl,
    maxAttendees: data.maxAttendees,
    currentAttendees: 0, // Giá trị mặc định theo schema
    price: data.price || 0,
    organizer: data.organizer,
    difficulty: data.difficulty || 'intermediate',
    status: 'upcoming', // Giá trị mặc định theo schema
    createdAt: new Date().toISOString()
  };
  return adminApi.post(API_URL, eventData);
};

/**
 * Update event
 * @param {string} id Event ID
 * @param {Object} data Updated event data
 * @returns {Promise} Promise object represents the updated event
 */
export const updateEvent = (id, data) => {
  // Ensure data matches database schema
  // Sử dụng trực tiếp dữ liệu được truyền vào mà không cần chuyển đổi tên trường
  // Giả sử backend nhận các trường có tên bắt đầu bằng chữ hoa
  return adminApi.put(`${API_URL}/${id}`, data);
};

/**
 * Delete event
 * @param {string} id Event ID
 * @returns {Promise} Promise object represents the deletion result
 */
export const deleteEvent = (id) => {
  return adminApi.delete(`${API_URL}/${id}`);
};

/**
 * Update event status
 * @param {string} id Event ID
 * @param {string} status New status (must be: 'upcoming', 'ongoing', 'completed', 'cancelled')
 * @returns {Promise} Promise object represents the update result
 */
export const updateEventStatus = (id, status) => {
  if (!['upcoming', 'ongoing', 'completed', 'cancelled'].includes(status)) {
    throw new Error('Invalid status value');
  }
  return adminApi.put(`${API_URL}/${id}/status`, { status: status });
};

/**
 * Get event languages
 * @param {string} eventId Event ID
 * @returns {Promise} Promise object represents the list of languages
 */
export const getEventLanguages = (eventId) => {
  return adminApi.get(`${API_URL}/${eventId}/languages`);
};

/**
 * Add programming language to an event
 * @param {string} eventId Event ID
 * @param {Object} data Language data
 * @returns {Promise} Promise object represents the created language
 */
export const addEventLanguage = (eventId, data) => {
  return adminApi.post(`${API_URL}/${eventId}/languages`, {
    language: data.language
  });
};

/**
 * Get event technologies
 * @param {string} eventId Event ID
 * @returns {Promise} Promise object represents the list of technologies
 */
export const getEventTechnologies = (eventId) => {
  return adminApi.get(`${API_URL}/${eventId}/technologies`);
};

/**
 * Add technology to an event
 * @param {string} eventId Event ID
 * @param {Object} data Technology data
 * @returns {Promise} Promise object represents the created technology
 */
export const addEventTechnology = (eventId, data) => {
  return adminApi.post(`${API_URL}/${eventId}/technologies`, {
    technology: data.technology
  });
};

/**
 * Get event schedule
 * @param {string} eventId - Event ID
 * @returns {Promise} - Promise object represents the schedule list
 */
export const getEventSchedule = (eventId) => {
  return adminApi.get(`${API_URL}/${eventId}/schedule`);
};

/**
 * Add schedule to an event
 * @param {string} eventId - Event ID
 * @param {Object} data - Schedule data
 * @returns {Promise} - Promise object represents the created schedule
 */
export const addEventSchedule = (eventId, data) => {
  return adminApi.post(`${API_URL}/${eventId}/schedule`, {
    activityName: data.activityName,
    startTime: data.startTime,
    endTime: data.endTime,
    description: data.description,
    location: data.location,
    type: data.type || 'main_event'
  });
};

/**
 * Delete schedule from an event
 * @param {string} eventId - Event ID
 * @param {string} scheduleId - Schedule ID
 * @returns {Promise} - Promise object represents the delete result
 */
export const deleteEventSchedule = (eventId, scheduleId) => {
  return adminApi.delete(`${API_URL}/${eventId}/schedule/${scheduleId}`);
};

/**
 * Get event prizes
 * @param {string} eventId Event ID
 * @returns {Promise} Promise object represents the list of prizes
 */
export const getEventPrizes = (eventId) => {
  return adminApi.get(`${API_URL}/${eventId}/prizes`);
};

/**
 * Add prize to an event
 * @param {string} eventId Event ID
 * @param {Object} data Prize data
 * @returns {Promise} Promise object represents the created prize
 */
export const addEventPrize = (eventId, data) => {
  return adminApi.post(`${API_URL}/${eventId}/prizes`, {
    rank: data.rank,
    prizeAmount: data.amount,
    description: data.description
  });
};

/**
 * Get event participants
 * @param {string} eventId Event ID
 * @returns {Promise} Promise object represents the list of participants
 */
export const getEventParticipants = (eventId) => {
  return adminApi.get(`${API_URL}/${eventId}/participants`);
}; 
