import { useState, useEffect, useRef, createContext, useContext } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, getDoc, getDocs, writeBatch, orderBy, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── FIREBASE ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCNSwL3fbRzOHe4DpaHvMJ--8gz46VYpm0",
  authDomain: "tally-app-fac0e.firebaseapp.com",
  projectId: "tally-app-fac0e",
  storageBucket: "tally-app-fac0e.firebasestorage.app",
  messagingSenderId: "260823272960",
  appId: "1:260823272960:web:a1c1364b412bb1010a92e5"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const googleProvider = new GoogleAuthProvider();

const peopleCol = (uid) => collection(db, "users", uid, "people");
const txCol = (uid) => collection(db, "users", uid, "transactions");
const txDoc = (uid, id) => doc(db, "users", uid, "transactions", id);
const personDoc = (uid, id) => doc(db, "users", uid, "people", id);
const globalUserDoc = (id) => doc(db, "users", id);
const globalUsersCol = collection(db, "users");

// ── STYLES ────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  * { font-family: 'Albert Sans', sans-serif; box-sizing: border-box; }
`;
document.head.appendChild(style);

// ── HELPERS ───────────────────────────────────────────────────
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n) => Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (iso) => {
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${d.getDate()}, ${months[d.getMonth()]}, ${d.getFullYear()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const formatMonthYear = (iso) => {
  const d = new Date(iso);
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()] + " " + d.getFullYear();
};
const getPersonStats = (personId, txs) => {
  const list = txs.filter(t => t.personId === personId && t.status === "unpaid");
  const sent = list.filter(t => t.direction === "gave").reduce((s, t) => s + t.amount, 0);
  const received = list.filter(t => t.direction === "got").reduce((s, t) => s + t.amount, 0);
  return { sent, received, balance: sent - received };
};
const getTotalBalance = (txs) => {
  const u = txs.filter(t => t.status === "unpaid");
  return u.filter(t => t.direction === "gave").reduce((s, t) => s + t.amount, 0)
    - u.filter(t => t.direction === "got").reduce((s, t) => s + t.amount, 0);
};
const getInitials = (name = "") => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);


// ── AVATAR ────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: "#D0BCFF", fg: "#21005D" }, { bg: "#B5EAD7", fg: "#0D3B2E" },
  { bg: "#FFD6BA", fg: "#4A1B00" }, { bg: "#FFDDE1", fg: "#4A0010" },
  { bg: "#BDE3FF", fg: "#001E31" }, { bg: "#D4F0E4", fg: "#003824" },
  { bg: "#E8D5F5", fg: "#2D0057" },
];
const Avatar = ({ person, size = 44, showPaidBadge = false }) => {
  if (person?.photoUrl) {
    return (
      <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
        <img src={person.photoUrl} alt="Avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
        {showPaidBadge && (
          <div style={{ position: "absolute", bottom: -2, right: -2, width: Math.round(size * 0.38), height: Math.round(size * 0.38), borderRadius: "50%", background: "#3A9E6E", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: Math.round(size * 0.22), color: "#fff", fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
          </div>
        )}
      </div>
    );
  }

  const str = person?.fullName || person?.name || "?";
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
  const idx = hash % AVATAR_COLORS.length;
  const { bg, fg } = AVATAR_COLORS[idx];
  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.36), fontWeight: 700, letterSpacing: "0.5px", userSelect: "none" }}>
        {person?.initials || getInitials(person?.fullName || person?.name || "?")}
      </div>
      {showPaidBadge && (
        <div style={{ position: "absolute", bottom: -2, right: -2, width: Math.round(size * 0.38), height: Math.round(size * 0.38), borderRadius: "50%", background: "#3A9E6E", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: Math.round(size * 0.22), color: "#fff", fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
        </div>
      )}
    </div>
  );
};

// ── TALLY LOGO ────────────────────────────────────────────────
const TallyLogo = () => (
  <img src="/Images/Logo.svg" alt="Tally Logo" style={{ height: 38 }} />
);

// ── SUCCESS OVERLAY ────────────────────────────────────────────
const SuccessOverlay = ({ visible, icon = "check_circle", title, subtitle, onDone, color = "#3A9E6E", bg = "#E8F7EE" }) => {
  useEffect(() => {
    if (visible) { const t = setTimeout(onDone, 1800); return () => clearTimeout(t); }
  }, [visible]);
  if (!visible) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(255,255,255,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.22s ease" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, color: color, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#111", letterSpacing: -0.3 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 14, fontWeight: 300, color: "#888", marginTop: 8, textAlign: "center", maxWidth: 220 }}>{subtitle}</div>}
    </div>
  );
};

// ── BOTTOM SHEET ──────────────────────────────────────────────
const BottomSheet = ({ open, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: open ? "auto" : "none", display: "flex", flexDirection: "column", justifyContent: "flex-end", maxWidth: 480, margin: "0 auto" }}>
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", opacity: open ? 1 : 0, transition: "opacity 200ms" }} />
    <div style={{ position: "relative", transform: `translateY(${open ? "0" : "100%"})`, background: "#fff", zIndex: 201, transition: "transform 220ms cubic-bezier(.32,1,.6,1)", padding: "12px 24px 36px" }}>
      <div style={{ width: 40, height: 4, borderRadius: 99, background: "#E0E0E0", margin: "0 auto 8px" }} />
      <button onClick={onClose} style={{ position: "absolute", top: 14, right: 18, background: "none", border: "none", fontSize: 19, color: "#999", cursor: "pointer", lineHeight: 1 }}>✕</button>
      {children}
    </div>
  </div>
);

// ── TOAST ─────────────────────────────────────────────────────
const Toast = ({ message, visible }) => (
  <div style={{ position: "fixed", bottom: 88, left: "50%", transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`, background: "#222", color: "#fff", padding: "10px 22px", borderRadius: 99, fontSize: 13, fontWeight: 500, zIndex: 100, opacity: visible ? 1 : 0, transition: "all 200ms", pointerEvents: "none", whiteSpace: "nowrap" }}>
    {message}
  </div>
);

// ── BOTTOM NAV ────────────────────────────────────────────────
const BottomNav = ({ active, onNavigate }) => (
  <div style={{ background: "#fff", borderTop: "1px solid #F0F0F0", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 0 20px" }}>
    {[{ id: "home", icon: "home" }, { id: "transactions", icon: "contract" }, { id: "account", icon: "person" }].map(({ id, icon }) => (
      <button key={id} onClick={() => onNavigate(id)} style={{ background: active === id ? "#F4F2FA" : "none", border: "none", width: 64, height: 44, borderRadius: 99, cursor: "pointer", color: active === id ? "#7C5CBF" : "#AAAAAA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: active === id ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      </button>
    ))}
  </div>
);

// ── TX ROW ────────────────────────────────────────────────────
const TxRow = ({ tx, person, onClick, showAvatar = true }) => (
  <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #EAEAEA", borderRadius: 99, padding: 16, cursor: "pointer", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
      {showAvatar && person && <Avatar person={person} size={44} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.35 }}>
          {showAvatar ? (person?.fullName || person?.name) : tx.description}
        </div>
        <div style={{ fontSize: 13, color: "#A8A8A8", marginTop: 4, fontWeight: 400 }}>{formatDate(tx.datetime)}</div>
      </div>
    </div>
    <div style={{ background: tx.status === "paid" ? "#E6F7EE" : "#F5F5F5", borderRadius: 99, padding: "10px 18px", flexShrink: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: tx.status === "paid" ? "#3A9E6E" : "#111", letterSpacing: -0.3 }}>
        {tx.direction === "gave" ? `-R${fmt(tx.amount)}` : `R${fmt(tx.amount)}`}
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
    <div style={{ background: "#fff", paddingBottom: 24 }}>
      <div style={{ flexShrink: 0, background: "#fff", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "env(safe-area-inset-top, 20px) 24px 0" }}>
          <TallyLogo />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#ABABAB", fontWeight: 400, lineHeight: 1.4 }}>
              Hi, <span style={{ fontWeight: 700, color: "#111" }}>{firstName}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginTop: 0, letterSpacing: -0.5, lineHeight: 1.2 }}>
              -{`R${fmt(total)}`}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 500, fontSize: 17, color: "#111", padding: "0 24px", marginBottom: 18, letterSpacing: -0.1 }}>My People</div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingLeft: 24, paddingRight: 24, paddingBottom: 6 }}>
            <div onClick={onAddPerson} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, gap: 6, cursor: "pointer" }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", border: "2px dashed #111", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 26, color: "#111", lineHeight: 1, marginTop: -1 }}>+</span>
              </div>
              <span style={{ fontSize: 12, color: "#111", fontWeight: 400 }}>Add</span>
            </div>
            {people.map(p => {
              const personTxs = transactions.filter(t => t.personId === p.id);
              const personAllPaid = personTxs.length > 0 && personTxs.every(t => t.status === "paid");
              return (
                <div key={p.id} onClick={() => onPersonClick(p)} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, cursor: "pointer", gap: 6 }}>
                  <Avatar person={p} size={70} showPaidBadge={personAllPaid} />
                  <span style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>{p.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ fontWeight: 500, fontSize: 17, color: "#111", padding: "28px 24px 14px", letterSpacing: -0.1 }}>Transactions</div>
      </div>
      <div style={{ background: "#fff", paddingBottom: 24 }}>
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[...transactions].sort((a, b) => new Date(b.datetime) - new Date(a.datetime)).map(tx => {
            const p = people.find(x => x.id === tx.personId);
            return <TxRow key={tx.id} tx={tx} person={p} onClick={() => onTxClick(tx)} />;
          })}
          {transactions.length === 0 && <div style={{ textAlign: "center", color: "#BABABA", padding: "40px 0", fontSize: 14 }}>No transactions yet</div>}
        </div>
      </div>
    </div>
  );
};

