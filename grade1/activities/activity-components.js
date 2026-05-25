/**
 * Grade 1 Activity Components
 * 
 * This file re-exports the shared ActivityComponents from the central JS folder.
 * Grade 1 activities can import from here for backward compatibility.
 * 
 * Note: For new activities, prefer importing directly from ../../js/activity-components.js
 */

// The shared ActivityComponents is loaded from ../../js/activity-components.js
// This file exists for backward compatibility with existing Grade 1 activities

/**
 * Grade1Components - Grade 1 specific wrapper with defaults
 */
const Grade1Components = {
  /**
   * Get sidebar HTML with Grade 1 as active
   */
  getSidebarHTML(basePath = '../../') {
    return window.ActivityComponents?.getSidebarHTML({
      basePath,
      activeGrade: 'grade1'
    }) || '';
  },

  /**
   * Get hamburger menu HTML
   */
  getHamburgerHTML() {
    return window.ActivityComponents?.getHamburgerHTML() || '';
  },

  /**
   * Get stats overlay HTML
   */
  getStatsOverlayHTML(config = {}) {
    return window.ActivityComponents?.getStatsOverlayHTML(config) || '';
  },

  /**
   * Get activity header HTML with Grade 1 defaults
   */
  getActivityHeaderHTML(config) {
    return window.ActivityComponents?.getActivityHeaderHTML({
      ...config,
      backPath: config.backPath || '../index.html',
      backToKey: config.backToKey || 'nav.grade1'
    }) || '';
  },

  /**
   * Get common CSS links
   */
  getCommonCSSLinks(basePath = '../../css/') {
    return window.ActivityComponents?.getCommonCSSLinks(basePath) || '';
  },

  /**
   * Get common script tags
   */
  getCommonScriptTags(basePath = '../../js/', includeActivityBase = false) {
    return window.ActivityComponents?.getCommonScriptTags(basePath, includeActivityBase) || '';
  }
};

window.Grade1Components = Grade1Components;

console.log('Grade 1 ActivityComponents loaded via shared module');
