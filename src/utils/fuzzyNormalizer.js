/**
 * Fuzzy Normalization Utilities
 *
 * Provides fuzzy matching and normalization for various search parameters
 * to make the MCP server more user-friendly
 */

/**
 * Normalize status value using fuzzy matching
 * @param {string} input - User input status
 * @returns {string} Normalized status value
 */
export function normalizeStatus(input) {
  if (!input) return input;

  const statusMap = {
    // Backlog variations
    backlog: 'Backlog',
    'back log': 'Backlog',
    new: 'Backlog',
    open: 'Backlog',
    created: 'Backlog',
    queued: 'Backlog',

    // Todo variations
    todo: 'Todo',
    'to do': 'Todo',
    'to-do': 'Todo',
    planned: 'Todo',
    ready: 'Todo',
    upcoming: 'Todo',

    // In Progress variations
    'in progress': 'In Progress',
    inprogress: 'In Progress',
    'in-progress': 'In Progress',
    working: 'In Progress',
    wip: 'In Progress',
    active: 'In Progress',
    doing: 'In Progress',
    started: 'In Progress',
    ongoing: 'In Progress',

    // Done variations
    done: 'Done',
    completed: 'Done',
    complete: 'Done',
    finished: 'Done',
    closed: 'Done',
    resolved: 'Done',
    fixed: 'Done',

    // Canceled variations
    canceled: 'Canceled',
    cancelled: 'Canceled',
    cancel: 'Canceled',
    dropped: 'Canceled',
    abandoned: 'Canceled',
    rejected: 'Canceled',
    wontfix: 'Canceled',
    "won't fix": 'Canceled',
  };

  const normalized = input.toLowerCase().trim();
  return statusMap[normalized] || input;
}

/**
 * Normalize priority value using fuzzy matching
 * @param {string} input - User input priority
 * @returns {string} Normalized priority value
 */
export function normalizePriority(input) {
  if (!input) return input;

  const priorityMap = {
    // No Priority variations
    nopriority: 'NoPriority',
    'no priority': 'NoPriority',
    'no-priority': 'NoPriority',
    none: 'NoPriority',
    unset: 'NoPriority',
    empty: 'NoPriority',
    null: 'NoPriority',

    // Low variations
    low: 'low',
    l: 'low',
    minor: 'low',
    trivial: 'low',
    1: 'low',

    // Medium variations
    medium: 'medium',
    med: 'medium',
    m: 'medium',
    normal: 'medium',
    moderate: 'medium',
    standard: 'medium',
    2: 'medium',

    // High variations
    high: 'high',
    h: 'high',
    important: 'high',
    major: 'high',
    3: 'high',

    // Urgent variations
    urgent: 'urgent',
    u: 'urgent',
    critical: 'urgent',
    blocker: 'urgent',
    emergency: 'urgent',
    asap: 'urgent',
    4: 'urgent',
  };

  const normalized = input.toLowerCase().trim();
  return priorityMap[normalized] || input;
}

/**
 * Fuzzy match a string against a list of possible values
 * @param {string} input - User input
 * @param {Array<string>} possibleValues - List of valid values
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {string|null} Best match or null
 */
export function fuzzyMatch(input, possibleValues, threshold = 0.7) {
  if (!input || !possibleValues || possibleValues.length === 0) {
    return null;
  }

  const normalizedInput = input.toLowerCase().trim();
  let bestMatch = null;
  let highestScore = 0;

  for (const value of possibleValues) {
    const normalizedValue = value.toLowerCase().trim();

    // Exact match
    if (normalizedInput === normalizedValue) {
      return value;
    }

    // Contains match
    if (normalizedValue.includes(normalizedInput) || normalizedInput.includes(normalizedValue)) {
      const score =
        Math.min(normalizedInput.length, normalizedValue.length) /
        Math.max(normalizedInput.length, normalizedValue.length);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = value;
      }
    }

    // Levenshtein distance for fuzzy matching
    const distance = levenshteinDistance(normalizedInput, normalizedValue);
    const maxLength = Math.max(normalizedInput.length, normalizedValue.length);
    const similarity = 1 - distance / maxLength;

    if (similarity > highestScore && similarity >= threshold) {
      highestScore = similarity;
      bestMatch = value;
    }
  }

  return bestMatch;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  // Initialize first row and column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize project identifier (case-insensitive)
 * @param {string} input - User input project identifier
 * @param {Array<Object>} availableProjects - List of available projects
 * @returns {string} Normalized project identifier
 */
export function normalizeProjectIdentifier(input, availableProjects = []) {
  if (!input) return input;

  // First try exact case-insensitive match
  for (const project of availableProjects) {
    if (project.identifier.toLowerCase() === input.toLowerCase()) {
      return project.identifier;
    }
  }

  // Then try fuzzy match
  const projectIdentifiers = availableProjects.map((p) => p.identifier);
  const match = fuzzyMatch(input, projectIdentifiers, 0.8);

  return match || input;
}

/**
 * Normalize component/milestone names using fuzzy matching
 * @param {string} input - User input
 * @param {Array<Object>} availableItems - List of available components/milestones
 * @returns {string} Normalized name
 */
export function normalizeLabel(input, availableItems = []) {
  if (!input) return input;

  // First try exact case-insensitive match
  for (const item of availableItems) {
    const label = item.label || item.name;
    if (label && label.toLowerCase() === input.toLowerCase()) {
      return label;
    }
  }

  // Then try fuzzy match
  const labels = availableItems.map((item) => item.label || item.name).filter(Boolean);
  const match = fuzzyMatch(input, labels, 0.7);

  return match || input;
}

/**
 * Parse and normalize date inputs
 * @param {string} input - User input date
 * @returns {string|null} ISO date string or null
 */
export function normalizeDate(input) {
  if (!input) return input;

  const datePatterns = [
    // Relative dates
    { pattern: /^today$/i, handler: () => new Date().toISOString() },
    {
      pattern: /^yesterday$/i,
      handler: () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString();
      },
    },
    {
      pattern: /^(\d+)\s*days?\s*ago$/i,
      handler: (match) => {
        const days = parseInt(match[1]);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
      },
    },
    {
      pattern: /^last\s*week$/i,
      handler: () => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date.toISOString();
      },
    },
    {
      pattern: /^last\s*month$/i,
      handler: () => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString();
      },
    },
  ];

  // Try relative date patterns
  for (const { pattern, handler } of datePatterns) {
    const match = input.match(pattern);
    if (match) {
      return handler(match);
    }
  }

  // Try parsing as regular date
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }

  return null;
}

/**
 * Normalize search query by tokenizing and cleaning
 * @param {string} query - Search query
 * @returns {string} Normalized query
 */
export function normalizeSearchQuery(query) {
  if (!query) return query;

  return query
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .toLowerCase();
}

// Export all normalization functions
export default {
  normalizeStatus,
  normalizePriority,
  fuzzyMatch,
  normalizeProjectIdentifier,
  normalizeLabel,
  normalizeDate,
  normalizeSearchQuery,
};
