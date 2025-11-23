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
// ### FILE: firebase-service.js (កែសម្រួល Filter កាលបរិច្ឆេទ) ###

// ... (រក្សាកូដ import និង initializeFirebase ដដែល) ...

/**
 * Detaches the old listener and sets up a new real-time listener for requests.
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

    // [NEW] កំណត់ថ្ងៃចាប់ផ្តើម (Cutoff Date): 23 វិច្ឆិកា 2025, ម៉ោង 00:00:00
    // ខែក្នុង JavaScript រាប់ពី 0 (Jan=0, ..., Nov=10)
    const START_FROM_DATE = new Date(2025, 10, 23, 0, 0, 0); 

    // This function will be called by both listeners on every update
    const processResults = () => {
        let filteredRequests = [...allRequests];

        // [UPDATED] 1. Global Filter: (No IT Support + Date >= 23/11/2025)
        filteredRequests = filteredRequests.filter(req => {
            // A. ត្រងមិនយកផ្នែក "IT Support"
            const dept = req.department ? req.department.toLowerCase().trim() : '';
            if (dept === 'it support') return false;

            // B. [NEW] ត្រងយកតែសំណើចាប់ពីថ្ងៃទី 23/11/2025 ឡើងទៅ
            // បំប្លែង requestedAt ទៅជា Date Object
            let requestDate;
            if (req.requestedAt?.toDate) {
                requestDate = req.requestedAt.toDate();
            } else if (req.requestedAt?.seconds) {
                requestDate = new Date(req.requestedAt.seconds * 1000);
            } else if (typeof req.requestedAt === 'string') {
                requestDate = new Date(req.requestedAt);
            } else {
                // បើគ្មានថ្ងៃខែជាក់លាក់ អាចសម្រេចចិត្តថាបង្ហាញ ឬអត់ (នៅទីនេះខ្ញុំដកចេញ)
                return false; 
            }

            // ប្រៀបធៀប: ពេលវេលាស្នើសុំ ត្រូវធំជាង ឬស្មើ ថ្ងៃទី 23
            return requestDate >= START_FROM_DATE;
        });

        // 2. Month filter (តាម Settings)
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
                
                // បន្ថែមផ្នែកចូលក្នុង Filter (ដក IT Support ចេញពី List ផងដែរ)
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
