// ### FILE: app.js (MODIFIED) ###

import {
    initializeFirebase,
    handleAuth,
    listenToRequests,
    performAdminAction
} from './firebase-service.js';

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyDjr_Ha2RxOWEumjEeSdluIW3JmyM76mVk",
    authDomain: "dipermisstion.firebaseapp.com",
    projectId: "dipermisstion",
    storageBucket: "dipermisstion.firebasestorage.app",
    messagingSenderId: "512999406057",
    appId: "1:512999406057:web:953a281ab9dde7a9a0f378",
    measurementId: "G-KDPHXZ7H4B"
};

// --- Global State & Element References ---
const ADMIN_NAME = "លោកគ្រូ ពៅ ដារ៉ូ";
let globalAllRequests = []; // For detail modal
let allDepartments = new Set(); // For department filter

// --- Element References ---
let mainContentArea, requestListContainer, loadingIndicator, emptyPlaceholder, errorDisplay, footerNav;
let settingsPage, toggleMonthFilter, toggleCompactView;
let currentFilter = 'pending'; // Default filter

// --- Settings Elements ---
let approvedFilterRadios, toggleDepartmentFilter, departmentFilterContainer, departmentSelect;
let darkModeRadios, themeSelect;

// --- Settings State ---
let settings = {
    filterCurrentMonth: false,
    compactViewApproved: false,
    approvedFilterType: 'all', // 'all', 'leave', 'out'
    filterByDepartment: false,
    selectedDepartment: 'all', // 'all', or 'IT Support', etc.
    darkMode: 'auto', // 'auto', 'light', 'dark'
    theme: 'original' // 'original', 'glass', 'ocean', etc.
};

// --- Modal References ---
let confirmationModal, confirmationTitle, confirmationMessage, confirmYesBtn, confirmNoBtn;
let customAlertModal, customAlertTitle, customAlertMessage, customAlertIconSuccess, customAlertIconWarning;
let requestDetailModal, detailModalContent, detailModalCloseBtn;


// --- Helper: Format Timestamp ---
function formatFirestoreTimestamp(timestamp, format = 'HH:mm dd/MM/yyyy') {
     let date;
     if (!timestamp) return "";
     if (timestamp.toDate) date = timestamp.toDate();
     else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
     else if (timestamp instanceof Date) date = timestamp;
     else if (typeof timestamp === 'string') { date = new Date(timestamp); if (isNaN(date.getTime())) return ""; }
     else return "";
     const hours = String(date.getHours()).padStart(2, '0');
     const minutes = String(date.getMinutes()).padStart(2, '0');
     const day = String(date.getDate()).padStart(2, '0');
     const month = String(date.getMonth() + 1).padStart(2, '0');
     const year = date.getFullYear();
     if (format === 'HH:mm' || format === 'time') return `${hours}:${minutes}`;
     if (format === 'dd/MM/yyyy' || format === 'date') return `${day}/${month}/${year}`;
     return `${hours}:${minutes} ${day}/${month}/${year}`;
}

// --- Settings Functions ---
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('adminSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            settings = { ...settings, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load settings:", e);
        localStorage.removeItem('adminSettings');
    }
    
    if (toggleMonthFilter) toggleMonthFilter.checked = settings.filterCurrentMonth;
    if (toggleCompactView) toggleCompactView.checked = settings.compactViewApproved;
    if (approvedFilterRadios) approvedFilterRadios.forEach(radio => radio.checked = (radio.value === settings.approvedFilterType));
    if (toggleDepartmentFilter) toggleDepartmentFilter.checked = settings.filterByDepartment;
    if (departmentFilterContainer) departmentFilterContainer.classList.toggle('hidden', !settings.filterByDepartment);
    if (departmentSelect) departmentSelect.value = settings.selectedDepartment;
    if (darkModeRadios) darkModeRadios.forEach(radio => radio.checked = (radio.value === settings.darkMode));
    if (themeSelect) themeSelect.value = settings.theme;

    applyDarkMode();
    applyTheme();
}

