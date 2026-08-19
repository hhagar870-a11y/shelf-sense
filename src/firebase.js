import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);