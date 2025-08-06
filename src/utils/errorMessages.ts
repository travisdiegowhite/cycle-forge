// User-friendly error message mappings and utilities

interface ErrorMessageConfig {
  title: string;
  description: string;
  action?: string;
}

export const errorMessages: Record<string, ErrorMessageConfig> = {
  // Network errors
  NETWORK_ERROR: {
    title: "Connection Problem",
    description: "We're having trouble connecting to our servers. Please check your internet connection and try again.",
    action: "Retry"
  },
  TIMEOUT_ERROR: {
    title: "Request Timed Out",
    description: "The request is taking longer than expected. This might be due to slow internet or server issues.",
    action: "Try Again"
  },
  OFFLINE_ERROR: {
    title: "You're Offline",
    description: "This feature requires an internet connection. Please connect to the internet and try again.",
    action: "Retry when online"
  },

  // Authentication errors
  AUTH_EXPIRED: {
    title: "Session Expired",
    description: "Your session has expired for security reasons. Please sign in again to continue.",
    action: "Sign In"
  },
  AUTH_INVALID: {
    title: "Authentication Failed",
    description: "We couldn't verify your identity. Please sign in again.",
    action: "Sign In"
  },
  ACCESS_DENIED: {
    title: "Access Denied",
    description: "You don't have permission to access this feature. Please contact support if you think this is an error.",
    action: "Contact Support"
  },

  // API errors
  API_RATE_LIMIT: {
    title: "Too Many Requests",
    description: "You're making requests too quickly. Please wait a moment and try again.",
    action: "Wait and retry"
  },
  API_SERVER_ERROR: {
    title: "Server Error",
    description: "Our servers are experiencing issues. Our team has been notified and is working on a fix.",
    action: "Try again later"
  },
  API_BAD_REQUEST: {
    title: "Invalid Request",
    description: "There was a problem with your request. Please check your input and try again.",
    action: "Check and retry"
  },

  // Map-specific errors
  MAP_LOAD_ERROR: {
    title: "Map Loading Failed",
    description: "We couldn't load the map. This might be due to network issues or browser compatibility problems.",
    action: "Refresh page"
  },
  MAP_TOKEN_ERROR: {
    title: "Map Configuration Error",
    description: "There was a problem with the map configuration. Please try refreshing the page.",
    action: "Refresh"
  },
  LOCATION_NOT_FOUND: {
    title: "Location Not Found",
    description: "We couldn't find that location. Please try a different search term or be more specific.",
    action: "Try different search"
  },
  GEOLOCATION_DENIED: {
    title: "Location Access Denied",
    description: "Please allow location access in your browser settings to use this feature.",
    action: "Enable location"
  },

  // Route-specific errors
  ROUTE_GENERATION_FAILED: {
    title: "Route Generation Failed",
    description: "We couldn't generate a route between those points. Try adjusting your waypoints or check if the locations are accessible.",
    action: "Adjust waypoints"
  },
  ROUTE_SAVE_ERROR: {
    title: "Save Failed",
    description: "We couldn't save your route. Please check your connection and try again.",
    action: "Try saving again"
  },
  ROUTE_LOAD_ERROR: {
    title: "Load Failed",
    description: "We couldn't load that route. It might have been deleted or corrupted.",
    action: "Try another route"
  },

  // Strava-specific errors
  STRAVA_AUTH_ERROR: {
    title: "Strava Connection Failed",
    description: "We couldn't connect to your Strava account. Please try reconnecting.",
    action: "Reconnect Strava"
  },
  STRAVA_API_ERROR: {
    title: "Strava Service Error",
    description: "Strava's services are temporarily unavailable. Please try again later.",
    action: "Try again later"
  },

  // File errors
  FILE_TOO_LARGE: {
    title: "File Too Large",
    description: "The file you're trying to upload is too large. Please choose a smaller file.",
    action: "Choose smaller file"
  },
  FILE_INVALID_FORMAT: {
    title: "Invalid File Format",
    description: "This file format is not supported. Please use a supported format like GPX or TCX.",
    action: "Use supported format"
  },

  // Generic fallback
  UNKNOWN_ERROR: {
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    action: "Try again"
  }
};

// Helper function to get user-friendly error message
export function getUserFriendlyError(error: Error | string): ErrorMessageConfig {
  const errorString = typeof error === 'string' ? error : error.message;
  const errorCode = extractErrorCode(errorString);
  
  return errorMessages[errorCode] || errorMessages.UNKNOWN_ERROR;
}

// Extract error code from error message or HTTP status
function extractErrorCode(errorMessage: string): string {
  const message = errorMessage.toLowerCase();
  
  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  if (message.includes('timeout')) {
    return 'TIMEOUT_ERROR';
  }
  if (message.includes('offline') || message.includes('no internet')) {
    return 'OFFLINE_ERROR';
  }
  
  // HTTP status codes
  if (message.includes('401') || message.includes('unauthorized')) {
    return 'AUTH_EXPIRED';
  }
  if (message.includes('403') || message.includes('forbidden')) {
    return 'ACCESS_DENIED';
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return 'API_RATE_LIMIT';
  }
  if (message.includes('500') || message.includes('server error')) {
    return 'API_SERVER_ERROR';
  }
  if (message.includes('400') || message.includes('bad request')) {
    return 'API_BAD_REQUEST';
  }
  
  // Map errors
  if (message.includes('map') && (message.includes('load') || message.includes('fail'))) {
    return 'MAP_LOAD_ERROR';
  }
  if (message.includes('token') && message.includes('map')) {
    return 'MAP_TOKEN_ERROR';
  }
  if (message.includes('location not found')) {
    return 'LOCATION_NOT_FOUND';
  }
  if (message.includes('geolocation') && message.includes('denied')) {
    return 'GEOLOCATION_DENIED';
  }
  
  // Route errors
  if (message.includes('route') && message.includes('generate')) {
    return 'ROUTE_GENERATION_FAILED';
  }
  if (message.includes('save') && message.includes('route')) {
    return 'ROUTE_SAVE_ERROR';
  }
  if (message.includes('load') && message.includes('route')) {
    return 'ROUTE_LOAD_ERROR';
  }
  
  // Strava errors
  if (message.includes('strava') && message.includes('auth')) {
    return 'STRAVA_AUTH_ERROR';
  }
  if (message.includes('strava')) {
    return 'STRAVA_API_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

// Helper to format error for toast notifications
export function formatErrorForToast(error: Error | string) {
  const { title, description } = getUserFriendlyError(error);
  return { title, description };
}

// Helper to check if error is recoverable
export function isRecoverableError(error: Error | string): boolean {
  const errorCode = extractErrorCode(typeof error === 'string' ? error : error.message);
  
  const recoverableErrors = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'API_RATE_LIMIT',
    'MAP_LOAD_ERROR',
    'ROUTE_GENERATION_FAILED',
    'ROUTE_SAVE_ERROR'
  ];
  
  return recoverableErrors.includes(errorCode);
}