function saveSettings() {
    try {
        localStorage.setItem('adminSettings', JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings:", e);
    }
}
 
// --- Dark Mode & Theme Functions ---
function applyDarkMode() {
    const root = document.documentElement;
    if (settings.darkMode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
    } else if (settings.darkMode === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
}
 
function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    document.getElementById('body-bg-image').classList.toggle('hidden', settings.theme !== 'glass');
}
 
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (settings.darkMode === 'auto') {
        applyDarkMode();
    }
});

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {

    // --- Assign Element References ---
    mainContentArea = document.getElementById('main-content-area');
    requestListContainer = document.getElementById('request-list');
    loadingIndicator = document.getElementById('loading-indicator');
    emptyPlaceholder = document.getElementById('empty-placeholder');
    errorDisplay = document.getElementById('error-display');
    footerNav = document.getElementById('footer-nav');
    settingsPage = document.getElementById('settings-page');
    toggleMonthFilter = document.getElementById('toggle-month-filter');
    toggleCompactView = document.getElementById('toggle-compact-view');
    
    approvedFilterRadios = document.querySelectorAll('input[name="approved-filter-type"]');
    toggleDepartmentFilter = document.getElementById('toggle-department-filter');
    departmentFilterContainer = document.getElementById('department-filter-container');
    departmentSelect = document.getElementById('department-select');
    darkModeRadios = document.querySelectorAll('input[name="dark-mode-select"]');
    themeSelect = document.getElementById('theme-select');

    customAlertModal = document.getElementById('custom-alert-modal');
    customAlertTitle = document.getElementById('custom-alert-title');
    customAlertMessage = document.getElementById('custom-alert-message');
    customAlertIconSuccess = document.getElementById('custom-alert-icon-success');
    customAlertIconWarning = document.getElementById('custom-alert-icon-warning');
    
    confirmationModal = document.getElementById('confirmation-modal');
    confirmationTitle = document.getElementById('confirmation-title');
    confirmationMessage = document.getElementById('confirmation-message');
    confirmYesBtn = document.getElementById('confirm-yes-btn');
    confirmNoBtn = document.getElementById('confirm-no-btn');

    requestDetailModal = document.getElementById('request-detail-modal');
    detailModalContent = document.getElementById('detail-modal-content');
    detailModalCloseBtn = document.getElementById('detail-modal-close-btn');
    
    const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');

    // --- Load Settings from localStorage ---
    loadSettings();

    // --- Initialize Firebase ---
    const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const { success, error } = initializeFirebase(firebaseConfig, canvasAppId);

    if (!success) {
        showError(`Critical Error: មិនអាច​តភ្ជាប់ Firebase បាន​ទេ។ ${error.message}។ សូម Refresh ម្ដងទៀត។`);
        return;
    }

    // --- Firebase Authentication ---
    handleAuth(
        (user) => {
            // OnUser
            setupRequestListener(currentFilter); 
            updateActiveNavButton(currentFilter);
        },
        (anonError) => {
            // OnNoUser
            showError(`Critical Error: មិនអាច Sign In បានទេ។ ${anonError.message}។`);
        }
    );
    
    // --- Footer Navigation Listener ---
    if (footerNav) {
        footerNav.addEventListener('click', (event) => {
            const navButton = event.target.closest('.filter-nav-btn');
            if (!navButton || !navButton.dataset.filter) return;

            const newFilter = navButton.dataset.filter;
            
            if (newFilter === 'settings') {
                if (mainContentArea) mainContentArea.classList.add('hidden');
                if (settingsPage) settingsPage.classList.remove('hidden');
                currentFilter = 'settings';
            } else {
                if (mainContentArea) mainContentArea.classList.remove('hidden');
                if (settingsPage) settingsPage.classList.add('hidden');
                
                if (newFilter !== currentFilter) {
                    console.log("Filter changed to:", newFilter);
                    currentFilter = newFilter;
                    setupRequestListener(currentFilter); 
                }
            }
            updateActiveNavButton(currentFilter);
        });
    }

    // --- Event Listener for Card Action Buttons & Compact Cards ---
    if (requestListContainer) {
        requestListContainer.addEventListener('click', (event) => {
            const actionButton = event.target.closest('.action-btn');
            const compactCard = event.target.closest('.compact-card-btn');
            
            if (actionButton) {
                promptForAdminAction(actionButton);
            } else if (compactCard) {
                const { id, type } = compactCard.dataset;
                const request = globalAllRequests.find(r => r.id === id && r.type === type);
                if (request) showRequestDetailModal(request);
            }
        });
    }

    // --- Listeners for Modals ---
    if (customAlertOkBtn) customAlertOkBtn.addEventListener('click', hideCustomAlert);
    if (confirmNoBtn) confirmNoBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));
    if (detailModalCloseBtn) detailModalCloseBtn.addEventListener('click', hideRequestDetailModal);
    if (requestDetailModal) requestDetailModal.addEventListener('click', (e) => { if(e.target === requestDetailModal) hideRequestDetailModal(); });

    // [*** បន្ថែមថ្មី ***] Listener សម្រាប់ប៊ូតុងលុប (Delete) នៅក្នុង Detail Modal
    if (detailModalContent) {
        detailModalContent.addEventListener('click', (event) => {
            const actionButton = event.target.closest('.action-btn');
            // ត្រូវប្រាកដថាវាជាប៊ូតុង 'delete'
            if (actionButton && actionButton.dataset.action === 'delete') {
                promptForAdminAction(actionButton);
            }
        });
    }

    // [*** កែសម្រួល ***] Listener សម្រាប់ប៊ូតុង 'Yes' ក្នុង Confirmation Modal
    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            const { id, type, action } = confirmYesBtn.dataset;
            if (id && type && action) {
                // [កែសម្រួល] លាក់ Detail Modal (ប្រសិនបើវាកំពុងបើក) មុនពេលដំណើរការ
                if (requestDetailModal && !requestDetailModal.classList.contains('hidden')) {
                    hideRequestDetailModal();
                }
                executeAdminAction(id, type, action); // Call the UI-side function
            }
            confirmationModal.classList.add('hidden');
        });
    }

    // --- Listeners for Settings Toggles ---
    if (toggleMonthFilter) {
        toggleMonthFilter.addEventListener('change', (e) => {
            settings.filterCurrentMonth = e.target.checked;
            saveSettings();
            if (currentFilter !== 'settings') setupRequestListener(currentFilter);
        });
    }
    if (toggleCompactView) {
        toggleCompactView.addEventListener('change', (e) => {
            settings.compactViewApproved = e.target.checked;
            saveSettings();
            if (currentFilter === 'approved') sortAndRenderRequests(globalAllRequests, currentFilter);
        });
    }
    if (approvedFilterRadios) {
        approvedFilterRadios.forEach(radio => radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                settings.approvedFilterType = e.target.value;
                saveSettings();
                if (currentFilter === 'approved') setupRequestListener(currentFilter);
            }
        }));
    }
    if (toggleDepartmentFilter) {
        toggleDepartmentFilter.addEventListener('change', (e) => {
            settings.filterByDepartment = e.target.checked;
            departmentFilterContainer.classList.toggle('hidden', !settings.filterByDepartment);
            if (!settings.filterByDepartment) {
                settings.selectedDepartment = 'all';
                departmentSelect.value = 'all';
            }
            saveSettings();
            if (currentFilter !== 'settings') setupRequestListener(currentFilter);
        });
    }
    if (departmentSelect) {
        departmentSelect.addEventListener('change', (e) => {
            settings.selectedDepartment = e.target.value;
            saveSettings();
            if (currentFilter !== 'settings') setupRequestListener(currentFilter);
        });
    }
    if (darkModeRadios) {
        darkModeRadios.forEach(radio => radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                settings.darkMode = e.target.value;
                saveSettings();
                applyDarkMode();
            }
        }));
    }
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            settings.theme = e.target.value;
            saveSettings();
            applyTheme();
        });
    }
}); // End DOMContentLoaded

