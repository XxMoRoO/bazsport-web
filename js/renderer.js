/**
 * js/renderer.js (معدل للويب)
 * هذا هو الملف الرئيسي للواجهة الأمامية.
 * يقوم بتهيئة التطبيق، تحميل البيانات الأولية، إعداد مستمعي التحديثات، وعرض الواجهة.
 */

import { state, setState } from './state.js';
import { setupEventListeners, createNewReceipt } from './events.js';
import { render } from './ui.js';
import { showLoader, hideLoader, showNotification } from './utils.js';
import * as api from './api.js'; // استيراد دوال API الجديدة
import { db, auth } from './firebase-init.js'; // استيراد خدمات Firebase
import { onSnapshot, collection, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- دالة بدء تشغيل التطبيق ---
async function initializeApp() {
    showLoader();
    try {
        // التحقق من حالة تسجيل الدخول للمستخدم
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // المستخدم مسجل دخوله
                const userData = JSON.parse(sessionStorage.getItem('loggedInUser'));
                if (userData) {
                    state.currentUser = userData;
                } else {
                    // إذا لم تكن البيانات موجودة، حاول جلبها أو تسجيل الخروج
                    console.warn("User data not found in session storage. Logging out.");
                    await signOut(auth);
                    window.location.href = 'login.html';
                    return;
                }

                // تحميل البيانات الأولية بعد التأكد من تسجيل الدخول
                const initialData = await api.loadData();
                if (initialData && !initialData.error) {
                    setState(initialData);

                    // إعداد فلاتر المستخدمين
                    const userFilter = document.getElementById('user-filter');
                    if (userFilter) {
                        userFilter.innerHTML = '<option value="all" data-lang-key="allUsers">All Users</option>';
                        state.users.forEach(u => {
                            const option = document.createElement('option');
                            option.value = u.username;
                            option.textContent = u.username;
                            userFilter.appendChild(option);
                        });
                    }

                    // تحميل سلة التسوق من sessionStorage
                    api.cartSession.load();
                    if (state.receipts && state.receipts.length === 0) {
                        createNewReceipt(false);
                    }

                    // إعداد مستمعي الأحداث والتحديثات
                    setupEventListeners();
                    setupRealtimeListeners(); // إعداد مستمعي التحديثات من Firestore
                    render();

                } else {
                    console.error("Initialization Error:", initialData ? initialData.error : "No data returned");
                    showNotification("Fatal Error: Could not load database.", "error");
                }

            } else {
                // المستخدم غير مسجل دخوله، قم بتحويله لصفحة تسجيل الدخول
                // باستثناء إذا كان بالفعل في صفحة تسجيل الدخول
                if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                    window.location.href = 'login.html';
                }
            }
            hideLoader();
        });

    } catch (error) {
        console.error("Initialization failed:", error);
        showNotification("Application failed to start correctly.", "error");
        hideLoader();
    }
}

// --- إعداد المستمع للتحديثات اللحظية من Firestore ---
function setupRealtimeListeners() {
    const collectionsToWatch = ['products', 'sales', 'customers', 'bookings', 'defects', 'suppliers', 'shipments', 'shifts', 'users', 'daily_expenses'];

    collectionsToWatch.forEach(collName => {
        const collRef = collection(db, collName);
        onSnapshot(collRef, (snapshot) => {
            console.log(`Renderer received update for: '${collName}'`);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.hasOwnProperty(collName)) {
                state[collName] = data;
                render(); // إعادة رسم الواجهة عند كل تحديث
            }
        }, (error) => {
            console.error(`Error listening to ${collName}:`, error);
        });
    });

    const configRef = doc(db, "app_config", "main");
    onSnapshot(configRef, (doc) => {
        console.log(`Renderer received update for: 'app_config'`);
        if (doc.exists()) {
            const configData = doc.data();
            state.categories = ['All', ...(configData.categories || [])];
            state.expenses = configData.expenses || { daily: [], rent: { amount: 0, paidStatus: {} } };
            state.salaries = configData.salaries || {};
            state.salariesPaidStatus = configData.salariesPaidStatus || {};
            state.lastShiftReportTime = configData.lastShiftReportTime;
            render();
        }
    }, (error) => {
        console.error("Error listening to app_config:", error);
    });
}


// --- بدء تشغيل التطبيق عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', initializeApp);
