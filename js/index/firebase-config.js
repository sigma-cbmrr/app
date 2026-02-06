const firebaseConfig = { 
    apiKey: "AIzaSyCB0PH0UgghgsvH0BgPkG4AkKON6xSQ9mc", 
    authDomain: "sigma-cbmrr.firebaseapp.com", 
    projectId: "sigma-cbmrr", 
    storageBucket: "sigma-cbmrr.firebasestorage.app", 
    messagingSenderId: "378026276038", 
    appId: "1:378026276038:web:620dd6ff57501b1a8313c7" 
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
