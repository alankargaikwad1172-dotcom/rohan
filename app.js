const STORAGE_KEY = "rohan-service-ticket-manager-v1";

const STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Paused",
  "Waiting on Someone Else",
  "Deferred",
  "Completed"
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

const DEFAULT_REFERENCES = {
  categories: ["Laptop", "Desktop", "Printer", "CCTV", "Networking", "Software"],
  employees: ["Amit", "Rahul", "Sneha", "Priya"],
  departments: ["Repair Lab", "Field Service", "Software Support", "Billing"],
  branches: ["Main Branch", "North Branch", "South Branch"]
};

let state = loadState();
let selectedTicketId = null;
let draftTicket = null;

const el = {};

init();

function init() {
  cacheElements();
  state = normalizeState(state);
  selectedTicketId = state.meta.lastSelectedTicketId || (state.tickets[0] ? state.tickets[0].id : null);
  bindEvents();
  setInterval(updateLiveTimerReadout, 1000);
  renderAll();
}

function cacheElements() {
  const ids = [
    "stat-total",
    "stat-open",
    "stat-overdue",
    "stat-urgent",
    "stat-time",
    "ticket-count-label",
    "search-input",
    "status-filter",
    "priority-filter",
    "assignee-filter",
    "branch-filter",
    "ticket-list",
    "new-ticket-btn",
    "load-sample-btn",
    "export-btn",
    "import-btn",
    "import-file",
    "duplicate-ticket-btn",
    "delete-ticket-btn",
    "clear-form-btn",
    "editor-mode",
    "editor-title",
    "editor-subtitle",
    "ticket-number-readout",
    "ticket-updated-readout",
    "balance-readout",
    "ticket-form",
    "customer-mobile",
    "customer-name",
    "service-history",
    "device-name",
    "category",
    "service-type",
    "task-description",
    "problem-description",
    "case-logged-by",
    "department",
    "branch",
    "priority",
    "status",
    "start-date",
    "due-date",
    "completed-date",
    "assigned-to-group",
    "estimate-given",
    "spares-required",
    "spares-ordered",
    "estimate-for-customer",
    "spares-list",
    "total-bill-amount",
    "advance-taken",
    "discount-given",
    "final-payment",
    "balance-amount",
    "collected",
    "collected-by",
    "collected-at",
    "solution-given",
    "solution-offered",
    "save-ticket-btn",
    "timer-warning",
    "live-timer",
    "total-tracked-time",
    "start-timer-btn",
    "pause-timer-btn",
    "stop-timer-btn",
    "time-log-list",
    "comment-author",
    "comment-text",
    "add-comment-btn",
    "comment-list",
    "activity-log",
    "reference-grid",
    "categories-list",
    "employees-list",
    "departments-list",
    "branches-list",
    "categories-input",
    "employees-input",
    "departments-input",
    "branches-input"
  ];

  ids.forEach((id) => {
    el[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  el.newTicketBtn.addEventListener("click", handleNewTicket);
  el.clearFormBtn.addEventListener("click", handleNewTicket);
  el.duplicateTicketBtn.addEventListener("click", handleDuplicateTicket);
  el.deleteTicketBtn.addEventListener("click", handleDeleteTicket);
  el.loadSampleBtn.addEventListener("click", handleLoadSample);
  el.exportBtn.addEventListener("click", exportData);
  el.importBtn.addEventListener("click", () => el.importFile.click());
  el.importFile.addEventListener("change", importData);
  el.ticketForm.addEventListener("submit", handleSaveTicket);
  el.ticketList.addEventListener("click", handleTicketSelection);
  el.addCommentBtn.addEventListener("click", handleAddComment);
  el.startTimerBtn.addEventListener("click", () => handleTimerAction("start"));
  el.pauseTimerBtn.addEventListener("click", () => handleTimerAction("pause"));
  el.stopTimerBtn.addEventListener("click", () => handleTimerAction("stop"));
  el.customerMobile.addEventListener("input", renderServiceHistoryFromInput);
  el.status.addEventListener("change", handleStatusAutofill);

  [el.totalBillAmount, el.advanceTaken, el.discountGiven, el.finalPayment].forEach((node) => {
    node.addEventListener("input", updateBalancePreview);
  });

  [el.searchInput, el.statusFilter, el.priorityFilter, el.assigneeFilter, el.branchFilter].forEach((node) => {
    node.addEventListener("input", renderTicketList);
    node.addEventListener("change", renderTicketList);
  });

  el.referenceGrid.addEventListener("click", handleReferenceGridClick);
}

function handleNewTicket() {
  selectedTicketId = null;
  draftTicket = createBlankTicket();
  persistState();
  renderAll();
}

function handleDuplicateTicket() {
  const ticket = getSelectedTicket();

  if (!ticket) {
    return;
  }

  draftTicket = sanitizeTicket({
    ...ticket,
    id: "",
    ticketNumber: "",
    status: "Not Started",
    completedDate: "",
    collected: false,
    collectedBy: "",
    collectedAt: "",
    comments: [],
    timeLogs: [],
    activities: [],
    activeSession: null,
    createdAt: "",
    updatedAt: ""
  });

  selectedTicketId = null;
  persistState();
  renderAll();
}

function handleDeleteTicket() {
  const ticket = getSelectedTicket();

  if (!ticket) {
    return;
  }

  if (ticket.activeSession) {
    alert("Pause or stop the running timer before deleting this ticket.");
    return;
  }

  if (!window.confirm(`Delete ticket ${ticket.ticketNumber}? This cannot be undone.`)) {
    return;
  }

  state.tickets = state.tickets.filter((item) => item.id !== ticket.id);
  selectedTicketId = null;
  draftTicket = createBlankTicket();
  persistState();
  renderAll();
}

function handleSaveTicket(event) {
  event.preventDefault();

  if (!el.ticketForm.reportValidity()) {
    return;
  }

  const existing = getSelectedTicket();
  const base = existing || draftTicket || createBlankTicket();
  const ticket = readFormTicket(base);

  ticket.updatedAt = nowIso();

  if (existing) {
    ticket.id = existing.id;
    ticket.ticketNumber = existing.ticketNumber;
    ticket.createdAt = existing.createdAt;
    prependActivities(ticket, describeChanges(existing, ticket));
    replaceTicket(ticket);
  } else {
    ticket.id = makeId("ticket");
    ticket.ticketNumber = nextTicketNumber();
    ticket.createdAt = nowIso();
    prependActivities(ticket, buildCreationMessages(ticket));
    state.tickets.unshift(ticket);
  }

  selectedTicketId = ticket.id;
  draftTicket = null;
  persistState();
  renderAll();
}

function handleTicketSelection(event) {
  const card = event.target.closest("[data-ticket-id]");

  if (!card) {
    return;
  }

  selectedTicketId = card.dataset.ticketId;
  draftTicket = null;
  persistState();
  renderAll();
}

function handleStatusAutofill() {
  if (el.status.value === "Completed" && !el.completedDate.value) {
    el.completedDate.value = todayDateString();
  }
}

function handleAddComment() {
  const ticket = getSelectedTicket();

  if (!ticket) {
    alert("Save the ticket first, then add internal comments.");
    return;
  }

  const body = el.commentText.value.trim();
  const author = cleanText(el.commentAuthor.value) || ticket.caseLoggedBy || "Team Member";

  if (!body) {
    alert("Write a comment before adding it.");
    return;
  }

  ticket.comments.unshift({
    id: makeId("comment"),
    author,
    body,
    at: nowIso()
  });

  prependActivities(ticket, [`Internal comment added by ${author}`]);
  ticket.updatedAt = nowIso();
  replaceTicket(ticket);
  persistState();
  renderAll();
  el.commentText.value = "";
  el.commentAuthor.value = author;
}

function handleTimerAction(action) {
  const ticket = getSelectedTicket();

  if (!ticket) {
    alert("Save the ticket before tracking time.");
    return;
  }

  const activeTicket = getActiveTicket();

  if (action === "start") {
    if (activeTicket && activeTicket.id !== ticket.id) {
      alert(`A timer is already running on ${activeTicket.ticketNumber}. Pause or stop it first.`);
      return;
    }

    if (ticket.activeSession) {
      return;
    }

    ticket.activeSession = {
      id: makeId("session"),
      startedAt: nowIso()
    };

    const messages = ["Work session started"];

    if (!ticket.startDate) {
      ticket.startDate = todayDateString();
      messages.push("Start date captured automatically");
    }

    if (ticket.status === "Not Started" || ticket.status === "Paused" || ticket.status === "Deferred") {
      ticket.status = "In Progress";
      messages.push("Status moved to In Progress");
    }

    prependActivities(ticket, messages);
    ticket.updatedAt = nowIso();
    replaceTicket(ticket);
    persistState();
    renderAll();
    return;
  }

  if (!ticket.activeSession) {
    return;
  }

  const startedAt = new Date(ticket.activeSession.startedAt).getTime();
  const endedAt = nowIso();
  const endedAtMs = new Date(endedAt).getTime();
  const durationMinutes = Math.max(0, roundToTwo((endedAtMs - startedAt) / 60000));

  ticket.timeLogs.unshift({
    id: ticket.activeSession.id,
    startedAt: ticket.activeSession.startedAt,
    endedAt,
    endedBy: action === "pause" ? "Pause" : "Stop",
    durationMinutes
  });

  ticket.activeSession = null;

  if (action === "pause" && ticket.status !== "Completed") {
    ticket.status = "Paused";
  }

  prependActivities(ticket, [
    `Work session ${action === "pause" ? "paused" : "stopped"} after ${formatDurationMinutes(durationMinutes)}`
  ]);

  ticket.updatedAt = nowIso();
  replaceTicket(ticket);
  persistState();
  renderAll();
}

function handleReferenceGridClick(event) {
  const addButton = event.target.closest("[data-add-reference]");
  const removeButton = event.target.closest("[data-remove-reference]");

  if (addButton) {
    addReference(addButton.dataset.addReference);
    return;
  }

  if (removeButton) {
    removeReference(
      removeButton.dataset.removeReference,
      decodeURIComponent(removeButton.dataset.value || "")
    );
  }
}

function addReference(type) {
  const input = el[`${type}Input`];
  const value = cleanText(input.value);

  if (!value) {
    return;
  }

  if (state.references[type].includes(value)) {
    input.value = "";
    return;
  }

  state.references[type].push(value);
  state.references[type] = uniqueStrings(state.references[type]);
  input.value = "";
  persistState();
  renderAll();
}

function removeReference(type, value) {
  if (!type || !value) {
    return;
  }

  if (state.references[type].length <= 1) {
    alert(`Keep at least one ${singularize(type)} in the list.`);
    return;
  }

  if (!window.confirm(`Remove "${value}" from ${type}?`)) {
    return;
  }

  state.references[type] = state.references[type].filter((item) => item !== value);
  persistState();
  renderAll();
}

function handleLoadSample() {
  if (state.tickets.length && !window.confirm("Replace current local data with sample data?")) {
    return;
  }

  state = buildSampleState();
  selectedTicketId = state.tickets[0] ? state.tickets[0].id : null;
  draftTicket = null;
  persistState();
  renderAll();
}

function exportData() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "service-ticket-data.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      selectedTicketId = state.tickets[0] ? state.tickets[0].id : null;
      draftTicket = null;
      persistState();
      renderAll();
    } catch (error) {
      alert("That JSON file could not be imported.");
    } finally {
      el.importFile.value = "";
    }
  };

  reader.readAsText(file);
}

