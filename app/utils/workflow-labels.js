export const WORKFLOW_LABELS = [
  'created',
  'needs-planning',
  'planned',
  'ready-for-dev',
  'in-progress',
  'pr-created',
  'merged',
  'blocked',
  'closed'
];

export const DEFAULT_WORKFLOW_LABEL = 'created';

/** @type {Record<string, string[]>} */
export const WORKFLOW_TRANSITIONS = {
  created: ['needs-planning', 'blocked', 'closed'],
  'needs-planning': ['planned', 'blocked', 'closed'],
  planned: ['ready-for-dev', 'needs-planning', 'blocked', 'closed'],
  'ready-for-dev': [
    'in-progress',
    'needs-planning',
    'planned',
    'blocked',
    'closed'
  ],
  'in-progress': ['pr-created', 'blocked', 'closed'],
  'pr-created': ['blocked', 'closed'],
  blocked: [
    'created',
    'needs-planning',
    'planned',
    'ready-for-dev',
    'in-progress',
    'pr-created',
    'merged',
    'closed'
  ],
  closed: [
    'created',
    'needs-planning',
    'planned',
    'ready-for-dev',
    'in-progress',
    'pr-created',
    'merged',
    'blocked'
  ],
  merged: []
};

const WORKFLOW_LABEL_SET = new Set(WORKFLOW_LABELS);

/**
 * @param {string | undefined | null} label
 */
export function isWorkflowLabel(label) {
  return WORKFLOW_LABEL_SET.has(String(label || ''));
}

/**
 * @param {string[] | undefined | null} labels
 */
export function getWorkflowLabel(labels) {
  if (!Array.isArray(labels)) {
    return '';
  }
  for (const label of labels) {
    if (isWorkflowLabel(label)) {
      return label;
    }
  }
  return '';
}

/**
 * @param {string[] | undefined | null} labels
 * @param {string} [fallback]
 */
export function getWorkflowState(labels, fallback = DEFAULT_WORKFLOW_LABEL) {
  return getWorkflowLabel(labels) || fallback;
}

/**
 * @param {string[] | undefined | null} labels
 */
export function stripWorkflowLabels(labels) {
  if (!Array.isArray(labels)) {
    return [];
  }
  return labels.filter((label) => !isWorkflowLabel(label));
}

/**
 * @param {string[] | undefined | null} labels
 * @param {string} nextWorkflowLabel
 */
export function replaceWorkflowLabel(labels, nextWorkflowLabel) {
  return [...stripWorkflowLabels(labels), nextWorkflowLabel];
}

/**
 * @param {string[] | undefined | null} labels
 * @param {string} target
 */
export function computeWorkflowTransition(labels, target) {
  const current = getWorkflowState(labels);
  const allowed = WORKFLOW_TRANSITIONS[current] || [];
  if (!allowed.includes(target)) {
    return null;
  }
  return {
    current,
    target,
    nextLabels: replaceWorkflowLabel(labels, target)
  };
}
