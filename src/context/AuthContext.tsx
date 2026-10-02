import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/errorHandling.ts';
import { UserProfile } from '../types/index.ts';

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  hasAccess: boolean;
  isAdmin: boolean;
  isTrialActive: boolean;
  isSubscribed: boolean;
  daysRemainingInTrial: number;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, pharmacyName: string) => Promise<void>;
  loginWithGoogle: (customPharmacyName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePharmacyName: (newName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  activateUserSubscription: (targetUserId: string, untilDateISO: string) => Promise<void>;
  deactivateUserAccount: (targetUserId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (
    uid: string,
    email: string,
    displayName?: string | null,
    photoURL?: string | null,
    customPharmacyName?: string
  ): Promise<UserProfile | null> => {
    const userDocRef = doc(db, 'users', uid);
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        
        // Preserve existing user profile and role
        const updates: Partial<UserProfile> = {};
        if (photoURL && !data.photoURL) updates.photoURL = photoURL;
        if (displayName && !data.displayName) updates.displayName = displayName;
        if (customPharmacyName && customPharmacyName.trim() && data.pharmacyName !== customPharmacyName.trim()) {
          updates.pharmacyName = customPharmacyName.trim();
        }

        if (Object.keys(updates).length > 0) {
          try {
            await updateDoc(userDocRef, updates);
            Object.assign(data, updates);
          } catch (e) {
            console.warn('Non-blocking user profile enhancement error:', e);
          }
        }

        setProfile(data);
        return data;
      } else {
        // Create initial profile with 7-day trial
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        // Default role is user; admin is granted manually in Firebase or for the system owner
        const isAdminUser = email === 'mirolab12@gmail.com';

        const fallbackPharmacy = displayName?.trim()
          ? 'صيدلية د. ' + displayName.trim()
          : 'صيدلية ' + (email.split('@')[0] || 'الحديثة');

        const newProfile: UserProfile = {
          id: uid,
          email,
          pharmacyName: customPharmacyName?.trim() || fallbackPharmacy,
          displayName: displayName || '',
          photoURL: photoURL || '',
          createdAt: now.toISOString(),
          trialEndsAt: trialEnd.toISOString(),
          subscribedUntil: null,
          role: isAdminUser ? 'admin' : 'user',
        };

        try {
          await setDoc(userDocRef, newProfile);
        } catch (setErr) {
          handleFirestoreError(setErr, OperationType.CREATE, `users/${uid}`);
        }

        setProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      return null;
    }
  };

  useEffect(() => {
    // 1. Check redirect result for mobile redirects
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user && result.user.email) {
          await fetchProfile(
            result.user.uid,
            result.user.email,
            result.user.displayName,
            result.user.photoURL
          );
        }
      })
      .catch((error) => {
        console.warn('Redirect result check:', error);
      });

    // 2. Listen to Auth State
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.email) {
        await fetchProfile(user.uid, user.email, user.displayName, user.photoURL);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      if (cred.user.email) {
        await fetchProfile(cred.user.uid, cred.user.email, cred.user.displayName, cred.user.photoURL);
      }
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, pass: string, pharmacyName: string) => {
    setLoading(true);
    try {
      // 1. Create auth user (throws Firebase Auth errors to be handled by caller)
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const isAdminUser = email === 'mirolab12@gmail.com';

      const initialProfile: UserProfile = {
        id: cred.user.uid,
        email,
        pharmacyName: pharmacyName.trim() || 'صيدلية ' + (email.split('@')[0] || 'الحديثة'),
        displayName: '',
        photoURL: '',
        createdAt: now.toISOString(),
        trialEndsAt: trialEnd.toISOString(),
        subscribedUntil: null,
        role: isAdminUser ? 'admin' : 'user',
      };

      try {
        await setDoc(doc(db, 'users', cred.user.uid), initialProfile);
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.CREATE, `users/${cred.user.uid}`);
      }

      setProfile(initialProfile);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (targetEmail: string) => {
    await sendPasswordResetEmail(auth, targetEmail.trim());
  };

  const loginWithGoogle = async (customPharmacyName?: string) => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      let cred;
      try {
        cred = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        if (
          popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/cancelled-popup-request' ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }

      if (cred && cred.user && cred.user.email) {
        await fetchProfile(
          cred.user.uid,
          cred.user.email,
          cred.user.displayName,
          cred.user.photoURL,
          customPharmacyName
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const updatePharmacyName = async (newName: string) => {
    if (!currentUser) return;
    const cleanName = newName.trim();
    if (!cleanName) return;

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        pharmacyName: cleanName,
      });
      setProfile((prev) => (prev ? { ...prev, pharmacyName: cleanName } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (currentUser && currentUser.email) {
      await fetchProfile(currentUser.uid, currentUser.email, currentUser.displayName, currentUser.photoURL);
    }
  };

  const activateUserSubscription = async (targetUserId: string, untilDateISO: string) => {
    try {
      await updateDoc(doc(db, 'users', targetUserId), {
        subscribedUntil: untilDateISO,
      });
      if (currentUser?.uid === targetUserId) {
        await refreshProfile();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUserId}`);
    }
  };

  const deactivateUserAccount = async (targetUserId: string) => {
    try {
      const expiredDate = new Date(0).toISOString();
      await updateDoc(doc(db, 'users', targetUserId), {
        subscribedUntil: null,
        trialEndsAt: expiredDate,
      });
      if (currentUser?.uid === targetUserId) {
        await refreshProfile();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUserId}`);
    }
  };

  // Subscription & Trial calculations
  const nowTime = Date.now();
  const trialEndTime = profile?.trialEndsAt ? new Date(profile.trialEndsAt).getTime() : 0;
  const isTrialActive = trialEndTime > nowTime;
  const daysRemainingInTrial = Math.max(0, Math.ceil((trialEndTime - nowTime) / (1000 * 60 * 60 * 24)));

  const subEndTime = profile?.subscribedUntil ? new Date(profile.subscribedUntil).getTime() : 0;
  const isSubscribed = subEndTime > nowTime;

  // Strict role-based check directly from user's document in Firestore
  const isAdmin = profile?.role === 'admin';
  const hasAccess = isAdmin || isTrialActive || isSubscribed;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
        hasAccess,
        isAdmin,
        isTrialActive,
        isSubscribed,
        daysRemainingInTrial,
        login,
        signup,
        loginWithGoogle,
        resetPassword,
        updatePharmacyName,
        logout,
        refreshProfile,
        activateUserSubscription,
        deactivateUserAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
