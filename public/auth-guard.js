// Gates pages behind login. Include before page scripts.
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    const page = (location.pathname.split("/").pop() || "index.html") + (location.search || "");
    window.location.href = `login.html?redirect=${encodeURIComponent(page)}`;
    return;
  }
  document.documentElement.classList.add("auth-ok");
});
