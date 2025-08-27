// استيراد الدوال اللازمة من SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// إعدادات Firebase الخاصة بمشروعك (من ملف main.js)
const firebaseConfig = {
    apiKey: "AIzaSyDsGsS6CbEqUBqmW1-VIVm81QnP941UuFo",
    authDomain: "baz-sport-store.firebaseapp.com",
    projectId: "baz-sport-store",
    storageBucket: "baz-sport-store.appspot.com",
    messagingSenderId: "279577862201",
    appId: "1:279577862201:web:612231c9d1706975666de8",
    measurementId: "G-BRTSMVXB32"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// تصدير الخدمات لاستخدامها في الملفات الأخرى
export { db, storage, auth };