function renderAll() {
  ensureSelection();
  renderFilterOptions();
  renderStats();
  renderTicketList();
  renderReferenceLists();
  renderEditor();
  renderServiceHistoryFromInput();
  renderTimeLogs();
  renderComments();
  renderActivities();
}

function renderStats() {
  const total = state.tickets.length;
  const open = state.tickets.filter((ticket) => ticket.status !== "Completed").length;
  const overdue = state.tickets.filter(isOverdue).length;
  const urgent = state.tickets.filter((ticket) => ticket.priority === "Urgent").length;
  const trackedMinutes = state.tickets.reduce((sum, ticket) => sum + getTrackedMinutes(ticket), 0);

  el.statTotal.textContent = String(total);
  el.statOpen.textContent = String(open);
  el.statOverdue.textContent = String(overdue);
  el.statUrgent.textContent = String(urgent);
  el.statTime.textContent = formatDurationMinutes(trackedMinutes);
}

function renderFilterOptions() {
  const filters = getFilters();
  renderSelectOptions(el.statusFilter, ["All"].concat(STATUS_OPTIONS), filters.status || "All");
  renderSelectOptions(el.priorityFilter, ["All"].concat(PRIORITY_OPTIONS), filters.priority || "All");
  renderSelectOptions(el.assigneeFilter, ["All"].concat(state.references.employees), filters.assignee || "All");
  renderSelectOptions(el.branchFilter, ["All"].concat(state.references.branches), filters.branch || "All");
}

