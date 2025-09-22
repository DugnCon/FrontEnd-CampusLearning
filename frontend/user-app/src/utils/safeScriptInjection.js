// src/utils/safeScriptInjection.js

/**
 * Thêm hoặc cập nhật JSON-LD script vào <head>
 * @param {Object} jsonLd - Object JSON-LD
 * @param {string} dataAttr - Tên data attribute, ví dụ 'data-faq'
 * @param {string} page - Tên page, ví dụ 'home'
 */
export function injectJsonLdScript(jsonLd, dataAttr, page) {
  if (!jsonLd || typeof jsonLd !== "object") return;

  // Kiểm tra script đã tồn tại chưa
  let script = document.querySelector(`script[data-${dataAttr}="${page}"]`);
  
  if (script) {
    // Nếu đã tồn tại, cập nhật nội dung
    script.text = JSON.stringify(jsonLd);
  } else {
    // Nếu chưa tồn tại, tạo mới
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset[dataAttr] = page;
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

/**
 * Xoá JSON-LD script theo data attribute và page
 * @param {string} dataAttr - Tên data attribute
 * @param {string} page - Tên page
 */
export function removeJsonLdScript(dataAttr, page) {
  const scripts = document.querySelectorAll(`script[data-${dataAttr}="${page}"]`);
  scripts.forEach((script) => script.parentNode.removeChild(script));
}

/**
 * Lấy JSON-LD hiện tại từ DOM theo data attribute và page
 * @param {string} dataAttr
 * @param {string} page
 * @returns {Object|null} - JSON-LD object hoặc null nếu không tồn tại
 */
export function getJsonLdScript(dataAttr, page) {
  const script = document.querySelector(`script[data-${dataAttr}="${page}"]`);
  if (!script) return null;
  
  try {
    return JSON.parse(script.text);
  } catch (e) {
    console.error('Error parsing JSON-LD from script:', e);
    return null;
  }
}