// --- Update Active Nav Button ---
function updateActiveNavButton(activeFilter) {
    if (!footerNav) return;
    const buttons = footerNav.querySelectorAll('.filter-nav-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('text-primary', btn.dataset.filter === activeFilter);
        btn.classList.toggle('bg-secondary', btn.dataset.filter === activeFilter);
        btn.classList.toggle('text-secondary', btn.dataset.filter !== activeFilter);
    });
}

// --- Show Error Message ---
function showError(message) {
    const errorText = (message instanceof Error) ? message.message : message;
    if (errorDisplay) { errorDisplay.textContent = errorText; errorDisplay.classList.remove('hidden'); }
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    if (requestListContainer) requestListContainer.innerHTML = '';
    if (emptyPlaceholder) emptyPlaceholder.classList.add('hidden');
}

// --- Populate Department Filter Dropdown ---
function populateDepartmentDropdown() {
    if (!departmentSelect) return;
    const currentVal = departmentSelect.value;
    departmentSelect.innerHTML = '<option value="all">-- គ្រប់ផ្នែកទាំងអស់ --</option>';
    const sortedDepartments = [...allDepartments].filter(d => d).sort(); 
    sortedDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentSelect.appendChild(option);
    });
    departmentSelect.value = currentVal;
}

// --- Setup Firestore Listener ---
function setupRequestListener(statusFilter = 'pending') {
    console.log(`Setting up listener for status: ${statusFilter}`);

    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (emptyPlaceholder) emptyPlaceholder.classList.add('hidden');
    if (errorDisplay) errorDisplay.classList.add('hidden');
    if (requestListContainer) requestListContainer.innerHTML = '';
    
    const initialDepartmentCount = allDepartments.size;

    listenToRequests(
        statusFilter,
        settings,
        // onDataUpdate callback
        (requests, newDepartments, initialLoadsPending) => {
            allDepartments = newDepartments;
            sortAndRenderRequests(requests, statusFilter); 
            
            if (initialLoadsPending > 0) {
                 if (loadingIndicator) loadingIndicator.classList.add('hidden');
            }
            if(requests.length === 0 && loadingIndicator.classList.contains('hidden')) {
                if (emptyPlaceholder) emptyPlaceholder.classList.remove('hidden');
            }
            if (allDepartments.size > initialDepartmentCount) {
                populateDepartmentDropdown();
            }
        },
        // onError callback
        (error) => {
            console.error(`Error listening to requests:`, error);
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                showError(`Error: Firestore index required. Please check console for link to create index.`);
            } else {
                showError(`Error loading data: ${error.message}. Check Firestore Rules.`);
            }
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
        }
    );
}