// ── PERSON SCREEN ─────────────────────────────────────────────
const PersonScreen = ({ person, onBack, onTxClick, onAddNew, onEditPerson }) => {
  const { transactions, markAllPaid } = useApp();
  const [paidSheet, setPaidSheet] = useState(false);
  const txs = transactions.filter(t => t.personId === person.id);
  const unpaidTxs = txs.filter(t => t.status === "unpaid");
  const { sent, received, balance } = getPersonStats(person.id, transactions);
  const allPaid = txs.length > 0 && unpaidTxs.length === 0;

  const handleCall = () => {
    if (person.phone) { window.location.href = `tel:${person.phone.replace(/\s/g, "")}`; }
    else { alert(`No phone number saved for ${person.name}.\nEdit their profile to add one.`); }
  };

  const handleRemind = () => {
    const amt = `R${fmt(Math.abs(balance))}`;
    const text = `Hi ${person.name}! Just a friendly reminder about ${amt} owed. Tracked via Tally 🐧`;
    if (navigator.share) navigator.share({ title: `Tally reminder`, text });
    else navigator.clipboard?.writeText(text);
    showSuccess("Reminder Sent", "We've nudged them for you", "notifications_active", "#D4800A", "#FDEBC8");
  };

  const handleInvite = (e) => {
    e.stopPropagation();
    // Use the person.globalId if available (for shadow users), else fallback to their personal id
    const shadowId = person.globalId || person.id;
    const link = `https://tally-app-fac0e.web.app/?invite=${shadowId}&from=${authUser.uid}`;
    const text = `Hi ${person.name}! I'm using Tally to track our money. Join me here to claim your balance: ${link}`;
    if (navigator.share) navigator.share({ title: `Join Tally`, text });
    else navigator.clipboard?.writeText(text);
    showSuccess("Invite Sent", "Invitation sent to their phone", "mail", "#3A9E6E", "#C6F0D8");
  };

  const actions = [
    { label: "All paid", bg: allPaid ? "#3A9E6E" : "#C6F0D8", icon: "check", color: allPaid ? "#fff" : "#3A9E6E", action: () => !allPaid && setPaidSheet(true) },
    { label: "Call", bg: "#F0F0F0", icon: "call", color: "#444", action: handleCall },
    { label: "Remind", bg: "#FDEBC8", icon: "notifications_active", color: "#D4800A", action: handleRemind },
    { label: "Add new", bg: "#E8E0F7", icon: "add", color: "#7C5CBF", action: () => onAddNew(person) },
  ];

  return (
    <div style={{ background: "#fff", paddingBottom: 24 }}>

      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", paddingBottom: 16 }}>
        {/* Header row: back and edit */}
        <div style={{ padding: "env(safe-area-inset-top, 20px) 20px 10px", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, display: "flex", alignItems: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#111", fontVariationSettings: "'FILL' 0, 'wght' 600, 'opsz' 24" }}>chevron_left</span>
          </button>
          <button onClick={() => onEditPerson(person)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, display: "flex", alignItems: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#111", fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 24" }}>more_horiz</span>
          </button>
        </div>

        {/* Unified Profile & Stats Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px 20px", marginTop: 10 }}>
          {/* Left: Sent */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 300, color: "#A8A8A8", marginBottom: 4 }}>Sent</div>
            <div style={{ fontSize: 17, fontWeight: 500, color: "#111", letterSpacing: -0.3 }}>-R{fmt(sent)}</div>
          </div>

          {/* Center: Avatar & Info */}
          <div onClick={() => onEditPerson(person)} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1.5, cursor: "pointer" }}>
            <Avatar person={person} size={64} showPaidBadge={false} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginTop: 8 }}>{person.name}</div>
            {!person.isLinked && (
              <div onClick={handleInvite} style={{ background: "#C6F0D8", color: "#2B7E55", fontSize: 12, fontWeight: 600, padding: "3px 14px", borderRadius: 99, marginTop: 6, cursor: "pointer" }}>
                Invite
              </div>
            )}
          </div>

          {/* Right: Received */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 300, color: "#A8A8A8", marginBottom: 4 }}>Received</div>
            <div style={{ fontSize: 17, fontWeight: 500, color: "#111", letterSpacing: -0.3 }}>R{fmt(received)}</div>
          </div>
        </div>

        {/* Clean Balance Display */}
        <div style={{ textAlign: "center", margin: "16px 0 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: "#A8A8A8" }}>Current balance</div>
          {allPaid ? (
            <div style={{ fontWeight: 500, fontSize: 28, marginTop: 4, color: "#3A9E6E", letterSpacing: -0.8 }}>Settled up</div>
          ) : (
            <div style={{ fontWeight: 500, fontSize: 28, marginTop: 4, color: balance >= 0 ? "#111" : "#6B2D6B", letterSpacing: -0.8 }}>
              {balance < 0 ? "-" : ""}R{fmt(Math.abs(balance))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 28px", marginTop: 24, marginBottom: 24 }}>
          {actions.map(({ label, bg, icon, color, action }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", width: 62 }} onClick={action}>
              <div style={{ width: 62, height: 62, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>{icon}</span>
              </div>
              <span style={{ fontSize: 13, color: "#111", fontWeight: 600, letterSpacing: -0.2 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* History Title Header */}
        <div style={{ padding: "0 24px" }}>
          <div style={{ fontSize: 17, fontWeight: 500, color: "#111" }}>History</div>
        </div>
      </div>

      {/* Scrolling History Section */}
      <div style={{ padding: "16px 24px 24px" }}>
        {txs.length === 0 ? (
          <div style={{ color: "#BABABA", textAlign: "center", padding: "16px 0 32px", fontSize: 14 }}>No transactions yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...txs].sort((a, b) => new Date(b.datetime) - new Date(a.datetime)).map(tx => (
              <TxRow key={tx.id} tx={tx} person={person} onClick={() => onTxClick(tx)} showAvatar={false} />
            ))}
          </div>
        )}
      </div>

      {/* All-paid confirmation sheet */}
      <BottomSheet open={paidSheet} onClose={() => setPaidSheet(false)}>
        <div style={{ paddingTop: 12, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#111", lineHeight: 1.3 }}>Are you sure all<br />was paid?</div>
          <div style={{ fontSize: 13, color: "#BABABA", marginTop: 8, marginBottom: 24, fontWeight: 300 }}>
            This will settle {unpaidTxs.length} unpaid transaction{unpaidTxs.length !== 1 ? "s" : ""} with {person.name}.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => setPaidSheet(false)} style={{ flex: 1, background: "#FFF0F0", color: "#D96A6A", border: "none", borderRadius: 99, padding: "14px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, letterSpacing: -0.2 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span> No, Cancel
            </button>
            <button onClick={() => { markAllPaid(person.id); setPaidSheet(false); }} style={{ flex: 1, background: "#D1F5D3", color: "#2B8A44", border: "none", borderRadius: 99, padding: "14px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, letterSpacing: -0.2 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span> Yes All paid
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
    if (k === "del") { onChange(value.slice(0, -1) || "0"); return; }
    const next = value === "0" ? k : value + k;
    if (next.length <= 7) onChange(next);
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) => (
        <button key={i} onClick={() => k && press(k)} style={{ background: "none", border: "none", fontSize: 28, fontWeight: 700, padding: "17px 0", cursor: k ? "pointer" : "default", color: k ? "#111" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {k === "del"
            ? <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="#111" strokeWidth="1.8"><path d="M10 1H26C27.1 1 28 1.9 28 3V19C28 20.1 27.1 21 26 21H10L1 11L10 1Z" /><path d="M18 8L14 12M14 8L18 12" strokeLinecap="round" /></svg>
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
  const [dir, setDir] = useState(transaction?.direction || "gave");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "0");
  const [desc, setDesc] = useState(transaction?.description || "");
  const display = () => { const n = parseInt(amount || "0"); return n === 0 ? "R0" : `R${n.toLocaleString("en-ZA")}`; };
  const done = () => {
    const amt = parseInt(amount || "0");
    if (!amt) return;

    let finalDesc = desc.trim();
    if (!finalDesc) finalDesc = dir === "gave" ? "Borrowed" : "Paid";

    if (isEdit) updateTransaction({ ...transaction, direction: dir, amount: amt, description: finalDesc });
    else addTransaction({ personId: person.id, direction: dir, amount: amt, description: finalDesc });
    onDone();
  };
  return (
    <div style={{ height: "100%", background: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "env(safe-area-inset-top, 20px) 24px 0", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, display: "flex", alignItems: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#111", fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 24" }}>chevron_left</span>
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <div style={{ display: "flex", background: "#F4F2FA", borderRadius: 99, padding: 4, border: "1px solid #E4DCF5" }}>
          {["gave", "got"].map(o => (
            <button key={o} onClick={() => setDir(o)} style={{ background: dir === o ? "#fff" : "none", border: dir === o ? "1.5px solid #C0ADE8" : "1.5px solid transparent", borderRadius: 99, padding: "10px 30px", fontSize: 15, fontWeight: dir === o ? 700 : 400, color: dir === o ? "#111" : "#ABABAB", cursor: "pointer" }}>
              {o === "gave" ? "I gave" : "I got"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 30 }}>
        <div style={{ fontSize: 52, fontWeight: 400, color: "#111", letterSpacing: -1 }}>{display()}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10, gap: 8 }}>
          <Avatar person={person} size={40} />
          <div style={{ background: "#F4F2FA", borderRadius: 99, padding: "5px 16px", fontSize: 13, fontWeight: 600, color: "#7C5CBF" }}>
            {dir === "gave" ? "To" : "From"} {person.name}
          </div>
        </div>
      </div>
      <div style={{ margin: "26px 28px 0" }}>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" style={{ width: "100%", border: "none", borderBottom: "1px solid #E8E8E8", padding: "8px 0", fontSize: 16, color: "#111", background: "none", outline: "none", textAlign: "center", fontWeight: desc ? 600 : 400 }} />
      </div>
      <div style={{ marginTop: 10, padding: "0 6px", flex: 1 }}>
        <Keypad value={amount} onChange={setAmount} />
      </div>
      <div style={{ padding: "8px 28px 36px", display: "flex", justifyContent: "center" }}>
        <button onClick={done} style={{ background: "#E8E0F7", border: "none", borderRadius: 99, padding: "17px 48px", fontSize: 17, fontWeight: 700, color: "#7C5CBF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>check</span>
          {isEdit ? "Update" : "Done"}
        </button>
      </div>
    </div>
  );
};

// ── TX DETAIL SHEET ───────────────────────────────────────────
const TxSheet = ({ tx, open, onClose, onEdit, onViewProfile }) => {
  const { people, markPaid, deleteTransaction, incrementReminder, showToast } = useApp();
  if (!tx) return null;
  const person = people.find(p => p.id === tx.personId);
  const neg = tx.direction === "gave";
  const isPaid = tx.status === "paid";

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ paddingTop: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 300, color: "#BABABA", marginBottom: 6, letterSpacing: 0.2 }}>Amount</div>
          <div style={{ fontSize: 42, fontWeight: 500, color: neg ? "#6B2D6B" : "#3A9E6E", letterSpacing: -0.5 }}>
            {neg ? `-R${fmt(tx.amount)}` : `R${fmt(tx.amount)}`}
          </div>
        </div>

        {[{ l: "Description", v: tx.description }, { l: "Date & Time", v: formatDate(tx.datetime) }, { l: "Logged by", v: tx.loggedByName || "You" }].map(({ l, v }) => (
          <div key={l} style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{ fontSize: 13, fontWeight: 300, color: "#BABABA", marginBottom: 5, letterSpacing: 0.2 }}>{l}</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#111", letterSpacing: 0.1 }}>{v}</div>
          </div>
        ))}

        {person && (
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 300, color: "#BABABA", marginBottom: 5, letterSpacing: 0.2 }}>
              {isPaid || !neg ? "Paid by" : "Owed by"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#111", letterSpacing: 0.1, marginBottom: 12 }}>
              {person.name || person.fullName}
            </div>
            <button onClick={() => { onClose(); onViewProfile && onViewProfile(person); }} style={{ background: "#F5F5F5", border: "none", borderRadius: 99, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#111", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              View profile <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingBottom: 8 }}>
          {!isPaid ? (
            <>
              <button onClick={() => { deleteTransaction(tx.id); onClose(); showToast("Deleted"); }} style={{ width: 54, height: 54, borderRadius: "50%", background: "#EEE8F7", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#7C5CBF", fontVariationSettings: "'FILL' 0, 'wght' 300" }}>delete</span>
              </button>
              <button onClick={() => { onClose(); onEdit(tx); }} style={{ width: 54, height: 54, borderRadius: "50%", background: "#EEE8F7", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#7C5CBF", fontVariationSettings: "'FILL' 0, 'wght' 300" }}>edit</span>
              </button>
              <button onClick={() => {
                const amt = `R${fmt(tx.amount)}`;
                const text = `Hi! Just a friendly reminder about ${amt} for "${tx.description}" logged on ${formatDate(tx.datetime)}.\n\nTracked via Tally 🐧`;
                if (navigator.share) { navigator.share({ title: `Tally reminder — ${amt}`, text }); }
                else { navigator.clipboard?.writeText(text).then(() => showToast("Copied to clipboard!")); }
                incrementReminder(tx.id);
              }} style={{ flex: 1, background: "#FDEBC8", border: "none", borderRadius: 99, padding: "14px 0", fontSize: 14, fontWeight: 600, color: "#D4800A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#D4800A", fontVariationSettings: "'FILL' 0, 'wght' 300" }}>vibration</span> Remind
              </button>
              <button onClick={() => { markPaid(tx.id); onClose(); showToast("Marked as paid!"); }} style={{ flex: 1, background: "#C6F0D8", border: "none", borderRadius: 99, padding: "14px 0", fontSize: 14, fontWeight: 600, color: "#3A9E6E", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#3A9E6E", fontVariationSettings: "'FILL' 0, 'wght' 400" }}>check</span> Paid
              </button>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <button onClick={() => {
                const amt = `R${fmt(tx.amount)}`;
                const text = `Thanks for the ${amt} for "${tx.description}"!\n\nTracked via Tally 🐧`;
                if (navigator.share) { navigator.share({ title: `Tally — Thanks!`, text }); }
                else { navigator.clipboard?.writeText(text).then(() => showToast("Copied to clipboard!")); }
              }} style={{ background: "#FDEBC8", border: "none", borderRadius: 99, padding: "16px 32px", fontSize: 14, fontWeight: 600, color: "#D4800A", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 0.1 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#D4800A", fontVariationSettings: "'FILL' 0, 'wght' 400" }}>vibration</span> Say Thanks
              </button>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};

// ── TRANSACTIONS SCREEN (sticky header) ───────────────────────
const TxScreen = ({ onTxClick }) => {
  const { transactions, people } = useApp();
  const grouped = {};
  [...transactions].sort((a, b) => new Date(b.datetime) - new Date(a.datetime)).forEach(tx => {
    const k = formatMonthYear(tx.datetime);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(tx);
  });
  return (
    <div style={{ background: "#fff", paddingBottom: 24 }}>
      {/* Sticky heading */}
      <div style={{ flexShrink: 0, background: "#fff", borderBottom: "1px solid #F5F5F5", padding: "env(safe-area-inset-top, 20px) 24px 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontWeight: 500, fontSize: 28, color: "#111" }}>Transactions</div>
      </div>
      {/* Scrollable list */}
      <div style={{ padding: "16px 20px 24px" }}>
        {Object.entries(grouped).map(([month, txs]) => (
          <div key={month} style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 500, fontSize: 14.5, color: "#555", marginBottom: 12 }}>{month}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {txs.map(tx => { const p = people.find(x => x.id === tx.personId); return <TxRow key={tx.id} tx={tx} person={p} onClick={() => onTxClick(tx)} />; })}
            </div>
          </div>
        ))}
        {transactions.length === 0 && <div style={{ textAlign: "center", color: "#BABABA", padding: "40px 0", fontSize: 14 }}>No transactions yet</div>}
      </div>
    </div>
  );
};

// ── SHARED SUB-SCREEN HEADER ──────────────────────────────────
const SubHeader = ({ title, onBack }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "env(safe-area-inset-top, 20px) 20px 18px", flexShrink: 0, position: "sticky", top: 0, zIndex: 100, background: "#fff" }}>
    <button onClick={onBack} style={{ background: "#F5F5F5", border: "none", cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#111" }}>chevron_left</span>
    </button>
    <span style={{ fontWeight: 600, fontSize: 20, color: "#111" }}>{title}</span>
  </div>
);

const ScrollScreen = ({ children }) => (
  <div style={{ background: "#fff", paddingBottom: 24 }}>
    {children}
  </div>
);

// ── NOTIFICATIONS SCREEN ──────────────────────────────────────
const NotificationsScreen = ({ onBack }) => {
  const [settings, setSettings] = useState({ reminders: true, payments: true, newPeople: false, weeklySummary: true, appUpdates: false });
  const toggle = (key) => setSettings(s => ({ ...s, [key]: !s[key] }));
  const Toggle = ({ k, label, sub }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#fff", borderRadius: 99, border: "1px solid #E2E2E2", marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, fontWeight: 300, color: "#BABABA", marginTop: 2 }}>{sub}</div>}
      </div>
      <div onClick={() => toggle(k)} style={{ width: 46, height: 26, borderRadius: 99, background: settings[k] ? "#7C5CBF" : "#E0E0E0", position: "relative", cursor: "pointer", transition: "background .25s", flexShrink: 0, marginLeft: 12 }}>
        <div style={{ position: "absolute", top: 3, left: settings[k] ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .25s", boxShadow: "0 1px 4px rgba(0,0,0,.18)" }} />
      </div>
    </div>
  );
  return (
    <ScrollScreen>
      <SubHeader title="Notifications" onBack={onBack} />
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: .7 }}>Activity</div>
        <Toggle k="reminders" label="Payment reminders" sub="When you send a nudge to someone" />
        <Toggle k="payments" label="Payment received" sub="When someone marks a debt settled" />
        <Toggle k="newPeople" label="New connections" sub="When a contact joins Tally" />
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", margin: "20px 0 10px", textTransform: "uppercase", letterSpacing: .7 }}>General</div>
        <Toggle k="weeklySummary" label="Weekly summary" sub="A recap of your outstanding balances" />
        <Toggle k="appUpdates" label="App updates & news" sub="New features and announcements" />
      </div>
    </ScrollScreen>
  );
};

// ── PRIVACY & SECURITY SCREEN ─────────────────────────────────
const PrivacySecurityScreen = ({ onBack }) => {
  const Row = ({ label, sub, onClick, danger }) => (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "#fff", borderRadius: 16, border: "1px solid #E2E2E2", marginBottom: 10, cursor: onClick ? "pointer" : "default" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: danger ? "#D0453A" : "#111" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, fontWeight: 300, color: "#BABABA", marginTop: 2 }}>{sub}</div>}
      </div>
      {onClick && <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#BABABA", fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 20" }}>chevron_right</span>}
    </div>
  );
  return (
    <ScrollScreen>
      <SubHeader title="Privacy & Security" onBack={onBack} />
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: .7 }}>Privacy</div>
        <Row label="Privacy Policy" sub="How we collect and use your data" onClick={() => window.open("privacy.html", "_blank")} />
        <Row label="Data & Permissions" sub="Manage what Tally can access" onClick={() => { }} />
        <Row label="Download my data" sub="Export a copy of your Tally data" onClick={() => { }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", margin: "18px 0 10px", textTransform: "uppercase", letterSpacing: .7 }}>Security</div>
        <Row label="Change password" onClick={() => { }} />
        <Row label="Two-factor authentication" sub="Add an extra layer of security" onClick={() => { }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", margin: "18px 0 10px", textTransform: "uppercase", letterSpacing: .7 }}>Danger zone</div>
        <Row label="Delete my account" sub="Permanently remove all your data" danger />
      </div>
    </ScrollScreen>
  );
};

// ── HELP CENTRE SCREEN ────────────────────────────────────────
const HelpCentreScreen = ({ onBack }) => {
  const [open, setOpen] = useState(null);
  const faqs = [
    { q: "How do I add someone?", a: "Tap the + icon on the home screen. You can search for existing Tally users or add anyone manually with just their name." },
    { q: "Does the other person need Tally?", a: "No! You can add anyone manually. If they join Tally later, you can link up and your history will sync automatically." },
    { q: "How do I log a transaction?", a: "Open a person's profile and tap 'Add new'. Enter a description, amount, and whether you gave or received the money." },
    { q: "How do I mark something as settled?", a: "Open the transaction and tap 'Mark as settled', or on the person screen tap 'All paid' to settle the entire balance." },
    { q: "How do reminders work?", a: "On a person's screen tap 'Remind'. Tally opens your share sheet so you can send them a message directly." },
    { q: "Can I edit or delete a transaction?", a: "Yes — open the transaction from any screen and tap the edit icon. You can update any field or delete it entirely." },
    { q: "Is my data secure?", a: "Yes. Tally uses Google Firebase with enterprise-grade encryption at rest and in transit. We never sell your data." },
  ];
  return (
    <ScrollScreen>
      <SubHeader title="Help Centre" onBack={onBack} />
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{ background: "#F8F7FF", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#7C5CBF", marginBottom: 4 }}>Need more help?</div>
          <div style={{ fontSize: 13, fontWeight: 300, color: "#666", lineHeight: 1.6 }}>Can't find what you're looking for? Our support team usually responds within a few hours.</div>
          <div onClick={() => window.open("contact.html", "_blank")} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "#7C5CBF", color: "#fff", borderRadius: 99, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mail</span>
            Contact support
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 12, textTransform: "uppercase", letterSpacing: .7 }}>Frequently asked questions</div>
        {faqs.map((f, i) => (
          <div key={i} onClick={() => setOpen(open === i ? null : i)} style={{ background: "#fff", border: "1px solid #E2E2E2", borderRadius: 16, padding: "14px 18px", marginBottom: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#111", flex: 1, paddingRight: 10 }}>{f.q}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#BABABA", transition: "transform .2s", transform: open === i ? "rotate(180deg)" : "rotate(0)" }}>keyboard_arrow_down</span>
            </div>
            {open === i && <div style={{ fontSize: 14, fontWeight: 300, color: "#666", lineHeight: 1.7, marginTop: 10 }}>{f.a}</div>}
          </div>
        ))}
      </div>
    </ScrollScreen>
  );
};

// ── TERMS SCREEN ──────────────────────────────────────────────
const TermsScreen = ({ onBack }) => {
  const sections = [
    { h: "1. Acceptance of Terms", p: "By using Tally you agree to be bound by these Terms. If you do not agree, please do not use the app." },
    { h: "2. Description of Service", p: "Tally is a personal finance tracking app. It records money between people. Tally does not process, hold, or transfer actual funds." },
    { h: "3. User Accounts", p: "You are responsible for maintaining your account credentials and for all activity under your account." },
    { h: "4. Acceptable Use", p: "Do not use Tally to harass others, violate laws, attempt unauthorised access, or conduct fraud." },
    { h: "5. Intellectual Property", p: "All content and features of Tally are owned by Tally and protected by applicable intellectual property laws." },
    { h: "6. Limitation of Liability", p: "Tally is provided 'as is'. To the fullest extent permitted by law we are not liable for indirect or consequential damages." },
    { h: "7. Governing Law", p: "These Terms are governed by the laws of the Republic of South Africa." },
    { h: "8. Questions?", p: "", link: true },
  ];
  return (
    <ScrollScreen>
      <SubHeader title="Terms of Service" onBack={onBack} />
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 300, color: "#BABABA", marginBottom: 18 }}>Last updated: 19 February 2026</div>
        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 5 }}>{s.h}</div>
            {s.link
              ? <div style={{ fontSize: 13, fontWeight: 300, color: "#666", lineHeight: 1.7 }}>Questions? <span onClick={() => window.open("contact.html", "_blank")} style={{ color: "#7C5CBF", fontWeight: 500, cursor: "pointer" }}>Contact us</span>.</div>
              : <div style={{ fontSize: 13, fontWeight: 300, color: "#666", lineHeight: 1.7 }}>{s.p}</div>}
          </div>
        ))}
        <div onClick={() => window.open("terms.html", "_blank")} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#7C5CBF", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
          View full Terms on web
        </div>
      </div>
    </ScrollScreen>
  );
};

// ── ACCOUNT / PROFILE SCREEN (sticky header) ──────────────────
const AccountScreen = ({ onNavigate, authUser, onSignOut }) => {
  const name = authUser?.displayName || "Guest";
  const email = authUser?.email || "";
  const photo = authUser?.photoURL;
  const initials = getInitials(name);

  const SettingRow = ({ label, sub, onClick }) => (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E2E2E2", borderRadius: 99, padding: "16px 18px", background: "#fff", cursor: "pointer", marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 15, color: "#111", fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, fontWeight: 300, color: "#BABABA", marginTop: 1 }}>{sub}</div>}
      </div>
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#BABABA", fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 20" }}>chevron_right</span>
    </div>
  );

  return (
    <div style={{ background: "#fff", paddingBottom: 24 }}>
      {/* Sticky heading */}
      <div style={{ flexShrink: 0, background: "#fff", borderBottom: "1px solid #F5F5F5", padding: "env(safe-area-inset-top, 20px) 24px 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontWeight: 500, fontSize: 28, color: "#111" }}>Profile</div>
      </div>
      {/* Scrollable content */}
      <div style={{ padding: "16px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 24px 22px" }}>
          {photo
            ? <img src={photo} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            : <Avatar person={{ name, initials }} size={56} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>{name}</div>
            <div style={{ fontSize: 13, color: "#BABABA", marginTop: 2 }}>{email}</div>
          </div>
        </div>
        <div style={{ padding: "0 20px", marginBottom: 20 }}>
          <div style={{ fontWeight: 500, fontSize: 14.5, color: "#111", marginBottom: 10 }}>Account</div>
          <SettingRow label="Notifications" sub="Reminders, activity & updates" onClick={() => onNavigate("notifications")} />
          <SettingRow label="Privacy & Security" sub="Data, permissions & security" onClick={() => onNavigate("privacy-security")} />
        </div>
        <div style={{ padding: "0 20px", marginBottom: 20 }}>
          <div style={{ fontWeight: 500, fontSize: 14.5, color: "#111", marginBottom: 10 }}>Support</div>
          <SettingRow label="Help Centre" sub="FAQs and contact support" onClick={() => onNavigate("help-centre")} />
          <SettingRow label="Terms of Service" sub="Our terms and conditions" onClick={() => onNavigate("terms")} />
        </div>
        <div style={{ padding: "0 20px" }}>
          <div onClick={onSignOut} style={{ border: "1px solid #E2E2E2", borderRadius: 99, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: "#7C5CBF", fontWeight: 700 }}>Log Out</span>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#BABABA", fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 20" }}>chevron_right</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── ADD PERSON SCREEN ─────────────────────────────────────────

const AddPersonScreen = ({ onBack, onAdd }) => {
  const { people, showSuccess, globalUsers } = useApp();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const existingGlobalIds = new Set(people.map(p => p.globalId).filter(Boolean));
  const existingNames = new Set(people.map(p => p.fullName || p.name));

  const trimmed = query.trim();
  const results = trimmed.length >= 2
    ? globalUsers.filter(u =>
      (u?.name?.toLowerCase().includes(trimmed.toLowerCase()) ||
        (u?.phone && u.phone.replace(/\s/g, "").includes(trimmed.replace(/\s/g, ""))))
      && u.isRegistered === true
    )
    : [];

  const handleSearch = () => { if (trimmed.length >= 2) setSearched(true); };
  const handleKey = (e) => { if (e.key === "Enter") handleSearch(); };

  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    const words = manualName.trim().split(" ");
    onAdd({ name: words[0], initials: (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase(), phone: manualPhone.trim() || null });
  };

  const handleGlobalAdd = (u) => {
    const words = u.name.split(" ");
    const initials = (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
    onAdd({
      name: words[0],
      fullName: u.name,
      initials,
      phone: u.phone || null,
      photoUrl: u.photoUrl || null,
      globalId: u.id,
      isLinked: true
    });
  };

  const handleImportContacts = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      showSuccess("Not supported", "Apple blocks web apps from reading contacts on iPhones.", "info", "#111", "#F5F5F5");
      return;
    }
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const contacts = await navigator.contacts.select(props, opts);
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        if (c.name && c.name.length > 0) setManualName(c.name[0]);
        if (c.tel && c.tel.length > 0) setManualPhone(c.tel[0]);
      }
    } catch (ex) {
      console.warn("Contacts API failed or cancelled.", ex);
    }
  };

  return (
    <div style={{ background: "#fff", paddingBottom: 24 }}>
      <div style={{ padding: "env(safe-area-inset-top, 20px) 24px 10px", background: "#fff", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#111", fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 24" }}>chevron_left</span>
        </button>
        <div style={{ fontWeight: 600, fontSize: 24, color: "#111", marginTop: 16 }}>Add Person</div>
        <div style={{ fontSize: 14, fontWeight: 300, color: "#BABABA", marginTop: 4 }}>Search for a Tally user or add manually</div>
      </div>
      <div style={{ padding: "24px 24px 24px" }}>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "#BABABA", fontVariationSettings: "'FILL' 0" }}>search</span>
          <input value={query} onChange={e => { setQuery(e.target.value); setSearched(false); }} onKeyDown={handleKey}
            placeholder="Search name or phone number"
            style={{ width: "100%", background: "#F5F5F5", border: "none", borderRadius: 99, padding: "14px 16px 14px 44px", fontSize: 16, color: "#111", outline: "none", boxSizing: "border-box" }} />
        </div>
        {searched && results.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: .7 }}>On Tally</div>
            {results.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff", border: "1px solid #E2E2E2", borderRadius: 99, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar person={{ fullName: u.name, name: u.name, photoUrl: u.photoUrl }} size={44} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>{u.name}</div>
                    {u.phone && <div style={{ fontSize: 12, color: "#BABABA", marginTop: 2 }}>{u.phone}</div>}
                  </div>
                </div>
                {existingGlobalIds.has(u.id) || existingNames.has(u.name)
                  ? <span style={{ fontSize: 13, color: "#BABABA", fontWeight: 600, paddingRight: 8 }}>Added</span>
                  : <button onClick={() => handleGlobalAdd(u)} style={{ background: "#E8E0F7", border: "none", borderRadius: 99, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#7C5CBF", cursor: "pointer" }}>Add</button>}
              </div>
            ))}
          </div>
        )}
        {searched && results.length === 0 && trimmed.length >= 2 && (
          <div style={{ textAlign: "center", color: "#BABABA", fontSize: 14, padding: "12px 0 24px" }}>No Tally users found — add manually below</div>
        )}
        {/* Manual add */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: .7 }}>Add manually</div>
        </div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "#BABABA", fontVariationSettings: "'FILL' 0" }}>person</span>
          <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Full name"
            style={{ width: "100%", background: "#F5F5F5", border: "none", borderRadius: 99, padding: "14px 16px 14px 44px", fontSize: 16, color: "#111", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "#BABABA", fontVariationSettings: "'FILL' 0" }}>phone</span>
          <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="Phone number (optional)"
            style={{ width: "100%", background: "#F5F5F5", border: "none", borderRadius: 99, padding: "14px 44px", fontSize: 16, color: "#111", outline: "none", boxSizing: "border-box" }} />
          <button onClick={handleImportContacts} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#BABABA" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>contact_page</span>
          </button>
        </div>
        <button onClick={handleManualAdd} disabled={!manualName.trim()}
          style={{ width: "100%", background: manualName.trim() ? "#E8E0F7" : "#F5F5F5", border: "none", borderRadius: 99, padding: "16px 0", fontSize: 15, fontWeight: 600, color: manualName.trim() ? "#7C5CBF" : "#BABABA", cursor: manualName.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 150ms" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0" }}>person_add</span>
          Add {manualName.trim() ? manualName.trim().split(" ")[0] : "person"}
        </button>
      </div>
    </div>
  );
};

// ── EDIT PERSON SCREEN ────────────────────────────────────────
const EditPersonScreen = ({ person, onBack, onSave, onUnlink }) => {
  const [fullName, setFullName] = useState(person.fullName || "");
  const [phone, setPhone] = useState(person.phone || "");

  const handleSave = () => {
    if (!fullName.trim()) return;
    const words = fullName.trim().split(" ");
    const initials = (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
    onSave({ ...person, fullName: fullName.trim(), name: words[0], initials, phone: phone.trim() || null });
  };

  return (
    <div style={{ background: "#fff", paddingBottom: 24 }}>
      <div style={{ padding: "env(safe-area-inset-top, 20px) 20px 10px", position: "sticky", top: 0, zIndex: 100, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#111", fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 24" }}>chevron_left</span>
        </button>
        <div style={{ fontSize: 17, fontWeight: 600, color: "#111" }}>Edit Person</div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: "28px 24px 40px" }}>
        {/* Avatar preview */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <Avatar person={{ fullName: fullName || person.fullName, name: fullName.split(" ")[0] || person.name, initials: (fullName.split(" ")[0]?.[0] || "") + (fullName.split(" ")[1]?.[0] || "") || person.initials }} size={80} />
        </div>

        {/* Fields */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: .7 }}>Details</div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "#BABABA" }}>person</span>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Full name"
            style={{ width: "100%", background: "#F5F5F5", border: "none", borderRadius: 99, padding: "14px 16px 14px 44px", fontSize: 16, color: "#111", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ position: "relative", marginBottom: 32 }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "#BABABA" }}>phone</span>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone number (optional)"
            type="tel"
            style={{ width: "100%", background: "#F5F5F5", border: "none", borderRadius: 99, padding: "14px 16px 14px 44px", fontSize: 16, color: "#111", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!fullName.trim()}
          style={{ width: "100%", background: fullName.trim() ? "#E8E0F7" : "#F5F5F5", border: "none", borderRadius: 99, padding: "16px 0", fontSize: 15, fontWeight: 600, color: fullName.trim() ? "#7C5CBF" : "#BABABA", cursor: fullName.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 150ms" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
          Save changes
        </button>

        <div style={{ fontSize: 12, fontWeight: 600, color: "#888", margin: "32px 0 10px", textTransform: "uppercase", letterSpacing: .7 }}>Danger zone</div>
        <button
          onClick={onUnlink}
          style={{ width: "100%", background: "#FFF0F0", border: "none", borderRadius: 99, padding: "16px 0", fontSize: 15, fontWeight: 600, color: "#D96A6A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_remove</span>
          Unlink person
        </button>
      </div>
    </div>
  );
};



// ── LOADING SCREEN ────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
    <TallyLogo />
    <div style={{ marginTop: 24, width: 32, height: 32, border: "2.5px solid #E2E2E2", borderTop: "2.5px solid #7C5CBF", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── LOGIN SCREEN ──────────────────────────────────────────────
const LoginScreen = ({ onGoogleSignIn, googleLoading, googleError }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace("Firebase:", "").trim());
      setLoading(false);
    }
  };

  const isBusy = loading || googleLoading;
  const displayError = error || googleError;

  return (
    <div style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 36px", position: "relative" }}>
      <button onClick={() => window.location.href = '/'} style={{ position: "absolute", top: 24, left: 24, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: 14, fontWeight: 500 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Home
      </button>

      <TallyLogo />
      <div style={{ marginTop: 32, marginBottom: 12, fontSize: 26, fontWeight: 600, color: "#111", letterSpacing: -0.5, textAlign: "center" }}>
        {isSignUp ? "Create an account" : "Sign in to Tally"}
      </div>
      <div style={{ fontSize: 15, fontWeight: 300, color: "#888", textAlign: "center", lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
        {isSignUp ? "Join Tally to start tracking with friends" : "Track money between friends, simply and honestly."}
      </div>

      <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {isSignUp && (
          <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #E2E2E2", fontSize: 16, outline: "none", fontFamily: "'Albert Sans', sans-serif" }} />
        )}
        <input type="email" placeholder="Email address" required value={email} onChange={e => setEmail(e.target.value)} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #E2E2E2", fontSize: 16, outline: "none", fontFamily: "'Albert Sans', sans-serif" }} />
        <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #E2E2E2", fontSize: 16, outline: "none", fontFamily: "'Albert Sans', sans-serif" }} />

        {displayError && <div style={{ fontSize: 13, color: "#E05A5A", textAlign: "center", fontWeight: 500, marginTop: 4 }}>{displayError}</div>}

        <button type="submit" disabled={isBusy} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 99, padding: "16px", fontSize: 15, fontWeight: 600, marginTop: 8, cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.7 : 1, fontFamily: "'Albert Sans', sans-serif" }}>
          {loading ? "Please wait..." : (isSignUp ? "Create Account" : "Sign In")}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: "#F0F0F0" }} />
        <div style={{ fontSize: 12, color: "#BABABA" }}>or</div>
        <div style={{ flex: 1, height: 1, background: "#F0F0F0" }} />
      </div>

      <button type="button" onClick={onGoogleSignIn} disabled={isBusy}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "#fff", border: "1.5px solid #E2E2E2", borderRadius: 99, padding: "14px", fontSize: 15, fontWeight: 600, color: "#111", cursor: isBusy ? "default" : "pointer", transition: "all .15s" }}>
        {googleLoading ? (
          <div style={{ width: 20, height: 20, border: "2px solid #E2E2E2", borderTop: "2px solid #7C5CBF", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
        )}
        {googleLoading ? "Signing in…" : "Continue with Google"}
      </button>

      <div style={{ marginTop: 24, fontSize: 14, color: "#666", textAlign: "center" }}>
        {isSignUp ? "Already have an account?" : "Don't have an account?"} {" "}
        <span onClick={() => { setIsSignUp(!isSignUp); setError(""); }} style={{ color: "#7C5CBF", fontWeight: 600, cursor: "pointer" }}>
          {isSignUp ? "Sign in" : "Sign up"}
        </span>
      </div>

      <div style={{ marginTop: 32, fontSize: 12, fontWeight: 300, color: "#BABABA", textAlign: "center", lineHeight: 1.6 }}>
        By continuing you agree to our{" "}
        <span onClick={() => window.open("/terms.html", "_blank")} style={{ color: "#7C5CBF", cursor: "pointer" }}>Terms</span>
        {" "}and{" "}
        <span onClick={() => window.open("/privacy.html", "_blank")} style={{ color: "#7C5CBF", cursor: "pointer" }}>Privacy Policy</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── ROOT APP ──────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [people, setPeople] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);

  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState("home");
  const [selPerson, setSelPerson] = useState(null);
  const [selTx, setSelTx] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState({ v: false, m: "" });
  const [success, setSuccess] = useState({ v: false, icon: "check_circle", title: "", subtitle: "", color: "#3A9E6E", bg: "#E8F7EE" });
  const hasWelcomed = useRef(false);
  const timer = useRef(null);

  const showSuccess = (title, subtitle = "", icon = "check_circle", color = "#3A9E6E", bg = "#E8F7EE") => {
    setSuccess({ v: true, icon, title, subtitle, color, bg });
  };

  // ── Auth listener & Interceptor ──────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (user) {
        (async () => {
          try {
            // Upgrade flow: Check if URL has ?invite=
            const urlParams = new URLSearchParams(window.location.search);
            const inviteId = urlParams.get('invite');
            if (inviteId) {
              const shadowSnap = await getDoc(globalUserDoc(inviteId));
              if (shadowSnap.exists() && shadowSnap.data().isShadow) {
                // Found a shadow profile. Claim it.
                await setDoc(globalUserDoc(user.uid), {
                  name: user.displayName || shadowSnap.data().name || "User",
                  email: user.email,
                  photoUrl: user.photoURL || null,
                  isRegistered: true,
                  claimedFrom: inviteId
                }, { merge: true });

                // Mark shadow as claimed
                await updateDoc(globalUserDoc(inviteId), { isShadow: false, claimedBy: user.uid });

                // Execute the data transfer
                await claimProfileData(inviteId, user.uid, shadowSnap.data().createdBy);

                window.history.replaceState({}, document.title, window.location.pathname);
                showSuccess(`Profile claimed!`, "Your history has been restored.", "how_to_reg", "#7C5CBF", "#F4F2FA");
              } else {
                await setDoc(globalUserDoc(user.uid), { name: user.displayName || "User", email: user.email, photoUrl: user.photoURL || null, isRegistered: true }, { merge: true });
              }
            } else {
              await setDoc(globalUserDoc(user.uid), { name: user.displayName || "User", email: user.email, photoUrl: user.photoURL || null, isRegistered: true }, { merge: true });
            }
          } catch (e) {
            console.error("Interceptor/Global Profile save failed. Using local state. Error:", e);
          } finally {
            if (!hasWelcomed.current) {
              hasWelcomed.current = true;
              const urlParams = new URLSearchParams(window.location.search);
              if (!urlParams.get('invite')) {
                showSuccess(`Welcome back, ${user.displayName?.split(" ")[0] || "there"}!`, "Good to see you again.", "auto_awesome", "#7C5CBF", "#F4F2FA");
              }
            }
          }
        })();
      }
    });
  }, []);

  // ── Firestore listeners (scoped to user) ──────────────────
  useEffect(() => {
    if (!authUser) { setPeople([]); setTransactions([]); setGlobalUsers([]); return; }
    const uid = authUser.uid;
    const unsubP = onSnapshot(peopleCol(uid), snap =>
      setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.isHidden))
    );
    const unsubT = onSnapshot(txCol(uid), snap =>
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // Fetch registered global users once
    getDocs(query(globalUsersCol, where("isRegistered", "==", true))).then(snap => {
      setGlobalUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== uid));
    }).catch(console.error);

    return () => { unsubP(); unsubT(); };
  }, [authUser]);

  const showToast = (m) => { clearTimeout(timer.current); setToast({ v: true, m }); timer.current = setTimeout(() => setToast(t => ({ ...t, v: false })), 2200); };

  // ── Data Migration ──────────────────────────────────────────
  const claimProfileData = async (shadowId, newUid, creatorUid) => {
    if (!shadowId || !newUid || !creatorUid) return;

    // 1. Update the person document in the creator's list to point to the real User ID (or we can just leave it as shadowId since the global doc now has claimedBy)
    // Actually, keeping the shadowId in the creator's list is fine because we just need to ensure the NEW user gets a fresh connection.
    // For now, we will add a connection document inside the new user's people collection back to the creator.

    const creatorSnap = await getDoc(globalUserDoc(creatorUid));
    if (creatorSnap.exists()) {
      await setDoc(personDoc(newUid, creatorUid), {
        name: creatorSnap.data().name.split(" ")[0],
        fullName: creatorSnap.data().name,
        initials: creatorSnap.data().name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2),
        isLinked: true,
        globalId: creatorUid
      });

      // Update the creator's person doc to flag as linked
      await updateDoc(personDoc(creatorUid, shadowId), { isLinked: true, linkedUid: newUid });
    }

    // 2. Transfer or duplicate transactions so the new user sees them
    // The easiest way is to copy all transactions from the creator that involved the shadowId into the new user's transaction list, flipping the amounts (if creator owed shadow, new user receives it).
    const txQuery = query(txCol(creatorUid));
    const txSnaps = await getDocs(txQuery);
    const batch = writeBatch(db);

    txSnaps.forEach(docSnap => {
      const data = docSnap.data();
      if (data.personId === shadowId) {
        // This transaction involved the shadow user.
        // We will create a mirror transaction in the new user's space.
        const newTxRef = doc(txCol(newUid));
        batch.set(newTxRef, {
          ...data,
          amount: data.amount * -1, // Flip the perspective
          personId: creatorUid,     // Point it to the creator
          mirroredFrom: docSnap.id
        });
      }
    });

    await batch.commit();
  };

  // ── CRUD → Firestore ──────────────────────────────────────
  const addTransaction = async (data) => {
    if (!authUser) return;
    const person = people.find(p => p.id === data.personId);
    const txId = doc(txCol(authUser.uid)).id;
    const payload = {
      ...data,
      datetime: new Date().toISOString(),
      status: "unpaid",
      loggedByUserId: authUser.uid,
      loggedByName: authUser.displayName || "You",
      reminderCount: 0,
      currency: "ZAR",
    };

    if (person?.isLinked && person?.globalId) {
      const batch = writeBatch(db);
      batch.set(txDoc(authUser.uid, txId), payload);
      batch.set(txDoc(person.globalId, txId), {
        ...payload,
        direction: payload.direction === "gave" ? "got" : "gave",
        personId: authUser.uid, // Point back to the creator
      });
      await batch.commit();
    } else {
      await setDoc(txDoc(authUser.uid, txId), payload);
    }

    showSuccess("Transaction saved!", `R${fmt(data.amount)} logged`, "check_circle");
  };

  const updateTransaction = async (updated) => {
    if (!authUser) return;
    const { id, ...data } = updated;
    const person = people.find(p => p.id === data.personId);

    if (person?.isLinked && person?.globalId) {
      const batch = writeBatch(db);
      batch.update(txDoc(authUser.uid, id), data);
      batch.update(txDoc(person.globalId, id), {
        ...data,
        direction: data.direction === "gave" ? "got" : "gave",
        personId: authUser.uid,
      });
      await batch.commit();
    } else {
      await updateDoc(txDoc(authUser.uid, id), data);
    }

    showSuccess("Transaction updated!", "", "edit");
  };

  const markPaid = async (id) => {
    if (!authUser) return;
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const person = people.find(p => p.id === tx.personId);

    if (person?.isLinked && person?.globalId) {
      const batch = writeBatch(db);
      batch.update(txDoc(authUser.uid, id), { status: "paid" });
      batch.update(txDoc(person.globalId, id), { status: "paid" });
      await batch.commit();
    } else {
      await updateDoc(txDoc(authUser.uid, id), { status: "paid" });
    }
    showSuccess("Marked as settled!", "Great, that's sorted.", "check_circle");
  };

  const markAllPaid = async (personId) => {
    if (!authUser) return;
    const person = people.find(p => p.id === personId);
    const unpaid = transactions.filter(t => t.personId === personId && t.status === "unpaid");
    if (!unpaid.length) return;

    if (person?.isLinked && person?.globalId) {
      const batch = writeBatch(db);
      unpaid.forEach(t => {
        batch.update(txDoc(authUser.uid, t.id), { status: "paid" });
        batch.update(txDoc(person.globalId, t.id), { status: "paid" });
      });
      await batch.commit();
    } else {
      await Promise.all(unpaid.map(t => updateDoc(txDoc(authUser.uid, t.id), { status: "paid" })));
    }
    showSuccess("All settled!", `${unpaid.length} transaction${unpaid.length !== 1 ? "s" : ""} marked as paid`, "check_circle");
  };

  const deleteTransaction = async (id) => {
    if (!authUser) return;
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const person = people.find(p => p.id === tx.personId);

    if (person?.isLinked && person?.globalId) {
      const batch = writeBatch(db);
      batch.delete(txDoc(authUser.uid, id));
      batch.delete(txDoc(person.globalId, id));
      await batch.commit();
    } else {
      await deleteDoc(txDoc(authUser.uid, id));
    }
    showSuccess("Deleted", "Transaction removed", "delete", "#B00020", "#FDEAEA");
  };

  const unlinkPerson = async (id) => {
    if (!authUser) return;
    await updateDoc(personDoc(authUser.uid, id), { isHidden: true });
    setScreen("home");
    showSuccess("Unlinked", "Person removed from view", "person_remove", "#D96A6A", "#FFF0F0");
  };

  const incrementReminder = async (id) => {
    if (!authUser) return;
    const tx = transactions.find(t => t.id === id);
    if (tx) await updateDoc(txDoc(authUser.uid, id), { reminderCount: (tx.reminderCount || 0) + 1 });
  };

  const addPerson = async (contact) => {
    if (!authUser) return;
    const words = contact.name.split(" ");
    const initials = (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();

    let targetId = contact.globalId;
    if (!targetId) {
      // 1. Create global shadow user
      const shadowRef = doc(collection(db, "users"));
      targetId = shadowRef.id;

      try {
        await setDoc(shadowRef, {
          name: contact.name,
          phone: contact.phone || null,
          isRegistered: false,
          isShadow: true,
          createdBy: authUser.uid
        });
      } catch (e) {
        console.warn("Could not create global shadow profile, creating local only:", e);
      }
    }

    // 2. Link shadow/global user to personal people list (merge resurrects hidden users automatically without breaking sync)
    // If it's a global add, sync the photoUrl.
    await setDoc(personDoc(authUser.uid, targetId), {
      name: words[0],
      fullName: contact.name,
      initials: contact.initials || initials,
      isLinked: !!contact.globalId,
      phone: contact.phone || null,
      photoUrl: contact.photoUrl || null,
      globalId: targetId,
      isHidden: false
    }, { merge: true });

    setTab("home");
    setScreen("home");
    showSuccess(`${words[0]} linked!`, "They've been added to your people", "person_add");
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
      setAuthError(e.code === "auth/popup-blocked"
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

  const nav = (t) => { setTab(t); setScreen(t === "home" ? "home" : t); };
  const goBack = () => {
    if (screen === "add") setScreen(selPerson ? "person" : "home");
    else if (screen === "person") { setScreen("home"); setTab("home"); }
    else if (screen === "addperson") setScreen("home");
    else if (screen === "editperson") setScreen("person");
    else if (["notifications", "privacy-security", "help-centre", "terms"].includes(screen)) setScreen("account");
  };

  const ctx = { transactions, people, authUser, globalUsers, addTransaction, updateTransaction, markPaid, markAllPaid, deleteTransaction, incrementReminder, showToast, showSuccess };

  // ── Render states ─────────────────────────────────────────
  if (authLoading) return <LoadingScreen />;
  if (!authUser) {
    return <LoginScreen onGoogleSignIn={handleGoogleSignIn} googleLoading={signInLoading} googleError={authError} />;
  }

  return (
    <AppContext.Provider value={ctx}>
      <div style={{ minHeight: "100dvh", paddingBottom: 84, maxWidth: 480, margin: "0 auto", background: "#fff", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Screen content */}
        <div style={{ flex: 1, position: "relative" }}>
          {screen === "home" && <HomeScreen onPersonClick={p => { setSelPerson(p); setScreen("person"); }} onTxClick={tx => { setSelTx(tx); setSheetOpen(true); }} onAddPerson={() => setScreen("addperson")} />}
          {screen === "person" && selPerson && <PersonScreen person={selPerson} onBack={goBack} onTxClick={tx => { setSelTx(tx); setSheetOpen(true); }} onAddNew={p => { setSelPerson(p); setEditTx(null); setScreen("add"); }} onEditPerson={p => { setSelPerson(p); setScreen("editperson"); }} />}
          {screen === "add" && selPerson && <AddScreen person={selPerson} transaction={editTx} onBack={goBack} onDone={() => { setScreen(selPerson ? "person" : "home"); }} />}
          {screen === "editperson" && selPerson && <EditPersonScreen person={selPerson} onBack={goBack} onSave={updatePerson} onUnlink={() => unlinkPerson(selPerson.id)} />}
          {screen === "addperson" && <AddPersonScreen onBack={goBack} onAdd={addPerson} />}
          {screen === "transactions" && <TxScreen onTxClick={tx => { setSelTx(tx); setSheetOpen(true); }} />}
          {screen === "account" && <AccountScreen onNavigate={setScreen} authUser={authUser} onSignOut={handleSignOut} />}
          {screen === "notifications" && <NotificationsScreen onBack={goBack} />}
          {screen === "privacy-security" && <PrivacySecurityScreen onBack={goBack} />}
          {screen === "help-centre" && <HelpCentreScreen onBack={goBack} />}
          {screen === "terms" && <TermsScreen onBack={goBack} />}
        </div>

        {/* Bottom nav */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, visibility: ["add", "addperson", "editperson", "notifications", "privacy-security", "help-centre", "terms"].includes(screen) ? "hidden" : "visible" }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <BottomNav active={tab} onNavigate={nav} />
          </div>
        </div>

        <TxSheet tx={selTx} open={sheetOpen} onClose={() => setSheetOpen(false)} onEdit={tx => { const p = people.find(x => x.id === tx.personId); setSelPerson(p); setEditTx(tx); setScreen("add"); }} onViewProfile={p => { setSelPerson(p); setScreen("person"); setSheetOpen(false); }} />
        <Toast message={toast.m} visible={toast.v} />
        <SuccessOverlay visible={success.v} icon={success.icon} title={success.title} subtitle={success.subtitle} color={success.color} bg={success.bg} onDone={() => setSuccess(s => ({ ...s, v: false }))} />
      </div>
    </AppContext.Provider>
  );
}
