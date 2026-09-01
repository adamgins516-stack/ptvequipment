// Same Firebase project as the rest of Patriots TV (ptv-rundown).
// Equipment data lives under its own top-level path ("equipment") so it
// never touches the rundown board or submissions data.
const firebaseConfig = {
  apiKey: "AIzaSyDrWVDnCm0FxIzRvyd-J3yGd90ispqBmvc",
  authDomain: "ptv-rundown.firebaseapp.com",
  databaseURL: "https://ptv-rundown-default-rtdb.firebaseio.com",
  projectId: "ptv-rundown",
  storageBucket: "ptv-rundown.firebasestorage.app",
  messagingSenderId: "188125501350",
  appId: "1:188125501350:web:37e51011291904839ee167"
};

firebase.initializeApp(firebaseConfig);
