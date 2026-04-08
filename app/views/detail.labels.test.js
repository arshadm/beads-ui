import { describe, expect, test, vi } from 'vitest';
import { createDetailView } from './detail.js';

function mountDiv() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

describe('detail view labels', () => {
  test('shows labels and allows add/remove', async () => {
    const mount = mountDiv();
    let current = {
      id: 'UI-5',
      title: 'With labels',
      status: 'open',
      priority: 2,
      labels: ['frontend']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-5' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async (type, payload) => {
      if (type === 'label-add') {
        current = { ...current, labels: [...current.labels, payload.label] };
        return current;
      }
      if (type === 'label-remove') {
        current = {
          ...current,
          labels: current.labels.filter((l) => l !== payload.label)
        };
        return current;
      }
      return current;
    });

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-5');

    // Initial chip present
    expect(mount.querySelectorAll('.labels .badge').length).toBe(1);

    // Add a label via input + Enter
    const input = /** @type {HTMLInputElement} */ (
      mount.querySelector('.labels input')
    );
    input.value = 'backend';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    await Promise.resolve();

    expect(sendFn).toHaveBeenCalledWith('label-add', {
      id: 'UI-5',
      label: 'backend'
    });
    expect(mount.querySelectorAll('.labels .badge').length).toBe(2);

    // Remove the first label by clicking the × button
    const removeBtn = /** @type {HTMLButtonElement} */ (
      mount.querySelector('.labels .badge button')
    );
    removeBtn.click();
    await Promise.resolve();
    expect(sendFn).toHaveBeenCalledWith('label-remove', {
      id: 'UI-5',
      label: 'frontend'
    });
    expect(mount.querySelectorAll('.labels .badge').length).toBe(1);
  });

  test('applies workflow transition buttons in sidebar', async () => {
    const mount = mountDiv();
    let current = {
      id: 'UI-9',
      title: 'Workflow',
      status: 'open',
      priority: 2,
      labels: ['created']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-9' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async (type, payload) => {
      if (type === 'label-remove') {
        current = {
          ...current,
          labels: current.labels.filter((l) => l !== payload.label)
        };
        return current;
      }
      if (type === 'label-add') {
        current = { ...current, labels: [...current.labels, payload.label] };
        return current;
      }
      return current;
    });

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-9');

    const transitionButton = /** @type {HTMLButtonElement | undefined} */ (
      Array.from(
      mount.querySelectorAll('.labels .props-card__footer button')
      ).find((btn) => (btn.textContent || '').trim() === 'Needs Planning')
    );
    expect(transitionButton).toBeTruthy();
    transitionButton?.click();
    await Promise.resolve();

    expect(sendFn).toHaveBeenCalledWith('label-remove', {
      id: 'UI-9',
      label: 'created'
    });
    expect(sendFn).toHaveBeenCalledWith('label-add', {
      id: 'UI-9',
      label: 'needs-planning'
    });
  });

  test('handles array-shaped update payloads during workflow transition', async () => {
    const mount = mountDiv();
    let current = {
      id: 'UI-10',
      title: 'Workflow arrays',
      status: 'open',
      priority: 2,
      labels: ['created']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-10' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async (type, payload) => {
      if (type === 'label-remove') {
        current = { ...current, labels: [] };
        return [current];
      }
      if (type === 'label-add') {
        current = { ...current, labels: [payload.label] };
        return [current];
      }
      return [current];
    });

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-10');

    const transitionButton = /** @type {HTMLButtonElement | undefined} */ (
      Array.from(mount.querySelectorAll('.labels .props-card__footer button')).find(
        (btn) => (btn.textContent || '').trim() === 'Needs Planning'
      )
    );
    transitionButton?.click();
    await Promise.resolve();

    expect(sendFn).toHaveBeenCalledWith('label-add', {
      id: 'UI-10',
      label: 'needs-planning'
    });
  });

  test('shows only Created transition when workflow label is missing', async () => {
    const mount = mountDiv();
    const current = {
      id: 'UI-11',
      title: 'No workflow label',
      status: 'open',
      priority: 2,
      labels: ['frontend']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-11' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async () => current);

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-11');

    const footers = mount.querySelectorAll('.labels .props-card__footer');
    const transitionButtons = Array.from(
      footers[1]?.querySelectorAll('button') || []
    ).map((btn) => (btn.textContent || '').trim());
    expect(transitionButtons).toEqual(['Created']);
    const workflowText = (footers[1]?.textContent || '').replace(/\s+/g, ' ');
    expect(workflowText).toContain('Workflow: Unassigned');
  });

  test('clicking Created on unlabeled issue adds created label', async () => {
    const mount = mountDiv();
    let current = {
      id: 'UI-12',
      title: 'Assign workflow',
      status: 'open',
      priority: 2,
      labels: ['frontend']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-12' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async (type, payload) => {
      if (type === 'label-add') {
        current = { ...current, labels: ['frontend', payload.label] };
      }
      return current;
    });

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-12');

    const footers = mount.querySelectorAll('.labels .props-card__footer');
    const createdButton = /** @type {HTMLButtonElement | null} */ (
      footers[1]?.querySelector('button')
    );
    createdButton?.click();
    await Promise.resolve();

    expect(sendFn).toHaveBeenCalledWith('label-add', {
      id: 'UI-12',
      label: 'created'
    });
  });

  test('shows transitions from closed to all other workflow states', async () => {
    const mount = mountDiv();
    const current = {
      id: 'UI-13',
      title: 'Closed transitions',
      status: 'open',
      priority: 2,
      labels: ['closed']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-13' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async () => current);

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-13');

    const footers = mount.querySelectorAll('.labels .props-card__footer');
    const transitionButtons = Array.from(
      footers[1]?.querySelectorAll('button') || []
    ).map((btn) => (btn.textContent || '').trim());
    expect(transitionButtons).toEqual([
      'Created',
      'Needs Planning',
      'Planned',
      'Ready For Dev',
      'In Progress',
      'Pr Created',
      'Merged',
      'Blocked'
    ]);
  });

  test('shows transitions from blocked to all other workflow states', async () => {
    const mount = mountDiv();
    const current = {
      id: 'UI-14',
      title: 'Blocked transitions',
      status: 'open',
      priority: 2,
      labels: ['blocked']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-14' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async () => current);

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-14');

    const footers = mount.querySelectorAll('.labels .props-card__footer');
    const transitionButtons = Array.from(
      footers[1]?.querySelectorAll('button') || []
    ).map((btn) => (btn.textContent || '').trim());
    expect(transitionButtons).toEqual([
      'Created',
      'Needs Planning',
      'Planned',
      'Ready For Dev',
      'In Progress',
      'Pr Created',
      'Merged',
      'Closed'
    ]);
  });
});