// --- Sort and Render Combined Requests ---
 function sortAndRenderRequests(requests, currentFilter) {
     globalAllRequests = [...requests]; 
     requests.sort((a, b) => {
         const statusPriority = { 'pending': 1, 'editing': 2, 'approved': 3, 'rejected': 4 };
         const priorityA = statusPriority[a.status] || 5;
         const priorityB = statusPriority[b.status] || 5;
         if (currentFilter !== 'approved' && currentFilter !== 'rejected' && priorityA !== priorityB) {
             return priorityA - priorityB;
         }
         const timeA = a.requestedAt?.toMillis() ?? a.requestedAt?.seconds ?? 0;
         const timeB = b.requestedAt?.toMillis() ?? b.requestedAt?.seconds ?? 0;
         return (currentFilter === 'pending') ? (timeA - timeB) : (timeB - timeA);
     });
     renderRequestList(requests);
 }

// --- Render Request List ---
function renderRequestList(requests) {
    if (!requestListContainer) return;
    const isCompact = (currentFilter === 'approved' && settings.compactViewApproved);
    requestListContainer.className = isCompact ? "grid grid-cols-3 gap-2 pb-20" : "space-y-4 pb-20";

    if (requests.length === 0) {
        if(emptyPlaceholder) emptyPlaceholder.classList.remove('hidden');
        requestListContainer.innerHTML = '';
    } else {
        if(emptyPlaceholder) emptyPlaceholder.classList.add('hidden');
        requestListContainer.innerHTML = requests.map(req => 
            isCompact ? renderCompactCard(req) : renderRequestCard(req)
        ).join('');
    }
}
 
