// ### FILE: firebase-service.js ###

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore, doc, updateDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, setLogLevel,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Enable Firestore debug logging
setLogLevel('debug');

let db, auth;
let leaveRequestsCollectionPath;
let outRequestsCollectionPath;
let currentUnsubscribe = null;

/**
 * Initializes Firebase App and sets up collection paths.
 */
export function initializeFirebase(config, canvasAppId) {
    try {
        if (!config.projectId) throw new Error("Firebase config is missing or invalid.");
        const app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);

        leaveRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/leave_requests`;
        outRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/out_requests`;
        console.log("Admin App Using Firestore Leave Path:", leaveRequestsCollectionPath);
        console.log("Admin App Using Firestore Out Path:", outRequestsCollectionPath);
        return { success: true };
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
        return { success: false, error: e };
    }
}

/**
 * Handles Firebase authentication state.
 * Calls onUser() when signed in, or onNoUser() if sign-in fails.
 */
export function handleAuth(onUser, onNoUser) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Admin App: Signed in. UID:", user.uid);
            onUser(user);
        } else {
            console.log("Admin App: No user. Attempting anonymous sign-in...");
            signInAnonymously(auth).catch(anonError => {
                console.error("Admin App: Anonymous Sign-In Error:", anonError);
                onNoUser(anonError);
            });
        }
    });
}

/**
 * Performs the database update (approve, reject) or deletion.
 * Returns a promise.
 */
export async function performAdminAction(id, type, action, adminName) {
    if (!db) throw new Error("Firestore is not initialized.");
    
    const collectionPath = type === 'leave' ? leaveRequestsCollectionPath : outRequestsCollectionPath;
    const docRef = doc(db, collectionPath, id);

    if (action === 'approve' || action === 'reject') {
        const updateData = {
            status: action === 'approve' ? 'approved' : 'rejected',
            decisionAt: serverTimestamp(),
            decisionBy: adminName
        };
        return updateDoc(docRef, updateData);
    } else if (action === 'delete') {
        return deleteDoc(docRef);
    }
    
    throw new Error("Invalid action specified.");
}

// ### FILE: firebase-service.js (ផ្នែក listenToRequests ត្រូវបានកែប្រែ) ###

// ... (កូដផ្នែកខាងលើរក្សាទុកដដែល) ...

/**
 * Detaches the old listener and sets up a new real-time listener for requests.
 * Calls onDataUpdate(requests, allDepartments) on success.
 * Calls onError(error) on failure.
 */
export function listenToRequests(statusFilter, settings, onDataUpdate, onError) {
    if (currentUnsubscribe) {
        console.log("Unsubscribing previous listener.");
        currentUnsubscribe();
    }
    if (!db) {
        onError(new Error("Firestore is not initialized."));
        return;
    }

    const collectionsToQuery = [leaveRequestsCollectionPath, outRequestsCollectionPath];
    let allRequests = [];
    let allDepartments = new Set();
    let listeners = [];
    let initialLoadsPending = collectionsToQuery.length;

    // This function will be called by both listeners on every update
    const processResults = () => {
        let filteredRequests = [...allRequests];

        // [NEW] 1. Global Filter: Exclude "IT support" immediately
        // យើងត្រងយកតែសំណើណាដែល *មិនមែន* "IT support"
        filteredRequests = filteredRequests.filter(req => {
            const dept = req.department ? req.department.toLowerCase().trim() : '';
            return dept !== 'it support'; 
        });

        // 2. Month filter
        if (settings.filterCurrentMonth) {
            const now = new Date();
            const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            
            filteredRequests = filteredRequests.filter(doc => {
                const startsInMonth = doc.startDate && doc.startDate.endsWith(currentMonthYear);
                const endsInMonth = doc.endDate && doc.endDate.endsWith(currentMonthYear);
                return startsInMonth || endsInMonth;
            });
        }
        
        // 3. Approved Type filter
        if (statusFilter === 'approved' && settings.approvedFilterType !== 'all') {
            filteredRequests = filteredRequests.filter(doc => doc.type === settings.approvedFilterType);
        }
        
        // 4. Department filter
        if (settings.filterByDepartment && settings.selectedDepartment !== 'all') {
            filteredRequests = filteredRequests.filter(doc => doc.department === settings.selectedDepartment);
        }
        
        // Pass the final data back to app.js
        onDataUpdate(filteredRequests, allDepartments, initialLoadsPending);
        if (initialLoadsPending > 0) initialLoadsPending = 0; 
    };

    collectionsToQuery.forEach(collectionPath => {
        let q;
        const baseCollectionRef = collection(db, collectionPath);
        if (statusFilter === 'all') q = query(baseCollectionRef);
        else if (statusFilter === 'pending') q = query(baseCollectionRef, where('status', 'in', ['pending', 'editing']));
        else q = query(baseCollectionRef, where('status', '==', statusFilter));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const type = collectionPath.includes('leave_requests') ? 'leave' : 'out';
            
            let currentDocs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // [NEW] បន្ថែមតែផ្នែកដែលមិនមែន "IT support" ចូលក្នុង Filter Dropdown
                if (data.department) {
                    const deptName = data.department.trim();
                    if (deptName.toLowerCase() !== 'it support') {
                        allDepartments.add(deptName);
                    }
                }

                currentDocs.push({ ...data, id: doc.id, type: type });
            });

            // Update the combined list
            allRequests = allRequests.filter(req => req.type !== type).concat(currentDocs);
            processResults(); // Process and render
            
        }, (error) => {
            console.error(`Error listening to ${collectionPath}:`, error);
            onError(error); 
        });
        listeners.push(unsubscribe);
    });

    // Set the global unsubscriber function
    currentUnsubscribe = () => { listeners.forEach(unsub => unsub()); };
}