function renderTicketList() {
  const tickets = getFilteredTickets();

  el.ticketCountLabel.textContent = `${tickets.length} visible`;

  if (!tickets.length) {
    el.ticketList.innerHTML = '<div class="empty-state">No tickets match the current filters.</div>';
    return;
  }

  el.ticketList.innerHTML = tickets
    .map((ticket) => {
      const activeClass = ticket.id === selectedTicketId ? "active" : "";
      const overdueClass = isOverdue(ticket) ? "overdue" : "";
      const assigneeLabel = ticket.assignedTo.length ? ticket.assignedTo.join(", ") : "Unassigned";
      const dueLabel = ticket.dueDate ? formatDate(ticket.dueDate) : "No due date";

      return `
        <button type="button" class="ticket-card ${activeClass} ${overdueClass}" data-ticket-id="${escapeHtml(ticket.id)}">
          <div class="ticket-card-top">
            <div>
              <strong>${escapeHtml(ticket.ticketNumber)}</strong>
              <h4>${escapeHtml(ticket.customerName || "Unnamed customer")}</h4>
            </div>
            <div class="badge-row">
              <span class="badge status">${escapeHtml(ticket.status)}</span>
              <span class="badge priority-${ticket.priority.toLowerCase()}">${escapeHtml(ticket.priority)}</span>
            </div>
          </div>
          <div>
            <p>${escapeHtml(ticket.deviceName || "Device pending")} - ${escapeHtml(ticket.taskDescription || "Task pending")}</p>
          </div>
          <div class="ticket-card-bottom">
            <p>${escapeHtml(assigneeLabel)}</p>
            <p>${escapeHtml(dueLabel)}</p>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderEditor() {
  const ticket = getEditorTicket();
  const editingExisting = Boolean(getSelectedTicket());

  el.editorMode.textContent = editingExisting ? "Editing Ticket" : draftTicket ? "Draft Ticket" : "New Ticket";
  el.editorTitle.textContent = editingExisting
    ? `${ticket.ticketNumber} - ${ticket.customerName || "Customer"}`
    : "Create a Service Ticket";
  el.editorSubtitle.textContent = editingExisting
    ? `Status: ${ticket.status}. Assigned to ${ticket.assignedTo.length ? ticket.assignedTo.join(", ") : "nobody yet"}.`
    : "Fill the form, save the ticket, and then use comments, events, and timers on the same workspace.";

  el.ticketNumberReadout.textContent = ticket.ticketNumber || "Will be generated on save";
  el.ticketUpdatedReadout.textContent = ticket.updatedAt ? formatDateTime(ticket.updatedAt) : "Not saved yet";
  el.duplicateTicketBtn.disabled = !editingExisting;
  el.deleteTicketBtn.disabled = !editingExisting;

  renderEditorSelects(ticket);

  el.customerMobile.value = ticket.customerMobile;
  el.customerName.value = ticket.customerName;
  el.deviceName.value = ticket.deviceName;
  el.serviceType.value = ticket.serviceType;
  el.taskDescription.value = ticket.taskDescription;
  el.problemDescription.value = ticket.problemDescription;
  el.priority.value = ticket.priority;
  el.status.value = ticket.status;
  el.startDate.value = ticket.startDate;
  el.dueDate.value = ticket.dueDate;
  el.completedDate.value = ticket.completedDate;
  el.estimateGiven.checked = ticket.estimateGiven;
  el.sparesRequired.checked = ticket.sparesRequired;
  el.sparesOrdered.checked = ticket.sparesOrdered;
  el.estimateForCustomer.value = ticket.estimateForCustomer;
  el.sparesList.value = ticket.sparesList;
  el.totalBillAmount.value = numberInputValue(ticket.totalBillAmount);
  el.advanceTaken.value = numberInputValue(ticket.advanceTaken);
  el.discountGiven.value = numberInputValue(ticket.discountGiven);
  el.finalPayment.value = numberInputValue(ticket.finalPayment);
  el.balanceAmount.value = formatMoney(ticket.balanceAmount);
  el.collected.checked = ticket.collected;
  el.collectedBy.value = ticket.collectedBy;
  el.collectedAt.value = ticket.collectedAt ? formatDateTime(ticket.collectedAt) : "";
  el.solutionGiven.value = ticket.solutionGiven;
  el.solutionOffered.value = ticket.solutionOffered;

  updateBalancePreview();
}

function renderEditorSelects(ticket) {
  renderSelectOptions(el.category, uniqueStrings(state.references.categories.concat(ticket.category || [])), ticket.category);
  renderSelectOptions(el.caseLoggedBy, uniqueStrings(state.references.employees.concat(ticket.caseLoggedBy || [])), ticket.caseLoggedBy);
  renderSelectOptions(el.department, uniqueStrings(state.references.departments.concat(ticket.department || [])), ticket.department);
  renderSelectOptions(el.branch, uniqueStrings(state.references.branches.concat(ticket.branch || [])), ticket.branch);

  const assignees = uniqueStrings(state.references.employees.concat(ticket.assignedTo || []));
  el.assignedToGroup.innerHTML = assignees
    .map((name) => {
      const checked = ticket.assignedTo.includes(name) ? "checked" : "";
      return `
        <label class="check-card">
          <input type="checkbox" value="${escapeHtml(name)}" ${checked}>
          <span>${escapeHtml(name)}</span>
        </label>
      `;
    })
    .join("");
}

function renderServiceHistoryFromInput() {
  const mobile = cleanText(el.customerMobile.value);
  const currentId = getSelectedTicket() ? getSelectedTicket().id : "";

  if (!mobile) {
    el.serviceHistory.innerHTML = '<div class="empty-state">Enter a mobile number to see previous service history.</div>';
    return;
  }

  const matches = state.tickets
    .filter((ticket) => ticket.customerMobile === mobile && ticket.id !== currentId)
    .sort(compareTickets)
    .slice(0, 4);

  if (!matches.length) {
    el.serviceHistory.innerHTML = `<div class="empty-state">No previous tickets found for ${escapeHtml(mobile)}.</div>`;
    return;
  }

  el.serviceHistory.innerHTML = matches
    .map((ticket) => {
      return `
        <article class="history-item">
          <strong>${escapeHtml(ticket.ticketNumber)} - ${escapeHtml(ticket.deviceName)}</strong>
          <p>${escapeHtml(ticket.status)} | ${escapeHtml(ticket.taskDescription)}</p>
          <p>Last updated ${escapeHtml(formatDateTime(ticket.updatedAt || ticket.createdAt))}</p>
        </article>
      `;
    })
    .join("");
}

function renderTimeLogs() {
  const ticket = getSelectedTicket();
  const activeTicket = getActiveTicket();

  el.startTimerBtn.disabled = !ticket || Boolean(ticket && ticket.activeSession) || Boolean(activeTicket && ticket && activeTicket.id !== ticket.id);
  el.pauseTimerBtn.disabled = !ticket || !ticket.activeSession;
  el.stopTimerBtn.disabled = !ticket || !ticket.activeSession;

  if (!ticket) {
    el.timerWarning.textContent = "Save a ticket to start timing";
    el.liveTimer.textContent = "00:00:00";
    el.totalTrackedTime.textContent = "0m";
    el.timeLogList.innerHTML = '<div class="empty-state">Time logs will appear after you save a ticket and start a work session.</div>';
    return;
  }

  if (activeTicket && activeTicket.id !== ticket.id) {
    el.timerWarning.textContent = `Timer running on ${activeTicket.ticketNumber}`;
  } else if (ticket.activeSession) {
    el.timerWarning.textContent = "Live session running";
  } else {
    el.timerWarning.textContent = "No active session";
  }

  el.totalTrackedTime.textContent = formatDurationMinutes(getTrackedMinutes(ticket));
  updateLiveTimerReadout();

  if (!ticket.timeLogs.length) {
    el.timeLogList.innerHTML = '<div class="empty-state">No completed work sessions yet.</div>';
    return;
  }

  el.timeLogList.innerHTML = ticket.timeLogs
    .map((log) => {
      return `
        <article class="timeline-item">
          <div class="timeline-item-head">
            <strong>${escapeHtml(log.endedBy)} session - ${escapeHtml(formatDurationMinutes(log.durationMinutes))}</strong>
            <span>${escapeHtml(formatDateTime(log.endedAt))}</span>
          </div>
          <p>Started ${escapeHtml(formatDateTime(log.startedAt))}</p>
        </article>
      `;
    })
    .join("");
}

function renderComments() {
  const ticket = getSelectedTicket();

  el.addCommentBtn.disabled = !ticket;
  el.commentAuthor.disabled = !ticket;
  el.commentText.disabled = !ticket;

  if (!ticket) {
    el.commentAuthor.value = "";
    el.commentText.value = "";
    el.commentList.innerHTML = '<div class="empty-state">Save a ticket before adding internal comments.</div>';
    return;
  }

  el.commentAuthor.value = ticket.caseLoggedBy || ticket.assignedTo[0] || "";

  if (!ticket.comments.length) {
    el.commentList.innerHTML = '<div class="empty-state">No internal comments yet.</div>';
    return;
  }

  el.commentList.innerHTML = ticket.comments
    .map((comment) => {
      return `
        <article class="timeline-item">
          <div class="timeline-item-head">
            <strong>${escapeHtml(comment.author)}</strong>
            <span>${escapeHtml(formatDateTime(comment.at))}</span>
          </div>
          <p>${escapeHtml(comment.body)}</p>
        </article>
      `;
    })
    .join("");
}

function renderActivities() {
  const ticket = getSelectedTicket();

  if (!ticket) {
    el.activityLog.innerHTML = '<div class="empty-state">Save a ticket to build its activity history.</div>';
    return;
  }

  if (!ticket.activities.length) {
    el.activityLog.innerHTML = '<div class="empty-state">No activity has been recorded yet.</div>';
    return;
  }

  el.activityLog.innerHTML = ticket.activities
    .map((activity) => {
      return `
        <article class="timeline-item">
          <div class="timeline-item-head">
            <strong>${escapeHtml(activity.message)}</strong>
            <span>${escapeHtml(formatDateTime(activity.at))}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderReferenceLists() {
  renderReferenceList("categories");
  renderReferenceList("employees");
  renderReferenceList("departments");
  renderReferenceList("branches");
}

function renderReferenceList(type) {
  const container = el[`${type}List`];
  const values = state.references[type];

  if (!values.length) {
    container.innerHTML = '<div class="empty-state">No items yet.</div>';
    return;
  }

  container.innerHTML = values
    .map((item) => {
      return `
        <span class="pill">
          <span>${escapeHtml(item)}</span>
          <button type="button" aria-label="Remove ${escapeHtml(item)}" data-remove-reference="${type}" data-value="${encodeURIComponent(item)}">x</button>
        </span>
      `;
    })
    .join("");
}

function updateBalancePreview() {
  const balance = computeBalance({
    totalBillAmount: safeNumber(el.totalBillAmount.value),
    advanceTaken: safeNumber(el.advanceTaken.value),
    discountGiven: safeNumber(el.discountGiven.value),
    finalPayment: safeNumber(el.finalPayment.value)
  });

  el.balanceAmount.value = formatMoney(balance);
  el.balanceReadout.textContent = formatMoney(balance);
}

function updateLiveTimerReadout() {
  const ticket = getSelectedTicket();

  if (!ticket || !ticket.activeSession) {
    el.liveTimer.textContent = "00:00:00";
    return;
  }

  const elapsedMs = Date.now() - new Date(ticket.activeSession.startedAt).getTime();
  el.liveTimer.textContent = formatStopwatch(elapsedMs);
}

function readFormTicket(base) {
  const ticket = sanitizeTicket({
    ...base,
    customerMobile: cleanText(el.customerMobile.value),
    customerName: cleanText(el.customerName.value),
    deviceName: cleanText(el.deviceName.value),
    category: cleanText(el.category.value),
    serviceType: cleanText(el.serviceType.value) || "Office",
    taskDescription: cleanText(el.taskDescription.value),
    problemDescription: el.problemDescription.value.trim(),
    caseLoggedBy: cleanText(el.caseLoggedBy.value),
    department: cleanText(el.department.value),
    branch: cleanText(el.branch.value),
    priority: cleanText(el.priority.value) || "Medium",
    status: cleanText(el.status.value) || "Not Started",
    startDate: cleanText(el.startDate.value),
    dueDate: cleanText(el.dueDate.value),
    completedDate: cleanText(el.completedDate.value),
    assignedTo: Array.from(el.assignedToGroup.querySelectorAll("input:checked")).map((input) => cleanText(input.value)),
    estimateGiven: el.estimateGiven.checked,
    sparesRequired: el.sparesRequired.checked,
    sparesOrdered: el.sparesOrdered.checked,
    estimateForCustomer: el.estimateForCustomer.value.trim(),
    sparesList: el.sparesList.value.trim(),
    totalBillAmount: safeNumber(el.totalBillAmount.value),
    advanceTaken: safeNumber(el.advanceTaken.value),
    discountGiven: safeNumber(el.discountGiven.value),
    finalPayment: safeNumber(el.finalPayment.value),
    collected: el.collected.checked,
    collectedBy: cleanText(el.collectedBy.value),
    solutionGiven: el.solutionGiven.value.trim(),
    solutionOffered: el.solutionOffered.value.trim()
  });

  if (ticket.status === "Completed" && !ticket.completedDate) {
    ticket.completedDate = todayDateString();
  }

  if (ticket.collected) {
    if (!ticket.collectedAt) {
      ticket.collectedAt = nowIso();
    }

    if (!ticket.collectedBy) {
      ticket.collectedBy = "Customer";
    }
  } else {
    ticket.collectedAt = "";
    ticket.collectedBy = "";
  }

  ticket.balanceAmount = computeBalance(ticket);
  return ticket;
}

function describeChanges(previousTicket, nextTicket) {
  const changes = [];

  if (previousTicket.customerMobile !== nextTicket.customerMobile) {
    changes.push(`Customer mobile updated to ${nextTicket.customerMobile}`);
  }

  if (previousTicket.customerName !== nextTicket.customerName) {
    changes.push(`Customer name updated to ${nextTicket.customerName}`);
  }

  if (previousTicket.deviceName !== nextTicket.deviceName) {
    changes.push(`Device updated to ${nextTicket.deviceName}`);
  }

  if (previousTicket.taskDescription !== nextTicket.taskDescription) {
    changes.push("Task description updated");
  }

  if (previousTicket.category !== nextTicket.category) {
    changes.push(`Category changed to ${nextTicket.category}`);
  }

  if (previousTicket.caseLoggedBy !== nextTicket.caseLoggedBy) {
    changes.push(`Case logged by changed to ${nextTicket.caseLoggedBy}`);
  }

  if (!sameStringArray(previousTicket.assignedTo, nextTicket.assignedTo)) {
    changes.push(`Assigned to ${nextTicket.assignedTo.length ? nextTicket.assignedTo.join(", ") : "nobody"}`);
  }

  if (previousTicket.department !== nextTicket.department) {
    changes.push(`Department moved to ${nextTicket.department}`);
  }

  if (previousTicket.branch !== nextTicket.branch) {
    changes.push(`Branch moved to ${nextTicket.branch}`);
  }

  if (previousTicket.priority !== nextTicket.priority) {
    changes.push(`Priority changed to ${nextTicket.priority}`);
  }

  if (previousTicket.status !== nextTicket.status) {
    changes.push(`Status changed to ${nextTicket.status}`);
  }

  if (previousTicket.dueDate !== nextTicket.dueDate) {
    changes.push(`Due date updated to ${nextTicket.dueDate ? formatDate(nextTicket.dueDate) : "not set"}`);
  }

  if (previousTicket.estimateGiven !== nextTicket.estimateGiven || previousTicket.estimateForCustomer !== nextTicket.estimateForCustomer) {
    changes.push("Estimate details updated");
  }

  if (
    previousTicket.sparesRequired !== nextTicket.sparesRequired ||
    previousTicket.sparesOrdered !== nextTicket.sparesOrdered ||
    previousTicket.sparesList !== nextTicket.sparesList
  ) {
    changes.push("Spare parts details updated");
  }

  if (
    previousTicket.totalBillAmount !== nextTicket.totalBillAmount ||
    previousTicket.advanceTaken !== nextTicket.advanceTaken ||
    previousTicket.discountGiven !== nextTicket.discountGiven ||
    previousTicket.finalPayment !== nextTicket.finalPayment
  ) {
    changes.push(`Billing updated. Balance is now ${formatMoney(nextTicket.balanceAmount)}`);
  }

  if (previousTicket.collected !== nextTicket.collected || previousTicket.collectedBy !== nextTicket.collectedBy) {
    changes.push(nextTicket.collected ? `Device collected by ${nextTicket.collectedBy || "Customer"}` : "Collection tracking reset");
  }

  if (previousTicket.solutionGiven !== nextTicket.solutionGiven || previousTicket.solutionOffered !== nextTicket.solutionOffered) {
    changes.push("Solution notes updated");
  }

  if (!changes.length) {
    changes.push("Ticket details refreshed");
  }

  return changes;
}

function buildCreationMessages(ticket) {
  const messages = ["Ticket created"];

  if (ticket.caseLoggedBy) {
    messages.push(`Case logged by ${ticket.caseLoggedBy}`);
  }

  if (ticket.assignedTo.length) {
    messages.push(`Assigned to ${ticket.assignedTo.join(", ")}`);
  }

  if (ticket.dueDate) {
    messages.push(`Due date set to ${formatDate(ticket.dueDate)}`);
  }

  return messages;
}

function prependActivities(ticket, messages) {
  ticket.activities = messages
    .filter(Boolean)
    .map((message) => ({ id: makeId("activity"), message, at: nowIso() }))
    .concat(ticket.activities || []);
}

function replaceTicket(updatedTicket) {
  state.tickets = state.tickets.map((ticket) => (ticket.id === updatedTicket.id ? sanitizeTicket(updatedTicket) : ticket));
}

function getFilteredTickets() {
  const filters = getFilters();
  const search = cleanText(filters.search).toLowerCase();

  return state.tickets
    .filter((ticket) => {
      const searchable = [
        ticket.ticketNumber,
        ticket.customerName,
        ticket.customerMobile,
        ticket.deviceName,
        ticket.taskDescription,
        ticket.branch,
        ticket.department,
        ticket.assignedTo.join(" ")
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || searchable.includes(search);
      const matchesStatus = filters.status === "All" || ticket.status === filters.status;
      const matchesPriority = filters.priority === "All" || ticket.priority === filters.priority;
      const matchesAssignee = filters.assignee === "All" || ticket.assignedTo.includes(filters.assignee);
      const matchesBranch = filters.branch === "All" || ticket.branch === filters.branch;

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesBranch;
    })
    .sort(compareTickets);
}

function compareTickets(left, right) {
  return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
}

function getFilters() {
  return {
    search: el.searchInput.value || "",
    status: el.statusFilter.value || "All",
    priority: el.priorityFilter.value || "All",
    assignee: el.assigneeFilter.value || "All",
    branch: el.branchFilter.value || "All"
  };
}

function ensureSelection() {
  if (selectedTicketId && !state.tickets.some((ticket) => ticket.id === selectedTicketId)) {
    selectedTicketId = null;
  }

  if (!selectedTicketId && !draftTicket) {
    draftTicket = createBlankTicket();
  }
}

function getSelectedTicket() {
  return state.tickets.find((ticket) => ticket.id === selectedTicketId) || null;
}

function getEditorTicket() {
  return getSelectedTicket() || draftTicket || createBlankTicket();
}

function getActiveTicket() {
  return state.tickets.find((ticket) => ticket.activeSession) || null;
}

function getTrackedMinutes(ticket) {
  return roundToTwo((ticket.timeLogs || []).reduce((sum, log) => sum + safeNumber(log.durationMinutes), 0));
}

function renderSelectOptions(select, values, selectedValue) {
  const uniqueValues = uniqueStrings(values.filter(Boolean));

  select.innerHTML = uniqueValues
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");

  if (uniqueValues.includes(selectedValue)) {
    select.value = selectedValue;
  } else if (uniqueValues.length) {
    select.value = uniqueValues[0];
  }
}

function createBlankTicket() {
  return sanitizeTicket({
    id: "",
    ticketNumber: "",
    customerMobile: "",
    customerName: "",
    deviceName: "",
    category: DEFAULT_REFERENCES.categories[0],
    serviceType: "Office",
    taskDescription: "",
    problemDescription: "",
    caseLoggedBy: DEFAULT_REFERENCES.employees[0],
    assignedTo: [],
    department: DEFAULT_REFERENCES.departments[0],
    branch: DEFAULT_REFERENCES.branches[0],
    priority: "Medium",
    status: "Not Started",
    startDate: todayDateString(),
    dueDate: "",
    completedDate: "",
    estimateGiven: false,
    estimateForCustomer: "",
    sparesRequired: false,
    sparesList: "",
    sparesOrdered: false,
    totalBillAmount: 0,
    advanceTaken: 0,
    discountGiven: 0,
    finalPayment: 0,
    balanceAmount: 0,
    solutionGiven: "",
    solutionOffered: "",
    collected: false,
    collectedBy: "",
    collectedAt: "",
    comments: [],
    timeLogs: [],
    activities: [],
    activeSession: null,
    createdAt: "",
    updatedAt: ""
  });
}

function normalizeState(raw) {
  const references = {
    categories: normalizeReferenceArray(raw?.references?.categories, DEFAULT_REFERENCES.categories),
    employees: normalizeReferenceArray(raw?.references?.employees, DEFAULT_REFERENCES.employees),
    departments: normalizeReferenceArray(raw?.references?.departments, DEFAULT_REFERENCES.departments),
    branches: normalizeReferenceArray(raw?.references?.branches, DEFAULT_REFERENCES.branches)
  };

  const tickets = Array.isArray(raw?.tickets) ? raw.tickets.map(sanitizeTicket) : [];
  const lastTicketNumber = Math.max(
    safeInteger(raw?.meta?.lastTicketNumber),
    tickets.reduce((max, ticket) => Math.max(max, extractTicketCounter(ticket.ticketNumber)), 0)
  );

  return {
    references,
    tickets,
    meta: {
      lastTicketNumber,
      lastSelectedTicketId: raw?.meta?.lastSelectedTicketId || ""
    }
  };
}

function sanitizeTicket(raw) {
  const base = {
    id: "",
    ticketNumber: "",
    customerMobile: "",
    customerName: "",
    deviceName: "",
    category: "",
    serviceType: "Office",
    taskDescription: "",
    problemDescription: "",
    caseLoggedBy: "",
    assignedTo: [],
    department: "",
    branch: "",
    priority: "Medium",
    status: "Not Started",
    startDate: "",
    dueDate: "",
    completedDate: "",
    estimateGiven: false,
    estimateForCustomer: "",
    sparesRequired: false,
    sparesList: "",
    sparesOrdered: false,
    totalBillAmount: 0,
    advanceTaken: 0,
    discountGiven: 0,
    finalPayment: 0,
    balanceAmount: 0,
    solutionGiven: "",
    solutionOffered: "",
    collected: false,
    collectedBy: "",
    collectedAt: "",
    comments: [],
    timeLogs: [],
    activities: [],
    activeSession: null,
    createdAt: "",
    updatedAt: ""
  };

  const ticket = { ...base, ...raw };
  ticket.customerMobile = cleanText(ticket.customerMobile);
  ticket.customerName = cleanText(ticket.customerName);
  ticket.deviceName = cleanText(ticket.deviceName);
  ticket.category = cleanText(ticket.category);
  ticket.serviceType = cleanText(ticket.serviceType) || "Office";
  ticket.taskDescription = cleanText(ticket.taskDescription);
  ticket.problemDescription = String(ticket.problemDescription || "").trim();
  ticket.caseLoggedBy = cleanText(ticket.caseLoggedBy);
  ticket.assignedTo = normalizeReferenceArray(ticket.assignedTo, []);
  ticket.department = cleanText(ticket.department);
  ticket.branch = cleanText(ticket.branch);
  ticket.priority = PRIORITY_OPTIONS.includes(ticket.priority) ? ticket.priority : "Medium";
  ticket.status = STATUS_OPTIONS.includes(ticket.status) ? ticket.status : "Not Started";
  ticket.startDate = cleanText(ticket.startDate);
  ticket.dueDate = cleanText(ticket.dueDate);
  ticket.completedDate = cleanText(ticket.completedDate);
  ticket.estimateGiven = Boolean(ticket.estimateGiven);
  ticket.estimateForCustomer = String(ticket.estimateForCustomer || "").trim();
  ticket.sparesRequired = Boolean(ticket.sparesRequired);
  ticket.sparesList = String(ticket.sparesList || "").trim();
  ticket.sparesOrdered = Boolean(ticket.sparesOrdered);
  ticket.totalBillAmount = safeNumber(ticket.totalBillAmount);
  ticket.advanceTaken = safeNumber(ticket.advanceTaken);
  ticket.discountGiven = safeNumber(ticket.discountGiven);
  ticket.finalPayment = safeNumber(ticket.finalPayment);
  ticket.balanceAmount = computeBalance(ticket);
  ticket.solutionGiven = String(ticket.solutionGiven || "").trim();
  ticket.solutionOffered = String(ticket.solutionOffered || "").trim();
  ticket.collected = Boolean(ticket.collected);
  ticket.collectedBy = cleanText(ticket.collectedBy);
  ticket.collectedAt = String(ticket.collectedAt || "");
  ticket.comments = Array.isArray(ticket.comments) ? ticket.comments.map(sanitizeComment) : [];
  ticket.timeLogs = Array.isArray(ticket.timeLogs) ? ticket.timeLogs.map(sanitizeTimeLog) : [];
  ticket.activities = Array.isArray(ticket.activities) ? ticket.activities.map(sanitizeActivity) : [];
  ticket.activeSession = sanitizeActiveSession(ticket.activeSession);
  ticket.createdAt = String(ticket.createdAt || "");
  ticket.updatedAt = String(ticket.updatedAt || "");
  return ticket;
}

function sanitizeComment(raw) {
  return {
    id: raw?.id || makeId("comment"),
    author: cleanText(raw?.author) || "Team Member",
    body: String(raw?.body || "").trim(),
    at: String(raw?.at || nowIso())
  };
}

function sanitizeTimeLog(raw) {
  return {
    id: raw?.id || makeId("session"),
    startedAt: String(raw?.startedAt || nowIso()),
    endedAt: String(raw?.endedAt || nowIso()),
    endedBy: raw?.endedBy === "Pause" ? "Pause" : "Stop",
    durationMinutes: safeNumber(raw?.durationMinutes)
  };
}

function sanitizeActivity(raw) {
  return {
    id: raw?.id || makeId("activity"),
    message: String(raw?.message || "").trim(),
    at: String(raw?.at || nowIso())
  };
}

function sanitizeActiveSession(raw) {
  if (!raw || !raw.startedAt) {
    return null;
  }

  return {
    id: raw.id || makeId("session"),
    startedAt: String(raw.startedAt)
  };
}

function normalizeReferenceArray(list, fallback) {
  if (!Array.isArray(list) || !list.length) {
    return uniqueStrings(fallback);
  }

  return uniqueStrings(list.map(cleanText).filter(Boolean));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function persistState() {
  state.meta.lastSelectedTicketId = selectedTicketId || "";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildSampleState() {
  const today = todayDateString();
  const tomorrow = shiftDate(today, 1);
  const yesterday = shiftDate(today, -1);
  const twoDaysAgo = shiftDate(today, -2);

  const first = sanitizeTicket({
    ...createBlankTicket(),
    id: makeId("ticket"),
    ticketNumber: "ST-0001",
    customerMobile: "9876543210",
    customerName: "Rohan Patil",
    deviceName: "Dell Laptop",
    category: "Laptop",
    taskDescription: "Screen flickering and display cable inspection",
    problemDescription: "Laptop screen flickers when the hinge moves. Suspected loose display cable.",
    caseLoggedBy: "Amit",
    assignedTo: ["Rahul", "Sneha"],
    department: "Repair Lab",
    branch: "Main Branch",
    priority: "High",
    status: "In Progress",
    startDate: yesterday,
    dueDate: tomorrow,
    estimateGiven: true,
    estimateForCustomer: "Estimated Rs. 3200 for cable and screen inspection.",
    sparesRequired: true,
    sparesList: "Display cable, hinge bracket",
    sparesOrdered: true,
    totalBillAmount: 3200,
    advanceTaken: 1000,
    discountGiven: 200,
    finalPayment: 0,
    solutionOffered: "Replace cable and stabilize hinge pressure.",
    comments: [
      {
        id: makeId("comment"),
        author: "Rahul",
        body: "Spare ordered from supplier. Awaiting delivery confirmation.",
        at: nowIso()
      }
    ],
    timeLogs: [
      {
        id: makeId("session"),
        startedAt: `${yesterday}T10:15:00`,
        endedAt: `${yesterday}T11:00:00`,
        endedBy: "Pause",
        durationMinutes: 45
      }
    ],
    activities: [
      { id: makeId("activity"), message: "Spare parts marked as ordered", at: nowIso() },
      { id: makeId("activity"), message: "Assigned to Rahul, Sneha", at: nowIso() },
      { id: makeId("activity"), message: "Ticket created", at: nowIso() }
    ],
    createdAt: `${twoDaysAgo}T09:00:00`,
    updatedAt: nowIso()
  });

  const second = sanitizeTicket({
    ...createBlankTicket(),
    id: makeId("ticket"),
    ticketNumber: "ST-0002",
    customerMobile: "9988776655",
    customerName: "Meera Joshi",
    deviceName: "Office Printer",
    category: "Printer",
    taskDescription: "Paper jam and roller cleaning",
    problemDescription: "Repeated paper jam in tray two and toner smudging.",
    caseLoggedBy: "Priya",
    assignedTo: ["Amit"],
    department: "Field Service",
    branch: "North Branch",
    priority: "Medium",
    status: "Completed",
    startDate: twoDaysAgo,
    dueDate: yesterday,
    completedDate: yesterday,
    totalBillAmount: 1800,
    advanceTaken: 500,
    discountGiven: 100,
    finalPayment: 1200,
    solutionGiven: "Cleaned roller assembly, removed jammed scraps, recalibrated feeder.",
    solutionOffered: "Monthly maintenance recommended for the next quarter.",
    collected: true,
    collectedBy: "Customer",
    collectedAt: nowIso(),
    timeLogs: [
      {
        id: makeId("session"),
        startedAt: `${twoDaysAgo}T12:00:00`,
        endedAt: `${twoDaysAgo}T12:45:00`,
        endedBy: "Stop",
        durationMinutes: 45
      }
    ],
    activities: [
      { id: makeId("activity"), message: "Device collected by Customer", at: nowIso() },
      { id: makeId("activity"), message: "Status changed to Completed", at: nowIso() },
      { id: makeId("activity"), message: "Ticket created", at: nowIso() }
    ],
    createdAt: `${twoDaysAgo}T11:30:00`,
    updatedAt: nowIso()
  });

  return normalizeState({
    references: DEFAULT_REFERENCES,
    tickets: [first, second],
    meta: {
      lastTicketNumber: 2,
      lastSelectedTicketId: first.id
    }
  });
}

function nextTicketNumber() {
  state.meta.lastTicketNumber += 1;
  return `ST-${String(state.meta.lastTicketNumber).padStart(4, "0")}`;
}

function extractTicketCounter(ticketNumber) {
  const match = String(ticketNumber || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function safeNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? roundToTwo(parsed) : 0;
}

function safeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeBalance(ticket) {
  return roundToTwo(
    safeNumber(ticket.totalBillAmount) -
      (safeNumber(ticket.advanceTaken) + safeNumber(ticket.discountGiven) + safeNumber(ticket.finalPayment))
  );
}

function isOverdue(ticket) {
  return Boolean(ticket.dueDate && ticket.status !== "Completed" && ticket.dueDate < todayDateString());
}

function shiftDate(inputDate, days) {
  const date = new Date(`${inputDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localInputDate(date);
}

function localInputDate(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function todayDateString() {
  return localInputDate(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

function formatDate(input) {
  if (!input) {
    return "Not set";
  }

  const date = input.includes("T") ? new Date(input) : new Date(`${input}T00:00:00`);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(input) {
  if (!input) {
    return "Not set";
  }

  return new Date(input).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(value) {
  return `Rs. ${safeNumber(value).toFixed(2)}`;
}

function formatDurationMinutes(minutes) {
  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours && mins) {
    return `${hours}h ${mins}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${mins}m`;
}

function formatStopwatch(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function numberInputValue(value) {
  return safeNumber(value) ? String(safeNumber(value)) : "";
}

function roundToTwo(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function sameStringArray(left, right) {
  return [...uniqueStrings(left)].sort().join("|") === [...uniqueStrings(right)].sort().join("|");
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function singularize(value) {
  return value.endsWith("s") ? value.slice(0, -1) : value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
