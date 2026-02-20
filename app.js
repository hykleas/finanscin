// Firebase import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Senin config
const firebaseConfig = {
  apiKey: "AIzaSyCjk4HIm1zZV2zIMybrLjRk8OOnmNkS6mI",
  authDomain: "finansciniz-a2b90.firebaseapp.com",
  projectId: "finansciniz-a2b90",
  storageBucket: "finansciniz-a2b90.firebasestorage.app",
  messagingSenderId: "828925400604",
  appId: "1:828925400604:web:b61c6e33243e7c699531d9",
  measurementId: "G-SBJV3H4BQ3"
};

// başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===== KAYIT =====
window.registerUser = async function () {
  const email = document.getElementById("reg-email").value;
  const pass = document.getElementById("reg-pass").value;
  const passConfirm = document.getElementById("reg-pass-confirm").value;

  // Şifre kontrolü
  if (pass !== passConfirm) {
    alert("Şifreler eşleşmiyor!");
    return;
  }

  if (pass.length < 6) {
    alert("Şifre en az 6 karakter olmalıdır!");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    alert("Kayıt başarılı 🎉");
    window.location.href = "dashboard.html";
  } catch (e) {
    alert("Hata: " + e.message);
  }
};

// ===== GİRİŞ =====
window.loginUser = async function () {
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-pass").value;

  if (!email || !pass) {
    alert("Lütfen e-posta ve şifre girin!");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    alert("Giriş başarılı ✅");
    window.location.href = "dashboard.html";
  } catch (e) {
    alert("Hata: " + e.message);
  }
};

console.log("app.js yüklendi");
