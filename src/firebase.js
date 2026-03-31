import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCEFV9VBQmpjyfL_QErAFhUKkEC8BgOYvw",
  authDomain:        "carteira-app-1b31e.firebaseapp.com",
  projectId:         "carteira-app-1b31e",
  storageBucket:     "carteira-app-1b31e.firebasestorage.app",
  messagingSenderId: "172473433319",
  appId:             "1:172473433319:web:f9866e7530337124c2f642",
  measurementId:     "G-NT3VSZS8M1"
};

const app = initializeApp(firebaseConfig);

// persistentLocalCache  → dados ficam no IndexedDB do dispositivo
// persistentMultipleTabManager → sincroniza entre abas do mesmo navegador
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();