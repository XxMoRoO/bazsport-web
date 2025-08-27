/**
 * js/login.js (معدل بالكامل للويب)
 * هذا الملف يحتوي على منطق تسجيل الدخول، إنشاء حساب جديد، وتغيير كلمة سر الأدمن
 * باستخدام Firebase Authentication و Firestore مباشرة.
 */

// استيراد دوال وخدمات Firebase
import { auth, db } from './firebase-init.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, writeBatch, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Preloader Logic ---
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    const mainContent = document.getElementById('main-content');
    preloader.classList.add('hidden');
    setTimeout(() => {
        mainContent.classList.remove('hidden');
    }, 100);
});

// --- DOM Element Selection ---
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const setAdminPasswordForm = document.getElementById('set-admin-password-form');
const loginError = document.getElementById('login-error-message');
const signupError = document.getElementById('signup-error-message');
const setAdminPasswordError = document.getElementById('set-admin-password-error');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const setAdminPasswordView = document.getElementById('set-admin-password-view');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const showSetAdminPasswordBtn = document.getElementById('show-set-admin-password');
const backToLoginBtn = document.getElementById('back-to-login');

// --- View Switching Logic ---
function switchToView(viewToShow) {
    [loginView, signupView, setAdminPasswordView].forEach(view => view.classList.add('hidden'));
    [loginError, signupError, setAdminPasswordError].forEach(error => error.classList.add('hidden'));
    viewToShow.classList.remove('hidden');
}
showSignupBtn.addEventListener('click', (e) => { e.preventDefault(); switchToView(signupView); });
showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); switchToView(loginView); });
showSetAdminPasswordBtn.addEventListener('click', (e) => { e.preventDefault(); switchToView(setAdminPasswordView); });
backToLoginBtn.addEventListener('click', (e) => { e.preventDefault(); switchToView(loginView); });

// --- Form Submission Logic ---

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        // الخطوة 1: البحث عن المستخدم في Firestore للتأكد من وجوده
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username_lowercase", "==", username.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("auth/user-not-found");
        }

        const userDoc = querySnapshot.docs[0].data();

        // الخطوة 2: استخدام Firebase Auth لتسجيل الدخول بالإيميل والباسورد
        // ملاحظة: نفترض أن الإيميل هو username@bazsport.com
        const email = `${userDoc.username}@bazsport.com`;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // حفظ بيانات المستخدم في sessionStorage والانتقال للصفحة الرئيسية
        sessionStorage.setItem('loggedInUser', JSON.stringify({
            username: userDoc.username,
            isAdmin: userDoc.username === 'BAZ'
        }));
        window.location.href = 'index.html';

    } catch (error) {
        console.error("Login Error:", error);
        loginError.textContent = 'Incorrect username or password.';
        loginError.classList.remove('hidden');
    }
});

// Handle sign-up form submission
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.classList.add('hidden');
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const adminPassword = document.getElementById('signup-admin-password').value;

    if (!username || !password || !adminPassword) {
        signupError.textContent = 'All fields are required.';
        signupError.classList.remove('hidden');
        return;
    }

    try {
        // التحقق من كلمة سر الأدمن
        const configRef = doc(db, "app_config", "main");
        const configDoc = await getDoc(configRef);
        if (!configDoc.exists() || configDoc.data().adminPassword !== adminPassword) {
            throw new Error("Incorrect admin password.");
        }

        // التحقق من عدم وجود اسم المستخدم
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username_lowercase", "==", username.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            throw new Error("Username already exists.");
        }

        // إنشاء المستخدم في Firebase Auth
        const email = `${username}@bazsport.com`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // إضافة المستخدم إلى Firestore
        const newUserDoc = {
            username: username,
            username_lowercase: username.toLowerCase(),
            employeeId: `EMP${Date.now()}`, // توليد ID افتراضي
            phone: "",
            uid: user.uid // ربط المستخدم بـ UID الخاص به
        };
        await setDoc(doc(usersRef, user.uid), newUserDoc);

        alert('Account created successfully! Please log in.');
        signupForm.reset();
        switchToView(loginView);

    } catch (error) {
        console.error("Signup Error:", error);
        signupError.textContent = error.message;
        signupError.classList.remove('hidden');
    }
});

// Handle setting the admin password
setAdminPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAdminPasswordError.classList.add('hidden');

    const oldPassword = document.getElementById('old-admin-password').value;
    const newPassword = document.getElementById('new-admin-password').value;
    const confirmPassword = document.getElementById('confirm-new-admin-password').value;

    if (newPassword !== confirmPassword) {
        setAdminPasswordError.textContent = "New passwords do not match.";
        setAdminPasswordError.classList.remove('hidden');
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const configRef = doc(db, "app_config", "main");
            const configDoc = await transaction.get(configRef);

            if (!configDoc.exists() || configDoc.data().adminPassword !== oldPassword) {
                throw new Error('Incorrect old admin password.');
            }

            // تسجيل الدخول كمستخدم BAZ لتغيير كلمة السر في Auth
            const bazEmail = 'BAZ@bazsport.com';
            await signInWithEmailAndPassword(auth, bazEmail, oldPassword);
            const bazUser = auth.currentUser;
            if (!bazUser) {
                throw new Error("Could not authenticate as BAZ user.");
            }
            await updatePassword(bazUser, newPassword);

            // تحديث كلمة السر في Firestore
            transaction.update(configRef, { adminPassword: newPassword });

            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", "BAZ"));
            const userSnapshot = await getDocs(q);
            if (!userSnapshot.empty) {
                const userId = userSnapshot.docs[0].id;
                transaction.update(doc(db, "users", userId), { password: newPassword });
            }
        });

        alert('Admin password changed successfully!');
        setAdminPasswordForm.reset();
        switchToView(loginView);

    } catch (error) {
        console.error("Set Admin Password Error:", error);
        setAdminPasswordError.textContent = error.message;
        setAdminPasswordError.classList.remove('hidden');
    }
});


// --- Utility: Password visibility toggle ---
document.querySelectorAll('.password-toggle-icon').forEach(icon => {
    icon.addEventListener('click', function () {
        const passwordInput = this.closest('.password-container').querySelector('input');
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    });
});
