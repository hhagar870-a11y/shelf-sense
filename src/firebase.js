import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// بيانات الإعدادات الخاصة بمشروعك من لوحة تحكم فايربيس
const firebaseConfig = {
  apiKey: "AIzaSyAdNRLZvbEjG9iFcaR_ItPp5LCvXFGqCxg",
  authDomain: "shelfsense-10c69.firebaseapp.com",
  projectId: "shelfsense-10c69",
  storageBucket: "shelfsense-10c69.appspot.com",
  messagingSenderId: "570961487535",
  appId: "1:570961487535:web:cd62087d29c25f9a57d65a"
};

// تهيئة الفايربيس وقاعدة البيانات
const app = initializeApp(firebaseConfig);

// تفعيل التخزين المحلي (offline persistence): لو النت ضعيف أو انقطع لحظيًا،
// أي قراءة/كتابة تنحفظ محليًا بالجهاز فورًا وتترسل تلقائيًا بمجرد ما يرجع
// النت — بدل ما تفشل العملية وتحتاج المستخدم يعيد المحاولة يدويًا.
// persistentMultipleTabManager يخلي هذا يشتغل صح حتى لو فتح المستخدم أكثر
// من تبويب لنفس الموقع بنفس المتصفح بنفس الوقت
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// مصادقة مجهولة (Anonymous Auth): تسجيل دخول تلقائي وصامت بالخلفية، بدون
// أي شاشة أو حساب مستخدم إضافي — بس يضمن إن أي طلب يوصل فايرستور معه
// تصريح صادر فعليًا من تطبيقك (بوت أو زائر برا الموقع ما يقدر يحصل عليه).
// هذا يسمح بربط قاعدة أمان فايرستور بشرط "request.auth != null" بدل قاعدة
// التاريخ المؤقت الافتراضية اللي كانت بتقفل كل شي يوم ١٦ سبتمبر
export const auth = getAuth(app);
export const authReady = signInAnonymously(auth);