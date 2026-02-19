import { useState, useEffect, useRef, createContext, useContext } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── FIREBASE ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCNSwL3fbRzOHe4DpaHvMJ--8gz46VYpm0",
  authDomain: "tally-app-fac0e.firebaseapp.com",
  projectId: "tally-app-fac0e",
  storageBucket: "tally-app-fac0e.firebasestorage.app",
  messagingSenderId: "260823272960",
  appId: "1:260823272960:web:a1c1364b412bb1010a92e5"
};
const fbApp        = initializeApp(firebaseConfig);
const db           = getFirestore(fbApp);
const auth         = getAuth(fbApp);
const googleProvider = new GoogleAuthProvider();

const peopleCol  = (uid) => collection(db, "users", uid, "people");
const txCol      = (uid) => collection(db, "users", uid, "transactions");
const txDoc      = (uid, id) => doc(db, "users", uid, "transactions", id);
const personDoc  = (uid, id) => doc(db, "users", uid, "people", id);

// ── STYLES ────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  * { font-family: 'Albert Sans', sans-serif; box-sizing: border-box; }
`;
document.head.appendChild(style);

// ── HELPERS ───────────────────────────────────────────────────
const AppContext  = createContext(null);
const useApp      = () => useContext(AppContext);
const uid         = () => Math.random().toString(36).slice(2, 9);
const fmt         = (n) => Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits:2, maximumFractionDigits:2 });
const formatDate  = (iso) => {
  const d = new Date(iso);
  const days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getDay()]}, ${d.getDate()}, ${months[d.getMonth()]}, ${d.getFullYear()} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};
const formatMonthYear = (iso) => {
  const d = new Date(iso);
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()] + " " + d.getFullYear();
};
const getPersonStats = (personId, txs) => {
  const list     = txs.filter(t => t.personId===personId && t.status==="unpaid");
  const sent     = list.filter(t => t.direction==="gave").reduce((s,t) => s+t.amount, 0);
  const received = list.filter(t => t.direction==="got" ).reduce((s,t) => s+t.amount, 0);
  return { sent, received, balance: sent - received };
};
const getTotalBalance = (txs) => {
  const u = txs.filter(t => t.status==="unpaid");
  return u.filter(t=>t.direction==="gave").reduce((s,t)=>s+t.amount,0)
       - u.filter(t=>t.direction==="got" ).reduce((s,t)=>s+t.amount,0);
};
const getInitials = (name="") => name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

// ── AVATAR ────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg:"#D0BCFF", fg:"#21005D" }, { bg:"#B5EAD7", fg:"#0D3B2E" },
  { bg:"#FFD6BA", fg:"#4A1B00" }, { bg:"#FFDDE1", fg:"#4A0010" },
  { bg:"#BDE3FF", fg:"#001E31" }, { bg:"#D4F0E4", fg:"#003824" },
  { bg:"#E8D5F5", fg:"#2D0057" },
];
const Avatar = ({ person, size=44, showPaidBadge=false }) => {
  const idx = person?.fullName ? person.fullName.charCodeAt(0) % AVATAR_COLORS.length : 0;
  const { bg, fg } = AVATAR_COLORS[idx];
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size }}>
      <div style={{ width:size, height:size, borderRadius:"50%", background:bg, color:fg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:Math.round(size*0.36), fontWeight:700, letterSpacing:"0.5px", userSelect:"none" }}>
        {person?.initials || getInitials(person?.fullName || person?.name || "?")}
      </div>
      {showPaidBadge && (
        <div style={{ position:"absolute", bottom:-2, right:-2, width:Math.round(size*0.38), height:Math.round(size*0.38), borderRadius:"50%", background:"#3A9E6E", border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span className="material-symbols-outlined" style={{ fontSize:Math.round(size*0.22), color:"#fff", fontVariationSettings:"'FILL' 1, 'wght' 700" }}>check</span>
        </div>
      )}
    </div>
  );
};

// ── TALLY LOGO ────────────────────────────────────────────────
const TallyLogo = () => (
  <svg width="100" height="38" viewBox="0 0 115 43" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.3"><path d="M17.3485 42.3393C25.0602 42.3393 31.3118 41.2903 31.3118 39.9962C31.3118 38.7021 25.0602 37.6531 17.3485 37.6531C9.63682 37.6531 3.38525 38.7021 3.38525 39.9962C3.38525 41.2903 9.63682 42.3393 17.3485 42.3393Z" fill="#371A45"/></g>
    <path d="M34.2901 15.6931C34.2827 15.6645 34.2746 15.6373 34.2651 15.6101C34.1851 15.3611 34.0389 15.1525 33.8288 14.9909C32.8739 14.2535 30.7211 15.2238 27.1476 16.222C27.0191 10.3899 25.9525 6.115 22.5885 4.15604C21.2237 3.36276 19.4851 2.94995 17.2808 2.96758C9.62711 2.90735 7.59321 8.02769 7.41621 16.2227C3.84204 15.2245 1.68769 14.2535 0.732813 14.9909C-0.706846 16.103 0.85107 19.401 5.84948 22.9546L5.98463 22.3773L5.98683 22.3795C4.24968 29.4544 5.69082 34.1891 9.78283 36.7305C10.6246 37.2528 11.578 37.6825 12.6386 38.0211C15.6546 38.9826 18.907 38.9826 21.923 38.0211C28.2171 36.0136 30.7284 30.7868 28.4984 22.0754L28.7121 22.9546C32.4024 20.3316 34.2174 17.8475 34.3356 16.2793C34.351 16.0655 34.3356 15.8694 34.2901 15.6931Z" fill="#6A5B75"/>
    <g opacity="0.55"><path d="M33.8283 14.9909C32.9167 14.2865 30.4363 15.2752 27.1449 16.2227C27.153 16.46 27.2656 16.6287 27.2707 16.8718C30.7303 15.9059 33.2289 14.9013 34.2279 15.5102C34.1434 15.3053 34.0097 15.1305 33.8283 14.9909Z" fill="white"/></g>
    <g opacity="0.55"><path d="M24.6614 5.99451C23.1527 4.39179 20.947 3.52799 17.7768 3.55297C10.2418 3.49368 8.15363 8.45545 7.92175 16.4289C7.9142 16.6887 7.87968 16.9471 7.82052 17.2001L7.28635 19.4847L7.40534 16.6642C4.13306 15.7203 2.13737 14.8741 1.22877 15.5763C0.33412 16.2675 0.597078 17.8027 2.12341 19.719C0.165181 17.5324 -0.251292 15.7512 0.732964 14.9909C1.68784 14.2535 3.84219 15.2245 7.41636 16.2227C7.59337 8.02768 9.62727 2.90734 17.281 2.96757C20.8177 2.93964 23.1542 4.01792 24.6614 5.99451Z" fill="white"/></g>
    <path d="M15.5176 38.6403C15.5007 40.0109 13.8598 40.2445 13.0305 39.5349C12.8991 39.7119 12.7661 39.8655 12.6324 39.9955C12.3394 40.2805 12.0411 40.4545 11.7459 40.5258C10.9489 40.7197 10.1703 40.1666 9.5614 39.0193C9.52467 39.0318 9.48868 39.0435 9.45342 39.0546C7.1911 39.7604 6.26561 38.2716 9.88679 36.7944L12.5068 37.6531L15.5176 38.6403Z" fill="#FFB127"/>
    <path d="M16.6147 3.66272C14.7784 0.259438 18.0689 -1.35877 18.3696 2.30024C19.4699 0.381854 21.9032 1.94086 18.9896 3.66272" fill="#6A5B75"/>
    <g opacity="0.3"><path d="M24.8118 25.1441C23.2576 21.8212 23.9723 20.1369 24.1801 13.3948C24.3976 6.3632 22.6384 4.21767 22.587 4.15597C25.9525 6.11493 27.019 10.3898 27.1454 16.2227C27.1726 19.0462 27.7058 20.0179 27.7058 20.0179C28.4771 21.1564 30.2399 19.719 30.2399 19.719C33.2008 17.9789 34.1432 15.9046 34.2651 15.6101C34.2901 15.6931 34.315 16.0052 34.3356 16.2777C34.3121 16.5943 34.2203 16.9462 34.0579 17.3288C33.4424 18.7817 31.8184 20.6768 29.1073 22.6688C28.978 22.7636 28.8465 22.859 28.7121 22.9545L28.505 22.0716L28.4984 22.0753C29.6383 26.5294 29.5392 30.0728 28.3287 32.7405C27.1123 34.9463 25.0557 36.4859 22.2432 37.3827C19.2273 38.3442 15.9748 38.3442 12.9589 37.3827C12.6504 37.2843 12.3507 37.1778 12.0605 37.0632C23.0218 38.0974 26.9419 29.2942 25.1086 25.7472Z" fill="#371A45"/></g>
    <path d="M44.3837 15.3895C44.3837 12.4777 44.4576 12.0861 44.6054 12.0861C46.3051 12.1082 48.5924 12.0898 51.6224 12.0528C54.6597 12.0159 56.9322 11.9974 58.4398 11.9974C58.8167 11.9974 59.0532 12.0306 59.1493 12.0971C59.2528 12.1637 59.3045 12.293 59.3045 12.4851V12.7955C59.3045 13.1798 59.3156 14.5027 59.3267 16.2098C59.3267 16.5941 59.2232 16.7862 59.0163 16.7862C58.6024 16.7862 57.165 16.7641 55.3138 16.7419V28.6253C55.262 28.847 55.1364 28.9653 54.9369 28.9801C54.3013 28.9801 52.9341 28.9579 52.6755 28.9579C52.306 28.9801 51.2566 28.969 49.9485 28.9579H49.2834C49.1356 28.9727 48.9213 28.9801 48.6404 28.9801L48.197 28.448C48.197 27.3247 48.3079 23.4374 48.4187 18.4269C48.4187 18.0537 48.4076 17.8837 48.3855 17.6065C48.3781 17.4957 48.3596 17.407 48.33 17.3405C48.2044 17.056 48.1527 17.0042 48.0862 16.9747C48.027 16.9377 47.9531 16.9193 47.8645 16.9193H44.6941C44.4871 16.8601 44.3837 16.3502 44.3837 15.3895ZM63.6943 25.9205H67.1085C67.2563 25.9205 67.345 25.9316 67.3746 25.9538C67.4042 25.9686 67.4337 26.0462 67.4633 26.1866L67.8845 27.8715C67.8919 27.9307 67.9104 27.9787 67.9399 28.0156C67.9769 28.0526 68.0323 28.0822 68.1062 28.1043C68.1875 28.1265 68.2466 28.1413 68.2836 28.1487C68.3205 28.1561 68.4018 28.1671 68.5275 28.1819H73.671C73.9149 28.1819 74.0775 28.1524 74.1588 28.0932C74.2475 28.0341 74.2918 27.9011 74.2918 27.6942C74.2696 27.6203 74.2142 27.4946 74.1255 27.3173C73.9814 26.9995 73.9593 26.6965 73.9593 26.6965C73.4567 25.2628 73.0761 24.1173 72.8175 23.26L72.3741 21.6638C72.3149 21.4864 72.2115 21.2425 72.0637 20.9321C71.9233 20.6144 71.8013 20.3187 71.6979 20.0453C71.5944 19.7719 71.5279 19.528 71.4983 19.3137V19.1807C71.1658 18.183 70.6411 16.5867 69.9242 14.3918C69.7764 14.1184 69.6951 13.9484 69.6803 13.8819V13.5937C69.5769 13.4163 69.0152 13.3276 67.9954 13.3276L62.0093 13.2833C61.9502 13.3424 61.8874 13.4274 61.8209 13.5382C61.7876 13.5937 60.9303 16.2467 60.6791 16.9414V16.9636C60.2652 18.1904 59.6814 20.0305 58.9276 22.4619C58.1812 24.8933 57.6121 26.6965 57.2205 27.8715V28.2484H62.0093C62.3197 28.2484 62.571 28.2078 62.7631 28.1265C62.9626 28.0452 63.1104 27.9196 63.2065 27.7496C63.3026 27.5722 63.3691 27.406 63.4061 27.2508C63.4504 27.0882 63.4947 26.8702 63.5391 26.5967C63.5908 26.3159 63.6425 26.0905 63.6943 25.9205ZM66.6651 20.6439C66.6651 20.6735 66.6799 20.7215 66.7095 20.788C66.7464 20.8471 66.7686 20.8878 66.776 20.91V21.1538C66.909 21.6564 66.9755 22.0037 66.9755 22.1959H64.2264C64.2264 22.1663 64.2448 22.0591 64.2818 21.8744C64.3187 21.6896 64.3372 21.5603 64.3372 21.4864C64.4924 20.8213 64.6919 19.9492 64.9358 18.8703C64.9358 18.8629 64.9617 18.837 65.0134 18.7927C65.0652 18.7483 65.0984 18.7003 65.1132 18.6486V18.1165C65.2906 17.1631 65.4679 16.668 65.6453 16.631V16.6089C65.7931 16.6754 65.8965 16.7862 65.9557 16.9414V17.4735C66.0517 17.7691 66.1404 18.0906 66.2217 18.4379C66.303 18.7779 66.3843 19.1807 66.4656 19.6462C66.5543 20.1044 66.6208 20.437 66.6651 20.6439ZM75.356 13.2833C75.1047 13.5124 74.9791 14.1479 74.9791 15.1899C74.9791 15.4708 74.9939 15.8514 75.0234 16.3317C75.053 16.8121 75.0678 17.1262 75.0678 17.274C75.0678 17.9465 75.0419 18.9331 74.9902 20.2338C74.9385 21.5344 74.9126 22.4989 74.9126 23.127V27.9159C74.9717 28.0193 75.0234 28.0895 75.0678 28.1265C75.1195 28.1634 75.1565 28.1967 75.1786 28.2263H85.355C86.0053 28.2263 86.36 28.0785 86.4191 27.7829V24.0804C86.4191 23.9621 86.3896 23.8734 86.3305 23.8143C86.2713 23.7552 86.2122 23.7219 86.1531 23.7145C86.094 23.7072 86.0053 23.7035 85.887 23.7035H81.1869V15.6112C81.1869 15.5521 81.2275 15.4782 81.3088 15.3895C81.3975 15.2934 81.4455 15.2269 81.4529 15.1899V14.7022C81.4529 14.6209 81.4566 14.5027 81.464 14.3475C81.4714 14.1923 81.4751 14.074 81.4751 13.9927V13.8375C81.3495 13.5493 81.1943 13.3941 81.0095 13.372C80.943 13.372 80.8506 13.3646 80.7324 13.3498C80.6215 13.335 80.5587 13.3276 80.5439 13.3276C80.4848 13.3276 80.4479 13.335 80.4331 13.3498C80.3001 13.335 80.1079 13.3276 79.8566 13.3276H78.7925C78.0387 13.3276 76.8932 13.3128 75.356 13.2833ZM87.8381 13.2833C87.5868 13.5124 87.4612 14.1479 87.4612 15.1899C87.4612 15.4708 87.4759 15.8514 87.5055 16.3317C87.4759 15.8514 87.4612 15.4708 87.4612 15.1899C87.4612 14.1479 87.5868 13.5124 87.8381 13.2833C89.3752 13.3128 90.5207 13.3276 91.2745 13.3276H92.3387C92.59 13.3276 92.7821 13.335 92.9151 13.3498C92.9299 13.335 92.9669 13.3276 93.026 13.3276C93.0408 13.3276 93.1036 13.335 93.2144 13.3498C93.3327 13.3646 93.4251 13.372 93.4916 13.372C93.6763 13.3941 93.8315 13.5493 93.9571 13.8375V13.9927C93.9571 14.074 93.9535 14.1923 93.9461 14.3475C93.9387 14.5027 93.935 14.6209 93.935 14.7022V15.1899C93.9276 15.2269 93.8796 15.2934 93.7909 15.3895C93.7096 15.4782 93.6689 15.5521 93.6689 15.6112V23.7035H98.3691C98.4873 23.7035 98.576 23.7072 98.6351 23.7145C98.6943 23.7219 98.7534 23.7552 98.8125 23.8143C98.8716 23.8734 98.9012 23.9621 98.9012 24.0804V27.7829C98.8421 28.0785 98.4873 28.2263 97.837 28.2263H87.6607C87.6385 28.1967 87.6016 28.1634 87.5498 28.1265C87.5055 28.0895 87.4538 28.0193 87.3946 27.9159V23.127C87.3946 22.4989 87.4205 21.5344 87.4722 20.2338C87.524 18.9331 87.5498 17.9465 87.5498 17.274C87.5498 17.1262 87.5351 16.8121 87.5055 16.3317ZM105.009 13.372H99.1451C98.7903 13.372 98.613 13.4754 98.613 13.6823C98.613 14.0297 98.916 14.8094 99.522 16.0213L100.708 17.6841L103.269 23.1492V27.7829L103.624 28.2484H107.858C107.932 28.2484 108.072 28.2521 108.279 28.2595C108.494 28.2669 108.656 28.2706 108.767 28.2706C108.885 28.2632 109.018 28.2521 109.166 28.2374C109.321 28.2152 109.44 28.1708 109.521 28.1043C109.61 28.0378 109.669 27.9528 109.698 27.8494V27.5168C109.698 27.1769 109.691 26.5672 109.676 25.6877C109.661 24.8083 109.654 24.1543 109.654 23.7256L109.477 22.9829L114.509 13.8708C114.435 13.5308 114.31 13.3498 114.132 13.3276C112.736 13.3424 111.435 13.3572 110.23 13.372C110.171 13.372 110.094 13.3683 109.998 13.3609C109.909 13.3535 109.839 13.3498 109.787 13.3498C109.048 13.3498 108.649 13.4385 108.59 13.6158C108.575 13.7193 108.531 13.8523 108.457 14.0149C108.383 14.1775 108.338 14.2883 108.324 14.3475C107.836 15.8477 107.311 17.3479 106.75 18.8481L105.009 13.372Z" fill="black"/>
  </svg>
);

// ── SUCCESS OVERLAY ────────────────────────────────────────────
const SuccessOverlay = ({ visible, icon="check_circle", title, subtitle, onDone }) => {
  useEffect(() => {
    if (visible) { const t = setTimeout(onDone, 1800); return () => clearTimeout(t); }
  }, [visible]);
  if (!visible) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(255,255,255,0.96)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.22s ease" }}>
      <div style={{ width:80, height:80, borderRadius:"50%", background:"#E8F7EE", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
        <span className="material-symbols-outlined" style={{ fontSize:40, color:"#3A9E6E", fontVariationSettings:"'FILL' 1, 'wght' 400" }}>{icon}</span>
      </div>
      <div style={{ fontSize:22, fontWeight:600, color:"#111", letterSpacing:-0.3 }}>{title}</div>
      {subtitle && <div style={{ fontSize:14, fontWeight:300, color:"#888", marginTop:8, textAlign:"center", maxWidth:220 }}>{subtitle}</div>}
    </div>
  );
};

// ── BOTTOM SHEET ──────────────────────────────────────────────
const BottomSheet = ({ open, onClose, children }) => (
  <div style={{ position:"fixed", inset:0, zIndex:50, pointerEvents:open?"auto":"none", display:"flex", flexDirection:"column", justifyContent:"flex-end", maxWidth:480, margin:"0 auto" }}>
    <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", opacity:open?1:0, transition:"opacity 200ms" }} />
    <div style={{ position:"relative", transform:`translateY(${open?"0":"100%"})`, background:"#fff", zIndex:51, transition:"transform 220ms cubic-bezier(.32,1,.6,1)", padding:"12px 24px 36px" }}>
      <div style={{ width:40, height:4, borderRadius:99, background:"#E0E0E0", margin:"0 auto 8px" }} />
      <button onClick={onClose} style={{ position:"absolute", top:14, right:18, background:"none", border:"none", fontSize:19, color:"#999", cursor:"pointer", lineHeight:1 }}>✕</button>
      {children}
    </div>
  </div>
);

// ── TOAST ─────────────────────────────────────────────────────
const Toast = ({ message, visible }) => (
  <div style={{ position:"fixed", bottom:88, left:"50%", transform:`translateX(-50%) translateY(${visible?0:16}px)`, background:"#222", color:"#fff", padding:"10px 22px", borderRadius:99, fontSize:13, fontWeight:500, zIndex:100, opacity:visible?1:0, transition:"all 200ms", pointerEvents:"none", whiteSpace:"nowrap" }}>
    {message}
  </div>
);

// ── BOTTOM NAV ────────────────────────────────────────────────
const BottomNav = ({ active, onNavigate }) => (
  <div style={{ background:"#fff", borderTop:"1px solid #F0F0F0", display:"flex", justifyContent:"space-around", alignItems:"center", padding:"10px 0 20px", zIndex:40 }}>
    {[{ id:"home", icon:"home" }, { id:"transactions", icon:"contract" }, { id:"account", icon:"person" }].map(({ id, icon }) => (
      <button key={id} onClick={() => onNavigate(id)} style={{ background:active===id?"#F4F2FA":"none", border:"none", width:64, height:44, borderRadius:99, cursor:"pointer", color:active===id?"#7C5CBF":"#AAAAAA", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <span className="material-symbols-outlined" style={{ fontSize:24, fontVariationSettings:active===id?"'FILL' 1":"'FILL' 0" }}>{icon}</span>
      </button>
    ))}
  </div>
);

// ── TX ROW ────────────────────────────────────────────────────
const TxRow = ({ tx, person, onClick, showAvatar=true }) => (
  <div onClick={onClick} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#fff", border:"1px solid #E2E2E2", borderRadius:99, padding:"12px 12px", cursor:"pointer", gap:12 }}>
    <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
      {showAvatar && person && <Avatar person={person} size={44} />}
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:15, color:"#111", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", lineHeight:1.35 }}>
          {showAvatar ? (person?.fullName||person?.name) : tx.description}
        </div>
        <div style={{ fontSize:12, color:"#A4A4A4", marginTop:3, fontWeight:400 }}>{formatDate(tx.datetime)}</div>
      </div>
    </div>
    <div style={{ background:tx.status==="paid"?"#E6F7EE":"#F9F9F9", borderRadius:99, padding:"8px 18px", flexShrink:0 }}>
      <span style={{ fontSize:14, fontWeight:700, color:tx.status==="paid"?"#3A9E6E":tx.direction==="gave"?"#6B2D6B":"#111", letterSpacing:-0.3 }}>
        {tx.direction==="gave" ? `-R${fmt(tx.amount)}` : `R${fmt(tx.amount)}`}
      </span>
    </div>
  </div>
);

// ── HOME SCREEN ───────────────────────────────────────────────
const HomeScreen = ({ onPersonClick, onTxClick, onAddPerson }) => {
  const { transactions, people, authUser } = useApp();
  const total = getTotalBalance(transactions);
  const firstName = authUser?.displayName?.split(" ")[0] || "there";
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#fff" }}>
      <div style={{ flexShrink:0, background:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"env(safe-area-inset-top, 20px) 24px 0" }}>
          <TallyLogo />
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:13, color:"#ABABAB", fontWeight:400, lineHeight:1.4 }}>
              Hi, <span style={{ fontWeight:700, color:"#111" }}>{firstName}</span>
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:"#111", marginTop:0, letterSpacing:-0.5, lineHeight:1.2 }}>
              -{`R${fmt(total)}`}
            </div>
          </div>
        </div>
        <div style={{ marginTop:32 }}>
          <div style={{ fontWeight:500, fontSize:17, color:"#111", padding:"0 24px", marginBottom:18, letterSpacing:-0.1 }}>My People</div>
          <div style={{ display:"flex", gap:14, overflowX:"auto", paddingLeft:24, paddingRight:24, paddingBottom:6 }}>
            <div onClick={onAddPerson} style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0, gap:6, cursor:"pointer" }}>
              <div style={{ width:70, height:70, borderRadius:"50%", border:"2px dashed #111", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:26, color:"#111", lineHeight:1, marginTop:-1 }}>+</span>
              </div>
              <span style={{ fontSize:12, color:"#111", fontWeight:400 }}>Add</span>
            </div>
            {people.map(p => {
              const personTxs    = transactions.filter(t => t.personId===p.id);
              const personAllPaid = personTxs.length > 0 && personTxs.every(t => t.status==="paid");
              return (
                <div key={p.id} onClick={() => onPersonClick(p)} style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0, cursor:"pointer", gap:6 }}>
                  <Avatar person={p} size={70} showPaidBadge={personAllPaid} />
                  <span style={{ fontSize:12, color:"#555", fontWeight:500 }}>{p.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ fontWeight:500, fontSize:17, color:"#111", padding:"28px 24px 14px", letterSpacing:-0.1 }}>Transactions</div>
      </div>
      <div style={{ flex:1, overflowY:"auto", background:"#fff", paddingBottom:24 }}>
        <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:10 }}>
          {[...transactions].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime)).map(tx => {
            const p = people.find(x => x.id===tx.personId);
            return <TxRow key={tx.id} tx={tx} person={p} onClick={() => onTxClick(tx)} />;
          })}
          {transactions.length===0 && <div style={{ textAlign:"center", color:"#BABABA", padding:"40px 0", fontSize:14 }}>No transactions yet</div>}
        </div>
      </div>
    </div>
  );
};

// ── PERSON SCREEN ─────────────────────────────────────────────
const PersonScreen = ({ person, onBack, onTxClick, onAddNew, onEditPerson }) => {
  const { transactions, markAllPaid } = useApp();
  const [paidSheet, setPaidSheet] = useState(false);
  const txs       = transactions.filter(t => t.personId===person.id);
  const unpaidTxs = txs.filter(t => t.status==="unpaid");
  const { sent, received, balance } = getPersonStats(person.id, transactions);
  const allPaid   = txs.length > 0 && unpaidTxs.length === 0;

  const handleCall = () => {
    if (person.phone) { window.location.href = `tel:${person.phone.replace(/\s/g,"")}`; }
    else { alert(`No phone number saved for ${person.name}.\nEdit their profile to add one.`); }
  };

  const handleRemind = () => {
    const amt  = `R${fmt(Math.abs(balance))}`;
    const text = `Hi ${person.name}! Just a friendly reminder about ${amt} owed. Tracked via Tally 🐧`;
    if (navigator.share) navigator.share({ title:`Tally reminder`, text });
    else navigator.clipboard?.writeText(text);
  };

  const actions = [
    { label:"All paid", bg: allPaid ? "#3A9E6E" : "#C6F0D8", icon:"check",               color: allPaid ? "#fff" : "#3A9E6E", action:()=>!allPaid && setPaidSheet(true) },
    { label:"Call",     bg:"#F0F0F0",  icon:"call",                color:"#444",    action:handleCall   },
    { label:"Remind",   bg:"#FDEBC8",  icon:"notifications_active", color:"#D4800A", action:handleRemind },
    { label:"Add new",  bg:"#E8E0F7",  icon:"add",                 color:"#7C5CBF", action:()=>onAddNew(person) },
  ];

  return (
    <div style={{ background:"#fff", height:"100%", display:"flex", flexDirection:"column" }}>

      {/* Header row: back + edit */}
      <div style={{ padding:"env(safe-area-inset-top, 20px) 20px 0", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:4, lineHeight:1, display:"flex", alignItems:"center" }}>
          <span className="material-symbols-outlined" style={{ fontSize:28, color:"#111", fontVariationSettings:"'FILL' 0, 'wght' 300, 'opsz' 24" }}>chevron_left</span>
        </button>
        <button onClick={() => onEditPerson(person)} style={{ background:"#F5F5F5", border:"none", borderRadius:99, padding:"8px 16px", display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
          <span className="material-symbols-outlined" style={{ fontSize:16, color:"#555" }}>edit</span>
          <span style={{ fontSize:13, fontWeight:600, color:"#555" }}>Edit</span>
        </button>
      </div>

      {/* Profile info */}
      <div style={{ padding:"14px 24px 0", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
          <Avatar person={person} size={58} showPaidBadge={allPaid} />
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:"#111" }}>{person.fullName}</div>
            {person.phone && <div style={{ fontSize:13, color:"#BABABA", marginTop:2 }}>{person.phone}</div>}
            {person.isLinked && <div style={{ fontSize:12, color:"#7C5CBF", fontWeight:500, marginTop:2 }}>● On Tally</div>}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1, background:"#F8F7FF", borderRadius:16, padding:"14px 16px", textAlign:"center" }}>
            <div style={{ fontSize:12, fontWeight:300, color:"#BABABA", marginBottom:5 }}>Sent</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#111" }}>-R{fmt(sent)}</div>
          </div>
          <div style={{ flex:1, background:"#F8F7FF", borderRadius:16, padding:"14px 16px", textAlign:"center" }}>
            <div style={{ fontSize:12, fontWeight:300, color:"#BABABA", marginBottom:5 }}>Received</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#111" }}>R{fmt(received)}</div>
          </div>
        </div>

        {/* Balance card */}
        <div style={{ background: allPaid ? "#E8F7EE" : "#F8F7FF", border:`1px solid ${allPaid?"#B5E8CC":"#E8E0F7"}`, borderRadius:16, padding:"14px 16px", marginTop:10, textAlign:"center" }}>
          <div style={{ fontSize:13, fontWeight:300, color:"#BABABA" }}>Current balance</div>
          {allPaid
            ? <div style={{ fontWeight:700, fontSize:15, marginTop:8, color:"#3A9E6E" }}>✓ All settled up!</div>
            : <div style={{ fontWeight:700, fontSize:15, marginTop:8, color:"#111" }}>{person.name} {balance>=0?"owes you":"owes them"} <span style={{ color:"#7C5CBF" }}>R{fmt(balance)}</span></div>
          }
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", gap:10, marginTop:16, marginBottom:16 }}>
          {actions.map(({ label, bg, icon, color, action }) => (
            <button key={label} onClick={action} style={{ flex:1, background:bg, border:"none", borderRadius:99, padding:"12px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", transition:"opacity .15s" }}>
              <span className="material-symbols-outlined" style={{ fontSize:20, color, fontVariationSettings:"'FILL' 0, 'wght' 300" }}>{icon}</span>
              <span style={{ fontSize:11.5, color: label==="All paid" && allPaid ? "#fff" : "#333", marginTop:2, fontWeight:600 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* History list */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 20px", paddingBottom:24 }}>
        {txs.length===0
          ? <div style={{ color:"#BABABA", textAlign:"center", padding:"32px 0", fontSize:14 }}>No transactions yet</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[...txs].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime)).map(tx => (
                <TxRow key={tx.id} tx={tx} person={person} onClick={() => onTxClick(tx)} showAvatar={false} />
              ))}
            </div>
        }
      </div>

      {/* All-paid confirmation sheet */}
      <BottomSheet open={paidSheet} onClose={() => setPaidSheet(false)}>
        <div style={{ paddingTop:12 }}>
          <div style={{ fontSize:28, fontWeight:600, color:"#111", lineHeight:1.3 }}>Mark everything<br/>as settled?</div>
          <div style={{ fontSize:14, color:"#BABABA", marginTop:8, marginBottom:24 }}>
            This will settle {unpaidTxs.length} unpaid transaction{unpaidTxs.length!==1?"s":""} with {person.name}.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setPaidSheet(false)} style={{ flex:1, background:"#FDE8E8", color:"#E05A5A", border:"none", borderRadius:99, padding:"15px 0", fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span className="material-symbols-outlined" style={{ fontSize:18 }}>close</span> Cancel
            </button>
            <button onClick={() => { markAllPaid(person.id); setPaidSheet(false); }} style={{ flex:1, background:"#C6F0D8", color:"#3A9E6E", border:"none", borderRadius:99, padding:"15px 0", fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span className="material-symbols-outlined" style={{ fontSize:18 }}>check</span> Confirm
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

// ── KEYPAD ────────────────────────────────────────────────────
const Keypad = ({ value, onChange }) => {
  const press = (k) => {
    if (k==="del") { onChange(value.slice(0,-1)||"0"); return; }
    const next = value==="0" ? k : value+k;
    if (next.length<=7) onChange(next);
  };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
      {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i) => (
        <button key={i} onClick={() => k && press(k)} style={{ background:"none", border:"none", fontSize:28, fontWeight:700, padding:"17px 0", cursor:k?"pointer":"default", color:k?"#111":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {k==="del"
            ? <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="#111" strokeWidth="1.8"><path d="M10 1H26C27.1 1 28 1.9 28 3V19C28 20.1 27.1 21 26 21H10L1 11L10 1Z"/><path d="M18 8L14 12M14 8L18 12" strokeLinecap="round"/></svg>
            : k}
        </button>
      ))}
    </div>
  );
};

// ── ADD / EDIT SCREEN ─────────────────────────────────────────
const AddScreen = ({ person, transaction, onBack, onDone }) => {
  const { addTransaction, updateTransaction } = useApp();
  const isEdit = !!transaction;
  const [dir,    setDir]    = useState(transaction?.direction || "gave");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "0");
  const [desc,   setDesc]   = useState(transaction?.description || "");
  const display = () => { const n=parseInt(amount||"0"); return n===0?"R0":`R${n.toLocaleString("en-ZA")}`; };
  const done = () => {
    const amt = parseInt(amount||"0");
    if (!amt) return;
    if (isEdit) updateTransaction({ ...transaction, direction:dir, amount:amt, description:desc });
    else        addTransaction({ personId:person.id, direction:dir, amount:amt, description:desc });
    onDone();
  };
  return (
    <div style={{ height:"100%", background:"#fff", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"env(safe-area-inset-top, 20px) 24px 0", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:0, lineHeight:1, display:"flex", alignItems:"center" }}>
          <span className="material-symbols-outlined" style={{ fontSize:28, color:"#111", fontVariationSettings:"'FILL' 0, 'wght' 300, 'opsz' 24" }}>chevron_left</span>
        </button>
      </div>
      <div style={{ display:"flex", justifyContent:"center", marginTop:18 }}>
        <div style={{ display:"flex", background:"#F4F2FA", borderRadius:99, padding:4, border:"1px solid #E4DCF5" }}>
          {["gave","got"].map(o => (
            <button key={o} onClick={() => setDir(o)} style={{ background:dir===o?"#fff":"none", border:dir===o?"1.5px solid #C0ADE8":"1.5px solid transparent", borderRadius:99, padding:"10px 30px", fontSize:15, fontWeight:dir===o?700:400, color:dir===o?"#111":"#ABABAB", cursor:"pointer" }}>
              {o==="gave" ? "I gave" : "I got"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ textAlign:"center", marginTop:30 }}>
        <div style={{ fontSize:52, fontWeight:400, color:"#111", letterSpacing:-1 }}>{display()}</div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginTop:10, gap:8 }}>
          <Avatar person={person} size={40} />
          <div style={{ background:"#F4F2FA", borderRadius:99, padding:"5px 16px", fontSize:13, fontWeight:600, color:"#7C5CBF" }}>
            {dir==="gave" ? "To" : "From"} {person.name}
          </div>
        </div>
      </div>
      <div style={{ margin:"26px 28px 0" }}>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" style={{ width:"100%", border:"none", borderBottom:"1px solid #E8E8E8", padding:"8px 0", fontSize:16, color:"#111", background:"none", outline:"none", textAlign:"center", fontWeight:desc?600:400 }} />
      </div>
      <div style={{ marginTop:10, padding:"0 6px", flex:1 }}>
        <Keypad value={amount} onChange={setAmount} />
      </div>
      <div style={{ padding:"8px 28px 36px", display:"flex", justifyContent:"center" }}>
        <button onClick={done} style={{ background:"#E8E0F7", border:"none", borderRadius:99, padding:"17px 48px", fontSize:17, fontWeight:700, color:"#7C5CBF", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          <span className="material-symbols-outlined" style={{ fontSize:20, fontVariationSettings:"'FILL' 0, 'wght' 400" }}>check</span>
          {isEdit ? "Update" : "Done"}
        </button>
      </div>
    </div>
  );
};

// ── TX DETAIL SHEET ───────────────────────────────────────────
const TxSheet = ({ tx, open, onClose, onEdit }) => {
  const { markPaid, deleteTransaction, incrementReminder, showToast } = useApp();
  if (!tx) return null;
  const neg = tx.direction==="gave";
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ paddingTop:36 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:300, color:"#BABABA", marginBottom:6, letterSpacing:0.2 }}>Amount</div>
          <div style={{ fontSize:42, fontWeight:500, color:neg?"#6B2D6B":"#3A9E6E", letterSpacing:-0.5 }}>
            {neg ? `-R${fmt(tx.amount)}` : `R${fmt(tx.amount)}`}
          </div>
        </div>
        {[{ l:"Description", v:tx.description }, { l:"Date & Time", v:formatDate(tx.datetime) }, { l:"Logged by", v:tx.loggedByName||"You" }].map(({ l, v }) => (
          <div key={l} style={{ textAlign:"center", marginBottom:26 }}>
            <div style={{ fontSize:13, fontWeight:300, color:"#BABABA", marginBottom:5, letterSpacing:0.2 }}>{l}</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", letterSpacing:0.1 }}>{v}</div>
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:36, paddingBottom:8 }}>
          <button onClick={() => { deleteTransaction(tx.id); onClose(); showToast("Deleted"); }} style={{ width:54, height:54, borderRadius:"50%", background:"#EEE8F7", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span className="material-symbols-outlined" style={{ fontSize:22, color:"#7C5CBF", fontVariationSettings:"'FILL' 0, 'wght' 300" }}>delete</span>
          </button>
          <button onClick={() => { onClose(); onEdit(tx); }} style={{ width:54, height:54, borderRadius:"50%", background:"#EEE8F7", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span className="material-symbols-outlined" style={{ fontSize:22, color:"#7C5CBF", fontVariationSettings:"'FILL' 0, 'wght' 300" }}>edit</span>
          </button>
          <button onClick={() => {
            const amt = `R${fmt(tx.amount)}`;
            const text = `Hi! Just a friendly reminder about ${amt} for "${tx.description}" logged on ${formatDate(tx.datetime)}.\n\nTracked via Tally 🐧`;
            if (navigator.share) { navigator.share({ title:`Tally reminder — ${amt}`, text }); }
            else { navigator.clipboard?.writeText(text).then(() => showToast("Copied to clipboard!")); }
            incrementReminder(tx.id);
          }} style={{ flex:1, background:"#FDEBC8", border:"none", borderRadius:99, padding:"14px 0", fontSize:14, fontWeight:600, color:"#D4800A", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
            <span className="material-symbols-outlined" style={{ fontSize:20, color:"#D4800A", fontVariationSettings:"'FILL' 0, 'wght' 300" }}>notifications_active</span> Remind
          </button>
          <button onClick={() => { markPaid(tx.id); onClose(); showToast("Marked as paid!"); }} style={{ flex:1, background:"#C6F0D8", border:"none", borderRadius:99, padding:"14px 0", fontSize:14, fontWeight:600, color:"#3A9E6E", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
            <span className="material-symbols-outlined" style={{ fontSize:20, color:"#3A9E6E", fontVariationSettings:"'FILL' 0, 'wght' 400" }}>check</span> Paid
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

// ── TRANSACTIONS SCREEN (sticky header) ───────────────────────
const TxScreen = ({ onTxClick }) => {
  const { transactions, people } = useApp();
  const grouped = {};
  [...transactions].sort((a,b) => new Date(b.datetime)-new Date(a.datetime)).forEach(tx => {
    const k = formatMonthYear(tx.datetime);
    if (!grouped[k]) grouped[k]=[];
    grouped[k].push(tx);
  });
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#fff" }}>
      {/* Sticky heading */}
      <div style={{ flexShrink:0, background:"#fff", borderBottom:"1px solid #F5F5F5", padding:"env(safe-area-inset-top, 20px) 24px 16px" }}>
        <div style={{ fontWeight:500, fontSize:28, color:"#111" }}>Transactions</div>
      </div>
      {/* Scrollable list */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px 24px" }}>
        {Object.entries(grouped).map(([month, txs]) => (
          <div key={month} style={{ marginBottom:24 }}>
            <div style={{ fontWeight:500, fontSize:14.5, color:"#555", marginBottom:12 }}>{month}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {txs.map(tx => { const p=people.find(x=>x.id===tx.personId); return <TxRow key={tx.id} tx={tx} person={p} onClick={() => onTxClick(tx)} />; })}
            </div>
          </div>
        ))}
        {transactions.length===0 && <div style={{ textAlign:"center", color:"#BABABA", padding:"40px 0", fontSize:14 }}>No transactions yet</div>}
      </div>
    </div>
  );
};

// ── SHARED SUB-SCREEN HEADER ──────────────────────────────────
const SubHeader = ({ title, onBack }) => (
  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"env(safe-area-inset-top, 20px) 20px 18px", flexShrink:0 }}>
    <button onClick={onBack} style={{ background:"#F5F5F5", border:"none", cursor:"pointer", width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span className="material-symbols-outlined" style={{ fontSize:20, color:"#111" }}>chevron_left</span>
    </button>
    <span style={{ fontWeight:600, fontSize:20, color:"#111" }}>{title}</span>
  </div>
);

const ScrollScreen = ({ children }) => (
  <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#fff", overflowY:"auto" }}>
    {children}
  </div>
);

// ── NOTIFICATIONS SCREEN ──────────────────────────────────────
const NotificationsScreen = ({ onBack }) => {
  const [settings, setSettings] = useState({ reminders:true, payments:true, newPeople:false, weeklySummary:true, appUpdates:false });
  const toggle = (key) => setSettings(s => ({ ...s, [key]: !s[key] }));
  const Toggle = ({ k, label, sub }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", background:"#fff", borderRadius:99, border:"1px solid #E2E2E2", marginBottom:10 }}>
      <div>
        <div style={{ fontSize:15, fontWeight:500, color:"#111" }}>{label}</div>
        {sub && <div style={{ fontSize:12, fontWeight:300, color:"#BABABA", marginTop:2 }}>{sub}</div>}
      </div>
      <div onClick={() => toggle(k)} style={{ width:46, height:26, borderRadius:99, background:settings[k]?"#7C5CBF":"#E0E0E0", position:"relative", cursor:"pointer", transition:"background .25s", flexShrink:0, marginLeft:12 }}>
        <div style={{ position:"absolute", top:3, left:settings[k]?23:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .25s", boxShadow:"0 1px 4px rgba(0,0,0,.18)" }} />
      </div>
    </div>
  );
  return (
    <ScrollScreen>
      <SubHeader title="Notifications" onBack={onBack} />
      <div style={{ padding:"0 20px 24px" }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:10, textTransform:"uppercase", letterSpacing:.7 }}>Activity</div>
        <Toggle k="reminders"     label="Payment reminders"   sub="When you send a nudge to someone" />
        <Toggle k="payments"      label="Payment received"    sub="When someone marks a debt settled" />
        <Toggle k="newPeople"     label="New connections"     sub="When a contact joins Tally" />
        <div style={{ fontSize:12, fontWeight:600, color:"#888", margin:"20px 0 10px", textTransform:"uppercase", letterSpacing:.7 }}>General</div>
        <Toggle k="weeklySummary" label="Weekly summary"      sub="A recap of your outstanding balances" />
        <Toggle k="appUpdates"    label="App updates & news"  sub="New features and announcements" />
      </div>
    </ScrollScreen>
  );
};

// ── PRIVACY & SECURITY SCREEN ─────────────────────────────────
const PrivacySecurityScreen = ({ onBack }) => {
  const Row = ({ label, sub, onClick, danger }) => (
    <div onClick={onClick} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"#fff", borderRadius:16, border:"1px solid #E2E2E2", marginBottom:10, cursor:onClick?"pointer":"default" }}>
      <div>
        <div style={{ fontSize:15, fontWeight:500, color:danger?"#D0453A":"#111" }}>{label}</div>
        {sub && <div style={{ fontSize:12, fontWeight:300, color:"#BABABA", marginTop:2 }}>{sub}</div>}
      </div>
      {onClick && <span className="material-symbols-outlined" style={{ fontSize:20, color:"#BABABA", fontVariationSettings:"'FILL' 0, 'wght' 300, 'opsz' 20" }}>chevron_right</span>}
    </div>
  );
  return (
    <ScrollScreen>
      <SubHeader title="Privacy & Security" onBack={onBack} />
      <div style={{ padding:"0 20px 24px" }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:10, textTransform:"uppercase", letterSpacing:.7 }}>Privacy</div>
        <Row label="Privacy Policy"     sub="How we collect and use your data"   onClick={() => window.open("privacy.html","_blank")} />
        <Row label="Data & Permissions" sub="Manage what Tally can access"       onClick={() => {}} />
        <Row label="Download my data"   sub="Export a copy of your Tally data"   onClick={() => {}} />
        <div style={{ fontSize:12, fontWeight:600, color:"#888", margin:"18px 0 10px", textTransform:"uppercase", letterSpacing:.7 }}>Security</div>
        <Row label="Change password"                                              onClick={() => {}} />
        <Row label="Two-factor authentication" sub="Add an extra layer of security" onClick={() => {}} />
        <div style={{ fontSize:12, fontWeight:600, color:"#888", margin:"18px 0 10px", textTransform:"uppercase", letterSpacing:.7 }}>Danger zone</div>
        <Row label="Delete my account"  sub="Permanently remove all your data"  danger />
      </div>
    </ScrollScreen>
  );
};

// ── HELP CENTRE SCREEN ────────────────────────────────────────
const HelpCentreScreen = ({ onBack }) => {
  const [open, setOpen] = useState(null);
  const faqs = [
    { q:"How do I add someone?",               a:"Tap the + icon on the home screen. You can search for existing Tally users or add anyone manually with just their name." },
    { q:"Does the other person need Tally?",   a:"No! You can add anyone manually. If they join Tally later, you can link up and your history will sync automatically." },
    { q:"How do I log a transaction?",         a:"Open a person's profile and tap 'Add new'. Enter a description, amount, and whether you gave or received the money." },
    { q:"How do I mark something as settled?", a:"Open the transaction and tap 'Mark as settled', or on the person screen tap 'All paid' to settle the entire balance." },
    { q:"How do reminders work?",              a:"On a person's screen tap 'Remind'. Tally opens your share sheet so you can send them a message directly." },
    { q:"Can I edit or delete a transaction?", a:"Yes — open the transaction from any screen and tap the edit icon. You can update any field or delete it entirely." },
    { q:"Is my data secure?",                  a:"Yes. Tally uses Google Firebase with enterprise-grade encryption at rest and in transit. We never sell your data." },
  ];
  return (
    <ScrollScreen>
      <SubHeader title="Help Centre" onBack={onBack} />
      <div style={{ padding:"0 20px 24px" }}>
        <div style={{ background:"#F8F7FF", borderRadius:16, padding:"16px 18px", marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#7C5CBF", marginBottom:4 }}>Need more help?</div>
          <div style={{ fontSize:13, fontWeight:300, color:"#666", lineHeight:1.6 }}>Can't find what you're looking for? Our support team usually responds within a few hours.</div>
          <div onClick={() => window.open("contact.html","_blank")} style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:6, background:"#7C5CBF", color:"#fff", borderRadius:99, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            <span className="material-symbols-outlined" style={{ fontSize:16 }}>mail</span>
            Contact support
          </div>
        </div>
        <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:12, textTransform:"uppercase", letterSpacing:.7 }}>Frequently asked questions</div>
        {faqs.map((f, i) => (
          <div key={i} onClick={() => setOpen(open===i?null:i)} style={{ background:"#fff", border:"1px solid #E2E2E2", borderRadius:16, padding:"14px 18px", marginBottom:10, cursor:"pointer" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:15, fontWeight:500, color:"#111", flex:1, paddingRight:10 }}>{f.q}</span>
              <span className="material-symbols-outlined" style={{ fontSize:18, color:"#BABABA", transition:"transform .2s", transform:open===i?"rotate(180deg)":"rotate(0)" }}>keyboard_arrow_down</span>
            </div>
            {open===i && <div style={{ fontSize:14, fontWeight:300, color:"#666", lineHeight:1.7, marginTop:10 }}>{f.a}</div>}
          </div>
        ))}
      </div>
    </ScrollScreen>
  );
};

// ── TERMS SCREEN ──────────────────────────────────────────────
const TermsScreen = ({ onBack }) => {
  const sections = [
    { h:"1. Acceptance of Terms",    p:"By using Tally you agree to be bound by these Terms. If you do not agree, please do not use the app." },
    { h:"2. Description of Service", p:"Tally is a personal finance tracking app. It records money between people. Tally does not process, hold, or transfer actual funds." },
    { h:"3. User Accounts",          p:"You are responsible for maintaining your account credentials and for all activity under your account." },
    { h:"4. Acceptable Use",         p:"Do not use Tally to harass others, violate laws, attempt unauthorised access, or conduct fraud." },
    { h:"5. Intellectual Property",  p:"All content and features of Tally are owned by Tally and protected by applicable intellectual property laws." },
    { h:"6. Limitation of Liability",p:"Tally is provided 'as is'. To the fullest extent permitted by law we are not liable for indirect or consequential damages." },
    { h:"7. Governing Law",          p:"These Terms are governed by the laws of the Republic of South Africa." },
    { h:"8. Questions?",             p:"", link:true },
  ];
  return (
    <ScrollScreen>
      <SubHeader title="Terms of Service" onBack={onBack} />
      <div style={{ padding:"0 20px 24px" }}>
        <div style={{ fontSize:12, fontWeight:300, color:"#BABABA", marginBottom:18 }}>Last updated: 19 February 2026</div>
        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom:18 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#111", marginBottom:5 }}>{s.h}</div>
            {s.link
              ? <div style={{ fontSize:13, fontWeight:300, color:"#666", lineHeight:1.7 }}>Questions? <span onClick={() => window.open("contact.html","_blank")} style={{ color:"#7C5CBF", fontWeight:500, cursor:"pointer" }}>Contact us</span>.</div>
              : <div style={{ fontSize:13, fontWeight:300, color:"#666", lineHeight:1.7 }}>{s.p}</div>}
          </div>
        ))}
        <div onClick={() => window.open("terms.html","_blank")} style={{ display:"inline-flex", alignItems:"center", gap:6, color:"#7C5CBF", fontSize:13, fontWeight:600, cursor:"pointer", marginTop:4 }}>
          <span className="material-symbols-outlined" style={{ fontSize:16 }}>open_in_new</span>
          View full Terms on web
        </div>
      </div>
    </ScrollScreen>
  );
};

// ── ACCOUNT / PROFILE SCREEN (sticky header) ──────────────────
const AccountScreen = ({ onNavigate, authUser, onSignOut }) => {
  const name   = authUser?.displayName || "Guest";
  const email  = authUser?.email || "";
  const photo  = authUser?.photoURL;
  const initials = getInitials(name);

  const SettingRow = ({ label, sub, onClick }) => (
    <div onClick={onClick} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #E2E2E2", borderRadius:99, padding:"16px 18px", background:"#fff", cursor:"pointer", marginBottom:10 }}>
      <div>
        <div style={{ fontSize:15, color:"#111", fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:12, fontWeight:300, color:"#BABABA", marginTop:1 }}>{sub}</div>}
      </div>
      <span className="material-symbols-outlined" style={{ fontSize:20, color:"#BABABA", fontVariationSettings:"'FILL' 0, 'wght' 300, 'opsz' 20" }}>chevron_right</span>
    </div>
  );

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"#fff" }}>
      {/* Sticky heading */}
      <div style={{ flexShrink:0, background:"#fff", borderBottom:"1px solid #F5F5F5", padding:"env(safe-area-inset-top, 20px) 24px 16px" }}>
        <div style={{ fontWeight:500, fontSize:28, color:"#111" }}>Profile</div>
      </div>
      {/* Scrollable content */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 0 24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"0 24px 22px" }}>
          {photo
            ? <img src={photo} style={{ width:56, height:56, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
            : <Avatar person={{ name, initials }} size={56} />}
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:"#111" }}>{name}</div>
            <div style={{ fontSize:13, color:"#BABABA", marginTop:2 }}>{email}</div>
          </div>
        </div>
        <div style={{ padding:"0 20px", marginBottom:20 }}>
          <div style={{ fontWeight:500, fontSize:14.5, color:"#111", marginBottom:10 }}>Account</div>
          <SettingRow label="Notifications"      sub="Reminders, activity & updates"  onClick={() => onNavigate("notifications")} />
          <SettingRow label="Privacy & Security" sub="Data, permissions & security"    onClick={() => onNavigate("privacy-security")} />
        </div>
        <div style={{ padding:"0 20px", marginBottom:20 }}>
          <div style={{ fontWeight:500, fontSize:14.5, color:"#111", marginBottom:10 }}>Support</div>
          <SettingRow label="Help Centre"        sub="FAQs and contact support"        onClick={() => onNavigate("help-centre")} />
          <SettingRow label="Terms of Service"   sub="Our terms and conditions"        onClick={() => onNavigate("terms")} />
        </div>
        <div style={{ padding:"0 20px" }}>
          <div onClick={onSignOut} style={{ border:"1px solid #E2E2E2", borderRadius:99, padding:"16px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", cursor:"pointer" }}>
            <span style={{ fontSize:15, color:"#7C5CBF", fontWeight:700 }}>Log Out</span>
            <span className="material-symbols-outlined" style={{ fontSize:20, color:"#BABABA", fontVariationSettings:"'FILL' 0, 'wght' 300, 'opsz' 20" }}>chevron_right</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── ADD PERSON SCREEN ─────────────────────────────────────────
const TALLY_USERS = [
  { id:"tu1", name:"Aisha",   fullName:"Aisha Patel",    initials:"AP", phone:"+27 82 111 2233" },
  { id:"tu2", name:"Bongani", fullName:"Bongani Zulu",   initials:"BZ", phone:"+27 73 456 7890" },
  { id:"tu3", name:"Fatima",  fullName:"Fatima Mokoena", initials:"FM", phone:"+27 83 987 6543" },
  { id:"tu4", name:"Kwame",   fullName:"Kwame Sithole",  initials:"KS", phone:"+27 63 210 9876" },
  { id:"tu5", name:"Priya",   fullName:"Priya Naidoo",   initials:"PN", phone:"+27 72 765 4321" },
  { id:"tu6", name:"Thabo",   fullName:"Thabo Molefe",   initials:"TM", phone:"+27 62 321 0987" },
  { id:"tu7", name:"Zanele",  fullName:"Zanele Ntuli",   initials:"ZN", phone:"+27 64 765 4321" },
];

const AddPersonScreen = ({ onBack, onAdd }) => {
  const { people } = useApp();
  const [query,       setQuery]       = useState("");
  const [searched,    setSearched]    = useState(false);
  const [manualName,  setManualName]  = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const existingIds = new Set(people.map(p => p.fullName));
  const trimmed = query.trim();
  const results = trimmed.length >= 2
    ? TALLY_USERS.filter(u => u.fullName.toLowerCase().includes(trimmed.toLowerCase()) || u.phone.replace(/\s/g,"").includes(trimmed.replace(/\s/g,"")))
    : [];
  const handleSearch   = () => { if (trimmed.length >= 2) setSearched(true); };
  const handleKey      = (e) => { if (e.key==="Enter") handleSearch(); };
  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    const words = manualName.trim().split(" ");
    onAdd({ name:words[0], initials:(words[0][0]+(words[1]?words[1][0]:"")).toUpperCase(), phone:manualPhone.trim()||null });
  };
  return (
    <div style={{ height:"100%", background:"#fff", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"env(safe-area-inset-top, 20px) 24px 0", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
          <span className="material-symbols-outlined" style={{ fontSize:28, color:"#111", fontVariationSettings:"'FILL' 0, 'wght' 300, 'opsz' 24" }}>chevron_left</span>
        </button>
        <div style={{ fontWeight:600, fontSize:24, color:"#111", marginTop:16 }}>Add Person</div>
        <div style={{ fontSize:14, fontWeight:300, color:"#BABABA", marginTop:4 }}>Search for a Tally user or add manually</div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"24px 24px 24px" }}>
        {/* Search */}
        <div style={{ position:"relative", marginBottom:16 }}>
          <span className="material-symbols-outlined" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:20, color:"#BABABA", fontVariationSettings:"'FILL' 0" }}>search</span>
          <input value={query} onChange={e=>{setQuery(e.target.value);setSearched(false);}} onKeyDown={handleKey}
            placeholder="Search name or phone number"
            style={{ width:"100%", background:"#F5F5F5", border:"none", borderRadius:99, padding:"14px 16px 14px 44px", fontSize:14, color:"#111", outline:"none", boxSizing:"border-box" }} />
        </div>
        {searched && results.length>0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:10, textTransform:"uppercase", letterSpacing:.7 }}>On Tally</div>
            {results.map(u => (
              <div key={u.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"#fff", border:"1px solid #E2E2E2", borderRadius:99, marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <Avatar person={u} size={44} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:15, color:"#111" }}>{u.fullName}</div>
                    <div style={{ fontSize:12, color:"#BABABA" }}>{u.phone}</div>
                  </div>
                </div>
                {existingIds.has(u.fullName)
                  ? <span style={{ fontSize:12, color:"#BABABA", fontWeight:500 }}>Added</span>
                  : <button onClick={() => onAdd(u)} style={{ background:"#E8E0F7", border:"none", borderRadius:99, padding:"8px 16px", fontSize:13, fontWeight:600, color:"#7C5CBF", cursor:"pointer" }}>Add</button>}
              </div>
            ))}
          </div>
        )}
        {searched && results.length===0 && trimmed.length>=2 && (
          <div style={{ textAlign:"center", color:"#BABABA", fontSize:14, padding:"12px 0 24px" }}>No Tally users found — add manually below</div>
        )}
        {/* Manual add */}
        <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:12, textTransform:"uppercase", letterSpacing:.7 }}>Add manually</div>
        <div style={{ position:"relative", marginBottom:12 }}>
          <span className="material-symbols-outlined" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:20, color:"#BABABA", fontVariationSettings:"'FILL' 0" }}>person</span>
          <input value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="Full name"
            style={{ width:"100%", background:"#F5F5F5", border:"none", borderRadius:99, padding:"14px 16px 14px 44px", fontSize:14, color:"#111", outline:"none", boxSizing:"border-box" }} />
        </div>
        <div style={{ position:"relative", marginBottom:20 }}>
          <span className="material-symbols-outlined" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:20, color:"#BABABA", fontVariationSettings:"'FILL' 0" }}>phone</span>
          <input value={manualPhone} onChange={e=>setManualPhone(e.target.value)} placeholder="Phone number (optional)"
            style={{ width:"100%", background:"#F5F5F5", border:"none", borderRadius:99, padding:"14px 16px 14px 44px", fontSize:14, color:"#111", outline:"none", boxSizing:"border-box" }} />
        </div>
        <button onClick={handleManualAdd} disabled={!manualName.trim()}
          style={{ width:"100%", background:manualName.trim()?"#E8E0F7":"#F5F5F5", border:"none", borderRadius:99, padding:"16px 0", fontSize:15, fontWeight:600, color:manualName.trim()?"#7C5CBF":"#BABABA", cursor:manualName.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 150ms" }}>
          <span className="material-symbols-outlined" style={{ fontSize:18, fontVariationSettings:"'FILL' 0" }}>person_add</span>
          Add {manualName.trim() ? manualName.trim().split(" ")[0] : "person"}
        </button>
      </div>
    </div>
  );
};

// ── EDIT PERSON SCREEN ────────────────────────────────────────
const EditPersonScreen = ({ person, onBack, onSave }) => {
  const [fullName, setFullName] = useState(person.fullName || "");
  const [phone,    setPhone]    = useState(person.phone    || "");

  const handleSave = () => {
    if (!fullName.trim()) return;
    const words    = fullName.trim().split(" ");
    const initials = (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
    onSave({ ...person, fullName:fullName.trim(), name:words[0], initials, phone:phone.trim()||null });
  };

  return (
    <div style={{ height:"100%", background:"#fff", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"env(safe-area-inset-top, 20px) 20px 0", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex", alignItems:"center" }}>
          <span className="material-symbols-outlined" style={{ fontSize:28, color:"#111", fontVariationSettings:"'FILL' 0, 'wght' 300, 'opsz' 24" }}>chevron_left</span>
        </button>
        <div style={{ fontSize:17, fontWeight:600, color:"#111" }}>Edit Person</div>
        <div style={{ width:36 }} />
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"28px 24px 40px" }}>
        {/* Avatar preview */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }}>
          <Avatar person={{ fullName:fullName||person.fullName, name:fullName.split(" ")[0]||person.name, initials:(fullName.split(" ")[0]?.[0]||"")+(fullName.split(" ")[1]?.[0]||"") || person.initials }} size={80} />
        </div>

        {/* Fields */}
        <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:10, textTransform:"uppercase", letterSpacing:.7 }}>Details</div>

        <div style={{ position:"relative", marginBottom:12 }}>
          <span className="material-symbols-outlined" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:20, color:"#BABABA" }}>person</span>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Full name"
            style={{ width:"100%", background:"#F5F5F5", border:"none", borderRadius:99, padding:"14px 16px 14px 44px", fontSize:14, color:"#111", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        <div style={{ position:"relative", marginBottom:32 }}>
          <span className="material-symbols-outlined" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:20, color:"#BABABA" }}>phone</span>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone number (optional)"
            type="tel"
            style={{ width:"100%", background:"#F5F5F5", border:"none", borderRadius:99, padding:"14px 16px 14px 44px", fontSize:14, color:"#111", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!fullName.trim()}
          style={{ width:"100%", background:fullName.trim()?"#E8E0F7":"#F5F5F5", border:"none", borderRadius:99, padding:"16px 0", fontSize:15, fontWeight:600, color:fullName.trim()?"#7C5CBF":"#BABABA", cursor:fullName.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 150ms" }}>
          <span className="material-symbols-outlined" style={{ fontSize:18 }}>check</span>
          Save changes
        </button>
      </div>
    </div>
  );
};

// ── LOGIN SCREEN ──────────────────────────────────────────────
const LoginScreen = ({ onGoogleSignIn, loading, error }) => (
  <div style={{ minHeight:"100vh", maxWidth:480, margin:"0 auto", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px 36px" }}>
    <TallyLogo />
    <div style={{ marginTop:32, marginBottom:12, fontSize:26, fontWeight:600, color:"#111", letterSpacing:-0.5, textAlign:"center" }}>Welcome to Tally</div>
    <div style={{ fontSize:15, fontWeight:300, color:"#888", textAlign:"center", lineHeight:1.6, marginBottom:48, maxWidth:280 }}>
      Track money between friends, simply and honestly.
    </div>
    <button onClick={onGoogleSignIn} disabled={loading}
      style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:14, background:"#fff", border:"1.5px solid #E2E2E2", borderRadius:99, padding:"18px 24px", fontSize:16, fontWeight:600, color:"#111", cursor:loading?"default":"pointer", transition:"all .15s", boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
      {loading ? (
        <div style={{ width:22, height:22, border:"2px solid #E2E2E2", borderTop:"2px solid #7C5CBF", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      )}
      {loading ? "Signing in…" : "Continue with Google"}
    </button>
    {error && <div style={{ marginTop:16, fontSize:13, color:"#E05A5A", textAlign:"center", fontWeight:500 }}>{error}</div>}
    <div style={{ marginTop:32, fontSize:12, fontWeight:300, color:"#BABABA", textAlign:"center", lineHeight:1.6 }}>
      By continuing you agree to our{" "}
      <span onClick={() => window.open("terms.html","_blank")} style={{ color:"#7C5CBF", cursor:"pointer" }}>Terms</span>
      {" "}and{" "}
      <span onClick={() => window.open("privacy.html","_blank")} style={{ color:"#7C5CBF", cursor:"pointer" }}>Privacy Policy</span>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── LOADING SCREEN ────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{ minHeight:"100vh", maxWidth:480, margin:"0 auto", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
    <TallyLogo />
    <div style={{ marginTop:24, width:32, height:32, border:"2.5px solid #E2E2E2", borderTop:"2.5px solid #7C5CBF", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── ROOT APP ──────────────────────────────────────────────────
export default function App() {
  const [authUser,    setAuthUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError,   setAuthError]   = useState("");
  const [signInLoading, setSignInLoading] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [people,       setPeople]       = useState([]);

  const [tab,       setTab]       = useState("home");
  const [screen,    setScreen]    = useState("home");
  const [selPerson, setSelPerson] = useState(null);
  const [selTx,     setSelTx]     = useState(null);
  const [editTx,    setEditTx]    = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast,     setToast]     = useState({ v:false, m:"" });
  const [success,   setSuccess]   = useState({ v:false, icon:"check_circle", title:"", subtitle:"" });
  const timer = useRef(null);

  const showSuccess = (title, subtitle="", icon="check_circle") => {
    setSuccess({ v:true, icon, title, subtitle });
  };

  // ── Auth listener ──────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
  }, []);

  // ── Firestore listeners (scoped to user) ──────────────────
  useEffect(() => {
    if (!authUser) { setPeople([]); setTransactions([]); return; }
    const uid = authUser.uid;
    const unsubP = onSnapshot(peopleCol(uid), snap =>
      setPeople(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    const unsubT = onSnapshot(txCol(uid), snap =>
      setTransactions(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    return () => { unsubP(); unsubT(); };
  }, [authUser]);

  const showToast = (m) => { clearTimeout(timer.current); setToast({ v:true, m }); timer.current=setTimeout(()=>setToast(t=>({...t,v:false})),2200); };

  // ── CRUD → Firestore ──────────────────────────────────────
  const addTransaction = async (data) => {
    if (!authUser) return;
    await addDoc(txCol(authUser.uid), {
      ...data,
      datetime:       new Date().toISOString(),
      status:         "unpaid",
      loggedByUserId: authUser.uid,
      loggedByName:   authUser.displayName || "You",
      reminderCount:  0,
      currency:       "ZAR",
    });
    showSuccess("Transaction saved!", `R${fmt(data.amount)} logged`, "check_circle");
  };

  const updateTransaction = async (updated) => {
    if (!authUser) return;
    const { id, ...data } = updated;
    await updateDoc(txDoc(authUser.uid, id), data);
    showSuccess("Transaction updated!", "", "edit");
  };

  const markPaid = async (id) => {
    if (!authUser) return;
    await updateDoc(txDoc(authUser.uid, id), { status:"paid" });
    showSuccess("Marked as settled!", "Great, that's sorted.", "check_circle");
  };

  const markAllPaid = async (personId) => {
    if (!authUser) return;
    const unpaid = transactions.filter(t => t.personId===personId && t.status==="unpaid");
    await Promise.all(unpaid.map(t => updateDoc(txDoc(authUser.uid, t.id), { status:"paid" })));
    showSuccess("All settled!", `${unpaid.length} transaction${unpaid.length!==1?"s":""} marked as paid`, "check_circle");
  };

  const deleteTransaction = async (id) => {
    if (!authUser) return;
    await deleteDoc(txDoc(authUser.uid, id));
    showSuccess("Deleted", "", "delete");
  };

  const incrementReminder = async (id) => {
    if (!authUser) return;
    const tx = transactions.find(t => t.id===id);
    if (tx) await updateDoc(txDoc(authUser.uid, id), { reminderCount:(tx.reminderCount||0)+1 });
  };

  const addPerson = async (contact) => {
    if (!authUser) return;
    const words = contact.name.split(" ");
    const initials = (words[0][0]+(words[1]?words[1][0]:"")).toUpperCase();
    await addDoc(peopleCol(authUser.uid), {
      name:     words[0],
      fullName: contact.name,
      initials: contact.initials || initials,
      isLinked: false,
      phone:    contact.phone || null,
    });
    setScreen("home");
    showSuccess(`${words[0]} added!`, "They're now in your people", "person_add");
  };

  const updatePerson = async (updated) => {
    if (!authUser) return;
    const { id, ...data } = updated;
    await updateDoc(personDoc(authUser.uid, id), data);
    setSelPerson(updated);
    setScreen("person");
    showSuccess("Profile updated!", "", "edit");
  };

  // ── Sign in / out ─────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setSignInLoading(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setAuthError(e.code==="auth/popup-blocked"
        ? "Popup was blocked — please allow popups for this page and try again."
        : "Sign-in failed. Please try again.");
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setTab("home");
    setScreen("home");
    showToast("Signed out");
  };

  const nav    = (t) => { setTab(t); setScreen(t==="home"?"home":t); };
  const goBack = () => {
    if (screen==="add")              setScreen(selPerson?"person":"home");
    else if (screen==="person")      { setScreen("home"); setTab("home"); }
    else if (screen==="addperson")   setScreen("home");
    else if (screen==="editperson")  setScreen("person");
    else if (["notifications","privacy-security","help-centre","terms"].includes(screen)) setScreen("account");
  };

  const ctx = { transactions, people, authUser, addTransaction, updateTransaction, markPaid, markAllPaid, deleteTransaction, incrementReminder, showToast, showSuccess };

  // ── Render states ─────────────────────────────────────────
  if (authLoading) return <LoadingScreen />;
  if (!authUser)   return <LoginScreen onGoogleSignIn={handleGoogleSignIn} loading={signInLoading} error={authError} />;

  return (
    <AppContext.Provider value={ctx}>
      <div style={{ minHeight:"100vh", maxWidth:480, margin:"0 auto", background:"#fff", display:"flex", flexDirection:"column", position:"relative" }}>

        {/* Screen content */}
        <div style={{ flex:1, overflow:"hidden", minHeight:0 }}>
          {screen==="home"             && <HomeScreen onPersonClick={p=>{setSelPerson(p);setScreen("person");}} onTxClick={tx=>{setSelTx(tx);setSheetOpen(true);}} onAddPerson={()=>setScreen("addperson")} />}
          {screen==="person"           && selPerson && <PersonScreen person={selPerson} onBack={goBack} onTxClick={tx=>{setSelTx(tx);setSheetOpen(true);}} onAddNew={p=>{setSelPerson(p);setEditTx(null);setScreen("add");}} onEditPerson={p=>{setSelPerson(p);setScreen("editperson");}} />}
          {screen==="add"              && selPerson && <AddScreen person={selPerson} transaction={editTx} onBack={goBack} onDone={()=>{setScreen(selPerson?"person":"home");showToast("Transaction saved!");}} />}
          {screen==="editperson"       && selPerson && <EditPersonScreen person={selPerson} onBack={goBack} onSave={updatePerson} />}
          {screen==="addperson"        && <AddPersonScreen onBack={goBack} onAdd={addPerson} />}
          {screen==="transactions"     && <TxScreen onTxClick={tx=>{setSelTx(tx);setSheetOpen(true);}} />}
          {screen==="account"          && <AccountScreen onNavigate={setScreen} authUser={authUser} onSignOut={handleSignOut} />}
          {screen==="notifications"    && <NotificationsScreen    onBack={goBack} />}
          {screen==="privacy-security" && <PrivacySecurityScreen  onBack={goBack} />}
          {screen==="help-centre"      && <HelpCentreScreen       onBack={goBack} />}
          {screen==="terms"            && <TermsScreen             onBack={goBack} />}
        </div>

        {/* Bottom nav */}
        <div style={{ flexShrink:0, visibility:["add","addperson","editperson","notifications","privacy-security","help-centre","terms"].includes(screen)?"hidden":"visible" }}>
          <BottomNav active={tab} onNavigate={nav} />
        </div>

        <TxSheet tx={selTx} open={sheetOpen} onClose={()=>setSheetOpen(false)} onEdit={tx=>{const p=people.find(x=>x.id===tx.personId);setSelPerson(p);setEditTx(tx);setScreen("add");}} />
        <Toast message={toast.m} visible={toast.v} />
        <SuccessOverlay visible={success.v} icon={success.icon} title={success.title} subtitle={success.subtitle} onDone={()=>setSuccess(s=>({...s,v:false}))} />
      </div>
    </AppContext.Provider>
  );
}