// --- Render Compact Card ---
function renderCompactCard(request) {
    const typeText = request.type === 'leave' ? 'ច្បាប់ឈប់' : 'ចេញក្រៅ';
    const typeColor = request.type === 'leave' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
    const typeDarkColor = request.type === 'leave' ? 'dark:bg-blue-900 dark:text-blue-200' : 'dark:bg-green-900 dark:text-green-200';
    
    return `
    <div class="compact-card-btn card-bg border border-primary rounded-lg p-2 shadow-sm hover:shadow-md hover:border-blue-400 cursor-pointer transition-all duration-150" data-id="${request.id}" data-type="${request.type}">
        <div class="flex items-center gap-2">
            ${request.photo ? `<img src="${request.photo}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="this.onerror=null; this.src='https://placehold.co/32x32/e2e8f0/64748b?text=?';">` : `<div class="w-8 h-8 rounded-full bg-secondary text-secondary flex items-center justify-center flex-shrink-0"><i class="fas fa-user"></i></div>`}
            <div class="overflow-hidden min-w-0">
                <p class="text-xs font-semibold truncate text-primary">${request.name || 'N/A'}</p>
                <p class="text-xs text-secondary truncate">(${request.userId || 'N/A'})</p>
            </div>
        </div>
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColor} ${typeDarkColor} mt-1.5 inline-block">${typeText}</span>
        <p class="text-xs text-primary mt-1 truncate">${request.startDate || ''}</p>
    </div>
    `;
}

// --- [*** បង្កើត Function ថ្មី ***] ---
/**
 * ពិនិត្យមើល Logic សម្រាប់ប៊ូតុងលុប (Delete Button Logic)
 * ប្រើរួមគ្នាដោយ renderRequestCard និង showRequestDetailModal
 */
function getDeleteButtonHtml(request) {
    let deleteButton = ''; // Default: មិនបង្ហាញប៊ូតុងលុប
    const now = new Date();

    if (request.status === 'pending') {
        // (Part 1) អនុញ្ញាតឲ្យលុប ពេល 'pending'
        deleteButton = `
            <button data-id="${request.id}" data-type="${request.type}" data-action="delete" class="action-btn text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500 transition-colors duration-150 p-1 rounded-full" title="លុប">
                <i class="fas fa-trash-alt fa-fw"></i>
            </button>
        `;
    } else if (request.status === 'editing') {
        // (Part 1) មិនអនុញ្ញាតឲ្យលុប ពេល 'editing'
        deleteButton = `
            <span class="text-gray-400 dark:text-gray-500 p-1" title="កំពុងកែសម្រួល, មិនអាចលុបបាន">
                <i class="fas fa-ban fa-fw"></i>
            </span>
        `;
    } else if (request.status === 'approved' || request.status === 'rejected') {
        // (Part 2) ពិនិត្យច្បាប់ 55 នាទី
        let decisionTime;
        
        if (request.decisionAt?.toDate) {
            decisionTime = request.decisionAt.toDate(); // ពី Firestore Timestamp
        } else if (request.decisionAt?.seconds) {
            decisionTime = new Date(request.decisionAt.seconds * 1000); // ពី Serialized object
        } else if (request.decisionAt) {
            try { decisionTime = new Date(request.decisionAt); } catch(e){} // ពី String
        }

        if (decisionTime && !isNaN(decisionTime.getTime())) {
            const minutesSinceDecision = (now.getTime() - decisionTime.getTime()) / (1000 * 60);
            
            if (minutesSinceDecision < 55) {
                // នៅក្រោម 55 នាទី: អនុញ្ញាតឲ្យលុប
                const minutesLeft = Math.floor(55 - minutesSinceDecision);
                deleteButton = `
                    <button data-id="${request.id}" data-type="${request.type}" data-action="delete" 
                            class="action-btn text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500 transition-colors duration-150 p-1 rounded-full"
                            title="អាចលុបបាន (នៅសល់ ${minutesLeft} នាទី)">
                        <i class="fas fa-trash-alt fa-fw"></i>
                    </button>
                `;
            } else {
                // លើស 55 នាទី: បង្ហាញ icon lock
                deleteButton = `
                    <span class="text-gray-400 dark:text-gray-500 p-1" title="ផុតកំណត់ (55 នាទី) មិនអាចលុបបានទៀតទេ">
                        <i class="fas fa-lock fa-fw"></i>
                    </span>
                `;
            }
        } else {
            // រកមិនឃើញ decisionAt ឬទិន្នន័យមិនត្រឹមត្រូវ
            deleteButton = `
                <span class="text-gray-400 dark:text-gray-500 p-1" title="មិនមានពេលវេលាសម្រេចចិត្ត (decisionAt)">
                    <i class="fas fa-question-circle fa-fw"></i>
                </span>
             `;
        }
    }
    return deleteButton;
}


// --- [*** កែសម្រួលនៅទីនេះ ***] ---
// --- Render Single Request Card (Full Detail) ---
function renderRequestCard(request) {
    if (!request || !request.id) return '';
    
    // --- Logic សម្រាប់ប៊ូតុង អនុម័ត/បដិសេធ ---
    let actionButtons = '';
    if (request.status === 'pending') {
        actionButtons = `
            <div class="flex flex-col sm:flex-row gap-2 mt-4 pt-3 border-t border-primary">
                <button data-id="${request.id}" data-type="${request.type}" data-action="approve" class="flex-1 action-btn bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition duration-150 ease-in-out flex items-center justify-center gap-1.5">
                    <i class="fas fa-check fa-fw"></i> អនុម័ត
                </button>
                <button data-id="${request.id}" data-type="${request.type}" data-action="reject" class="flex-1 action-btn bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition duration-150 ease-in-out flex items-center justify-center gap-1.5">
                    <i class="fas fa-times fa-fw"></i> បដិសេធ
                </button>
            </div>`;
    } else if (request.status === 'editing') {
        actionButtons = `
            <div class="mt-4 pt-3 border-t border-primary text-center">
                <p class="text-xs text-yellow-600 dark:text-yellow-400 italic p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                    <i class="fas fa-exclamation-triangle fa-fw"></i> បុគ្គលិកកំពុងកែសម្រួល។ មិនអាចអនុម័ត/បដិសេធបានទេ។
                </p>
            </div>`;
    }

    // --- [កែសម្រួល] ហៅ Function ថ្មី (getDeleteButtonHtml) ---
    const deleteButton = getDeleteButtonHtml(request);
    
    // --- Render កាត ---
    const detailHtml = getRequestDetailHtml(request, deleteButton); 

    return `
        <div class="card-bg border border-primary rounded-lg shadow-md p-4 mb-4 break-inside-avoid hover:shadow-lg transition-shadow duration-200">
            ${detailHtml}
            ${actionButtons}
        </div>`;
}
// --- [*** ចប់ការកែសម្រួល ***] ---

 
// --- Helper to generate detail HTML for Full Card and Modal ---
function getRequestDetailHtml(request, extraHeaderHtml = '') {
    if (!request || !request.id) return '';

    const typeText = request.type === 'leave' ? 'ច្បាប់ឈប់សម្រាក' : 'ច្បាប់ចេញក្រៅ';
    const typeColor = request.type === 'leave' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
    const typeDarkColor = request.type === 'leave' ? 'dark:bg-blue-900 dark:text-blue-200' : 'dark:bg-green-900 dark:text-green-200';
    
    const dateString = (request.startDate === request.endDate) ? request.startDate : `${request.startDate} ដល់ ${request.endDate}`;
    const requestedAtFormatted = formatFirestoreTimestamp(request.requestedAt, 'HH:mm dd/MM/yyyy');

    let statusBadge = '';
    let statusText = request.status || 'N/A';
    let statusBgColor = 'bg-gray-100';
    let statusTextColor = 'text-gray-800';
    let statusDarkColor = 'dark:bg-gray-700 dark:text-gray-200';

    switch (request.status) {
        case 'pending': statusText = 'រង់ចាំ'; statusBgColor = 'bg-yellow-100'; statusTextColor = 'text-yellow-800'; statusDarkColor = 'dark:bg-yellow-900 dark:text-yellow-200'; break;
        case 'editing': statusText = 'កំពុងកែ'; statusBgColor = 'bg-yellow-100'; statusTextColor = 'text-yellow-800'; statusDarkColor = 'dark:bg-yellow-900 dark:text-yellow-200'; break;
        case 'approved': statusText = 'បានយល់ព្រម'; statusBgColor = 'bg-green-100'; statusTextColor = 'text-green-800'; statusDarkColor = 'dark:bg-green-900 dark:text-green-200'; break;
        case 'rejected': statusText = 'បានបដិសេធ'; statusBgColor = 'bg-red-100'; statusTextColor = 'text-red-800'; statusDarkColor = 'dark:bg-red-900 dark:text-red-200'; break;
    }
    statusBadge = `<span class="text-xs font-bold px-2.5 py-1 rounded-full ${statusBgColor} ${statusTextColor} ${statusDarkColor}">${statusText}</span>`;

    let decisionInfo = '';
    if (request.status === 'approved' || request.status === 'rejected') {
        decisionInfo = `<div class="text-xs text-secondary mt-2"><i class="fas fa-user-shield fa-fw mr-1"></i> ${request.decisionBy || 'N/A'} | <i class="far fa-clock fa-fw mr-1"></i> ${formatFirestoreTimestamp(request.decisionAt)}</div>`;
    }

     let returnInfo = '';
       if (request.type === 'out' && request.returnStatus === 'បានចូលមកវិញ') {
           returnInfo = `<div class="text-xs text-green-700 dark:text-green-400 font-medium mt-1.5"><i class="fas fa-door-open fa-fw mr-1"></i> បានចូលវិញ: ${request.returnedAt || ''}</div>`;
       }

    return `
        <div class="flex justify-between items-center mb-3 pb-2 border-b border-primary">
            <span class="text-xs font-semibold px-2 py-0.5 rounded ${typeColor} ${typeDarkColor}">${typeText}</span>
            <div class="flex items-center gap-2">
                ${statusBadge}
                ${extraHeaderHtml}
            </div>
        </div>
        <div class="mb-3 flex items-center gap-3">
            <div class="flex-shrink-0">
                ${ request.photo
                    ? `<img src="${request.photo}" alt="${request.name || 'Photo'}" class="w-12 h-12 rounded-full object-cover border-2 border-primary shadow-sm" onerror="this.onerror=null; this.src='https://placehold.co/48x48/e2e8f0/64748b?text=?';">`
                    : `<div class="w-12 h-12 rounded-full bg-secondary text-secondary flex items-center justify-center"><i class="fas fa-user fa-lg"></i></div>`
                }
            </div>
            <div>
                <p class="font-semibold text-lg text-primary">${request.name || 'N/A'} <span class="text-sm font-normal text-secondary">(${request.userId || 'N/A'})</span></p>
                <p class="text-sm text-secondary">${request.department || 'N/A'}</p>
            </div>
        </div>
        <div class="text-sm space-y-1.5 mb-3">
            <div class="flex"><strong class="font-medium text-secondary w-20 inline-block shrink-0"><i class="far fa-calendar-alt fa-fw mr-1.5 text-blue-500"></i>កាលបរិច្ឆេទ:</strong> <span class="text-primary">${dateString}</span></div>
            <div class="flex"><strong class="font-medium text-secondary w-20 inline-block shrink-0"><i class="far fa-clock fa-fw mr-1.5 text-blue-500"></i>រយៈពេល:</strong> <span class="text-primary">${request.duration || 'N/A'}</span></div>
            <div class="flex"><strong class="font-medium text-secondary w-20 inline-block shrink-0 align-top"><i class="fas fa-info-circle fa-fw mr-1.5 text-blue-500"></i>មូលហេតុ:</strong> <span class="whitespace-pre-line inline-block text-primary">${request.reason || 'N/A'}</span></div>
             <div class="flex"><strong class="font-medium text-secondary w-20 inline-block shrink-0"><i class="far fa-paper-plane fa-fw mr-1.5 text-blue-500"></i>សុំនៅ:</strong> <span class="text-primary text-xs">${requestedAtFormatted}</span></div>
        </div>
        ${decisionInfo}
        ${returnInfo}
    `;
}

// --- [*** កែសម្រួលនៅទីនេះ ***] ---
// --- Show/Hide Request Detail Modal ---
function showRequestDetailModal(request) {
    if (!requestDetailModal || !detailModalContent) return;
    
    // [កែសម្រួល] ហៅ Function ថ្មី (getDeleteButtonHtml) ដើម្បីយកប៊ូតុងលុប
    const deleteButtonHtml = getDeleteButtonHtml(request);

    // [កែសម្រួល] បញ្ចូល deleteButtonHtml ទៅក្នុង Modal
    detailModalContent.innerHTML = getRequestDetailHtml(request, deleteButtonHtml);
    requestDetailModal.classList.remove('hidden');
}
function hideRequestDetailModal() {
    if (requestDetailModal) requestDetailModal.classList.add('hidden');
    if (detailModalContent) detailModalContent.innerHTML = '';
}


// --- Prompt for Admin Action (Handles Approve/Reject/Delete) ---
function promptForAdminAction(button) {
    if (!button) return;
    const { id, type, action } = button.dataset;

    if (!id || !type || !action || !confirmationModal) return;

    confirmYesBtn.dataset.id = id;
    confirmYesBtn.dataset.type = type;
    confirmYesBtn.dataset.action = action;

    if (action === 'approve') {
        confirmationTitle.textContent = "បញ្ជាក់ការអនុម័ត";
        confirmationMessage.textContent = `តើអ្នកប្រាកដជាចង់ "អនុម័ត" សំណើ (ID: ${id}) នេះមែនទេ?`;
        confirmYesBtn.className = "bg-green-600 text-white py-2 px-6 rounded-lg font-semibold shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2";
        confirmYesBtn.textContent = "បាទ/ចាស, អនុម័ត";
    } else if (action === 'reject') {
        confirmationTitle.textContent = "បញ្ជាក់ការបដិសេធ";
        confirmationMessage.textContent = `តើអ្នកប្រាកដជាចង់ "បដិសេធ" សំណើ (ID: ${id}) នេះមែនទេ?`;
        confirmYesBtn.className = "bg-red-600 text-white py-2 px-6 rounded-lg font-semibold shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2";
        confirmYesBtn.textContent = "បាទ/ចាស, បដិសេធ";
    } else if (action === 'delete') {
        confirmationTitle.textContent = "បញ្ជាក់ការលុប";
        confirmationMessage.textContent = `តើអ្នកប្រាកដជាចង់ "លុប" សំណើ (ID: ${id}) នេះមែនទេ?\n\nចំណាំ៖ ទិន្នន័យនេះនឹងបាត់បង់ជាអចិន្ត្រៃយ៍។`;
        confirmYesBtn.className = "bg-red-600 text-white py-2 px-6 rounded-lg font-semibold shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2";
        confirmYesBtn.textContent = "បាទ/ចាស, លុប";
    }
    
    confirmationModal.classList.remove('hidden');
}


// --- Execute Admin Action (UI part) ---
async function executeAdminAction(requestId, requestType, action) {
    console.log(`Executing Action: ${action}, Type: ${requestType}, ID: ${requestId}`);

    // [កែសម្រួល] ស្វែងរកប៊ូតុង ទាំងនៅក្នុង List ឬ នៅក្នុង Modal
    const originalButton = document.querySelector(`.action-btn[data-id="${requestId}"][data-action="${action}"]`);
    let originalButtonHtml = '';
    
    if (originalButton) {
        originalButtonHtml = originalButton.innerHTML; 
        originalButton.disabled = true;
        originalButton.innerHTML = (action === 'delete') 
            ? `<i class="fas fa-spinner fa-spin"></i>`
            : `<i class="fas fa-spinner fa-spin mr-1"></i> កំពុងដំណើរការ...`;
    }

    try {
        await performAdminAction(requestId, requestType, action, ADMIN_NAME);
        
        console.log(`Request ${requestId} successfully ${action}d.`);
        const successMessage = (action === 'approve') ? 'អនុម័ត' : (action === 'reject') ? 'បដិសេធ' : 'លុប';
        showCustomAlert("ជោគជ័យ!", `សំណើ (${requestId}) ត្រូវបាន ${successMessage} ដោយជោគជ័យ។`, "success");
        
    } catch (error) {
        console.error(`Error ${action}ing request ${requestId}:`, error);
        showCustomAlert("Error", `មានបញ្ហា ${action} សំណើ: ${error.message}`);
        
        if (originalButton) {
            originalButton.disabled = false;
            originalButton.innerHTML = originalButtonHtml;
        }
    }
}

// --- Custom Alert Modal Logic ---
function showCustomAlert(title, message, type = 'warning') { 
    if (!customAlertModal) return; 
    customAlertTitle.textContent = title; 
    customAlertMessage.textContent = message; 
    customAlertIconSuccess.classList.toggle('hidden', type !== 'success'); 
    customAlertIconWarning.classList.toggle('hidden', type === 'success'); 
    customAlertModal.classList.remove('hidden'); 
}
function hideCustomAlert() { 
    if (customAlertModal) customAlertModal.classList.add('hidden'); 
}
