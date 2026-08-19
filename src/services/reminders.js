// src/services/reminders.js
//
// Firestore operations for reminders - a collection shared across the whole
// pharmacy team (not per-user).
import { db } from "../firebase";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";

const REMINDERS_COLLECTION = "reminders";

/**
 * type: "general" | "shipment" | "custom"
 * dueDate: JS Date
 */
export async function addReminder({ title, note = "", dueDate, type = "general" }) {
  return addDoc(collection(db, REMINDERS_COLLECTION), {
    title,
    note,
    type,
    dueDate: Timestamp.fromDate(dueDate),
    done: false,
    createdAt: serverTimestamp(),
  });
}

export async function updateReminderDueDate(id, newDate) {
  return updateDoc(doc(db, REMINDERS_COLLECTION, id), {
    dueDate: Timestamp.fromDate(newDate),
  });
}

export async function markReminderDone(id) {
  return updateDoc(doc(db, REMINDERS_COLLECTION, id), { done: true });
}

export async function deleteReminder(id) {
  return deleteDoc(doc(db, REMINDERS_COLLECTION, id));
}

// Quick snooze presets
export function snoozeOptions() {
  return [
    { label: "In 30 minutes", minutes: 30 },
    { label: "In 1 hour", minutes: 60 },
    { label: "Tomorrow (same time)", minutes: 60 * 24 },
  ];
}

export async function snoozeReminder(id, minutes) {
  const newDate = new Date(Date.now() + minutes * 60 * 1000);
  return updateReminderDueDate(id, newDate);
}

/**
 * Real-time subscription to all pending (not done) reminders, ordered by
 * the nearest due date. The callback receives an array of reminders, each
 * with its Firestore id and dueDate converted to a JS Date.
 */
export function subscribeReminders(callback) {
  const q = query(collection(db, REMINDERS_COLLECTION), orderBy("dueDate", "asc"));

  return onSnapshot(q, (snapshot) => {
    const reminders = snapshot.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : null,
        };
      })
      .filter((r) => !r.done);

    callback(reminders);
  });
}