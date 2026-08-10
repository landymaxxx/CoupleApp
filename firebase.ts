import { initializeApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDPgFCPUsFkAR95N1xYrt1WqJioTrDlgcM",
  authDomain: "coupleapp-c73ae.firebaseapp.com",
  databaseURL: "https://coupleapp-c73ae-default-rtdb.firebaseio.com",
  projectId: "coupleapp-c73ae",
  storageBucket: "coupleapp-c73ae.firebasestorage.app",
  messagingSenderId: "351632220756",
  appId: "1:351632220756:web:26d06ff995cff78da303c1",
  measurementId: "G-3DYMGHG54B"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { auth, db };