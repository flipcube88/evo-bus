import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";
import { Bookmark } from "../types";

// Sign in with Google Auth popup
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error("Firebase Login Error:", err);
    throw err;
  }
}

// Log out the current user
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Firebase Logout Error:", err);
    throw err;
  }
}

// Fetch user's sync bookmarks list from Firestore
export async function fetchCloudBookmarks(userId: string): Promise<Bookmark[] | null> {
  const path = `users/${userId}`;
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      return Array.isArray(data.bookmarks) ? data.bookmarks : [];
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

// Upload/Sync standard bookmarks list to Firestore
export async function saveCloudBookmarks(userId: string, bookmarks: Bookmark[]): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userDocRef = doc(db, "users", userId);
    
    // Safety cap bookmarks list size to 100 to abide by standard firestore.rules size cap
    const safeList = bookmarks.slice(0, 100);

    await setDoc(userDocRef, {
      userId,
      bookmarks: safeList,
      updatedAt: new Date().toISOString() // using compliant ISO-8601 strings
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Merge logic to combine device and cloud bookmarks nicely
 * Prioritizes newest bookmarks and removes list duplication by ID
 */
export function mergeBookmarks(local: Bookmark[], cloud: Bookmark[]): Bookmark[] {
  const seen = new Set<string>();
  const merged: Bookmark[] = [];
  
  // Cloud favorites are loaded as base
  for (const b of cloud) {
    if (!seen.has(b.id)) {
      seen.add(b.id);
      merged.push(b);
    }
  }

  // Then local favorites are merged
  for (const b of local) {
    if (!seen.has(b.id)) {
      seen.add(b.id);
      merged.push(b);
    }
  }

  return merged;
}
