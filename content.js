// Wrap entire content script to avoid multiple injection issues
(function() {
  // Guard against multiple injections
  if (window.timeUPInjected) {
    console.log('TimeUP content script already injected, skipping...');
    return; // This return is now valid inside the function
  }
  window.timeUPInjected = true;

  // Content script for page interaction, idle detection, and media tracking
  let lastActivity = Date.now();
  let mediaElements = [];
  let mediaCheckInterval = null;
  let isMediaPlaying = false;

  // Track user activity
  function trackActivity() {
    lastActivity = Date.now();
  }

  // Check if any media is playing
  function checkMediaPlaying() {
    // Check video elements
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      if (!video.paused && !video.ended && video.readyState > 2) {
        return true;
      }
    }
    
    // Check audio elements
    const audios = document.querySelectorAll('audio');
    for (const audio of audios) {
      if (!audio.paused && !audio.ended && audio.readyState > 2) {
        return true;
      }
    }
    
    // Special check for YouTube
    if (window.location.hostname.includes('youtube.com')) {
      const ytPlayer = document.querySelector('#movie_player video');
      if (ytPlayer && !ytPlayer.paused) {
        return true;
      }
    }
    
    // Special check for Netflix
    if (window.location.hostname.includes('netflix.com')) {
      const nfPlayer = document.querySelector('video');
      if (nfPlayer && !nfPlayer.paused) {
        return true;
      }
    }
    
    // Check for Spotify web player
    if (window.location.hostname.includes('spotify.com')) {
      const spotifyPlayButton = document.querySelector('[data-testid="control-button-playpause"]');
      if (spotifyPlayButton && spotifyPlayButton.getAttribute('aria-label')?.includes('Pause')) {
        return true;
      }
    }
    
    return false;
  }

  // Setup media monitoring
  function setupMediaMonitoring() {
    // Clear existing interval
    if (mediaCheckInterval) {
      clearInterval(mediaCheckInterval);
    }
    
    // Check media state every second
    mediaCheckInterval = setInterval(() => {
      const wasPlaying = isMediaPlaying;
      isMediaPlaying = checkMediaPlaying();
      
      // If media state changed, track activity
      if (wasPlaying !== isMediaPlaying) {
        trackActivity();
        console.log('Media state changed:', isMediaPlaying ? 'playing' : 'paused');
      }
      
      // If media is playing, update activity
      if (isMediaPlaying) {
        lastActivity = Date.now();
      }
    }, 1000);
    
    // Add event listeners to all current media elements
    const allMedia = [...document.querySelectorAll('video, audio')];
    allMedia.forEach(media => {
      if (!mediaElements.includes(media)) {
        mediaElements.push(media);
        
        // Track media events
        media.addEventListener('play', trackActivity);
        media.addEventListener('pause', trackActivity);
        media.addEventListener('ended', trackActivity);
        media.addEventListener('seeked', trackActivity);
        media.addEventListener('volumechange', trackActivity);
      }
    });
  }

  // Activity event listeners
  document.addEventListener('mousemove', trackActivity, { passive: true });
  document.addEventListener('keypress', trackActivity, { passive: true });
  document.addEventListener('keydown', trackActivity, { passive: true });
  document.addEventListener('click', trackActivity, { passive: true });
  document.addEventListener('scroll', trackActivity, { passive: true });
  document.addEventListener('touchstart', trackActivity, { passive: true });
  document.addEventListener('touchmove', trackActivity, { passive: true });
  document.addEventListener('wheel', trackActivity, { passive: true });

  // Form interaction events
  document.addEventListener('input', trackActivity, { passive: true });
  document.addEventListener('change', trackActivity, { passive: true });
  document.addEventListener('focus', trackActivity, true);
  document.addEventListener('blur', trackActivity, true);

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      trackActivity();
    }
    console.log('Visibility changed:', document.visibilityState);
  });

  // Handle fullscreen changes (for video)
  document.addEventListener('fullscreenchange', trackActivity);
  document.addEventListener('webkitfullscreenchange', trackActivity);

  // Handle focus/blur events
  window.addEventListener('focus', () => {
    trackActivity();
    console.log('Window gained focus');
  });

  window.addEventListener('blur', () => {
    console.log('Window lost focus');
  });

  // Message listener for background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkActivity') {
      // Update media playing state
      isMediaPlaying = checkMediaPlaying();
      
      sendResponse({
        lastActivity: lastActivity,
        isVisible: document.visibilityState === 'visible',
        hasFocus: document.hasFocus(),
        mediaPlaying: isMediaPlaying,
        timestamp: Date.now()
      });
    } else if (request.action === 'getPageInfo') {
      sendResponse({
        title: document.title,
        url: window.location.href,
        lastActivity: lastActivity,
        isVisible: document.visibilityState === 'visible',
        hasFocus: document.hasFocus(),
        mediaPlaying: checkMediaPlaying()
      });
    }
  });

  // Mutation observer to detect dynamically added media elements
  const observer = new MutationObserver((mutations) => {
    let mediaAdded = false;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
          mediaAdded = true;
        } else if (node.nodeType === 1) { // Element node
          // Check for media elements in the added subtree
          const mediaInSubtree = node.querySelectorAll?.('video, audio');
          if (mediaInSubtree?.length > 0) {
            mediaAdded = true;
          }
        }
      });
    });
    
    if (mediaAdded) {
      console.log('New media elements detected');
      setupMediaMonitoring();
    }
  });

  // Start observing the document for media elements
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initialize
  trackActivity();
  setupMediaMonitoring();

  // Re-setup media monitoring periodically in case elements are missed
  setInterval(setupMediaMonitoring, 5000);

  // Log initialization
  console.log('TimeUP content script loaded for:', window.location.hostname);

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (mediaCheckInterval) {
      clearInterval(mediaCheckInterval);
    }
    observer.disconnect();
    delete window.timeUPInjected;
  });

})(); // Execute immediately
