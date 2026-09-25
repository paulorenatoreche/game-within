// Firebase SDK Imports (Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, doc, updateDoc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyA0am-MxYNuFNvcVo2AHBLEf3-5ymsVAhs",
    authDomain: "game-within.firebaseapp.com",
    projectId: "game-within",
    storageBucket: "game-within.firebasestorage.app",
    messagingSenderId: "887478087985",
    appId: "1:887478087985:web:5d3befd92e5f1cae1fc010"
};

// ==========================================
// ADMIN GOOGLE ACCOUNT UID
// ==========================================
const ADMIN_UID = "ePaR8uYILlOa53Tns3RCpdgMgQf2"; 

// Initialization
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Application Core State
const appState = {
    played: {
        collectionName: "games",
        list: [],
        sortCol: 'year', 
        sortDir: 'desc',
        unsubscribe: null
    },
    worked: {
        collectionName: "worked_games",
        list: [],
        sortCol: 'year',
        sortDir: 'desc',
        unsubscribe: null
    }
};

let currentTab = 'played'; 
let isAdmin = false;
let isWorkedTabUnlocked = false; 

// Global Custom Colors Object
let customTagColors = {}; 
let tagColorsFetched = false;

// Tabs & Main UI Containers
const tabPlayedBtn = document.getElementById('tabPlayedBtn');
const tabWorkedBtn = document.getElementById('tabWorkedBtn');
const tabLockIcon = document.getElementById('tabLockIcon');
const tablePlayedContainer = document.getElementById('tablePlayedContainer');
const tableWorkedContainer = document.getElementById('tableWorkedContainer');
const gamesTableBody = document.getElementById('gamesTableBody');
const workedTableBody = document.getElementById('workedTableBody');

// Form Specific Containers
const hoursContainer = document.getElementById('hoursContainer');
const ratingContainer = document.getElementById('ratingContainer');
const verdictContainer = document.getElementById('verdictContainer');
const statsGrid = document.getElementById('statsGrid');
const reviewLabel = document.getElementById('reviewLabel');
const gameHours = document.getElementById('gameHours');
const gameRating = document.getElementById('gameRating');

// General UI Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addGameBtn = document.getElementById('addGameBtn');
const gameModal = document.getElementById('gameModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const addGameForm = document.getElementById('addGameForm');
const shareBtn = document.getElementById('shareBtn');
const gameReview = document.getElementById('gameReview');
const charCount = document.getElementById('charCount');

// Password Modal Elements
const passwordModal = document.getElementById('passwordModal');
const closePasswordModalBtn = document.getElementById('closePasswordModalBtn');
const passwordForm = document.getElementById('passwordForm');
const ndaPassword = document.getElementById('ndaPassword');
const passwordError = document.getElementById('passwordError');

// Tag Management Elements
const manageTagsBtn = document.getElementById('manageTagsBtn');
const tagSettingsModal = document.getElementById('tagSettingsModal');
const closeTagModalBtn = document.getElementById('closeTagModalBtn');
const tagListContainer = document.getElementById('tagListContainer');
const saveTagsBtn = document.getElementById('saveTagsBtn');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

// ==========================================
// UTILITY HELPERS
// ==========================================
function formatReview(text) {
    if (!text) return "";
    let html = text.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    html = html.replace(urlRegex, url => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline pointer-events-auto cursor-pointer">${url}</a>`;
    });
    return html.replace(/\n/g, '<br>');
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function getHashColorHex(platformName) {
    let hash = 0;
    const str = platformName.trim().toLowerCase();
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return hslToHex(h, 70, 40); 
}

function getPlatformColorConfig(platformName) {
    const name = platformName.trim();
    if (customTagColors[name]) {
        return { bg: customTagColors[name].bg, text: customTagColors[name].text };
    }
    return { bg: getHashColorHex(name), text: "#ffffff" }; 
}

async function fetchTagColors() {
    try {
        const docSnap = await getDoc(doc(db, "settings", "tagColors"));
        if (docSnap.exists()) {
            customTagColors = docSnap.data();
        }
    } catch (e) {
        console.error("Error loading tag colors.", e);
    }
    tagColorsFetched = true;
}

// ==========================================
// TABS & NDA PASSWORD LOGIC
// ==========================================
function switchTab(tab) {
    currentTab = tab;

    if (tab === 'played') {
        tabPlayedBtn.className = "flex-1 sm:w-64 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm sm:text-base font-bold bg-blue-600 text-white shadow-md transition-all";
        tabWorkedBtn.className = "flex-1 sm:w-64 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm sm:text-base font-medium text-gray-400 hover:text-gray-200 transition-all cursor-pointer";

        tablePlayedContainer.classList.remove('hidden');
        tablePlayedContainer.classList.add('block');
        tableWorkedContainer.classList.remove('block');
        tableWorkedContainer.classList.add('hidden');
    } else {
        tabWorkedBtn.className = "flex-1 sm:w-64 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm sm:text-base font-bold bg-blue-600 text-white shadow-md transition-all";
        tabPlayedBtn.className = "flex-1 sm:w-64 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm sm:text-base font-medium text-gray-400 hover:text-gray-200 transition-all cursor-pointer";

        tableWorkedContainer.classList.remove('hidden');
        tableWorkedContainer.classList.add('block');
        tablePlayedContainer.classList.remove('block');
        tablePlayedContainer.classList.add('hidden');
    }
    
    renderTable(currentTab);
}

closePasswordModalBtn.addEventListener('click', () => {
    passwordModal.classList.add('hidden');
});

passwordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (ndaPassword.value === '7951') {
        isWorkedTabUnlocked = true;
        tabLockIcon.classList.replace('fa-lock', 'fa-unlock');
        passwordModal.classList.add('hidden');
        switchTab('worked');
    } else {
        passwordError.classList.remove('hidden');
    }
});

tabPlayedBtn.addEventListener('click', () => switchTab('played'));

tabWorkedBtn.addEventListener('click', () => {
    if (isAdmin || isWorkedTabUnlocked) {
        switchTab('worked');
    } else {
        ndaPassword.value = '';
        passwordError.classList.add('hidden');
        passwordModal.classList.remove('hidden');
        setTimeout(() => ndaPassword.focus(), 100);
    }
});

function prepareModalForTab(tab) {
    if (tab === 'played') {
        hoursContainer.classList.remove('hidden');
        ratingContainer.classList.remove('hidden');
        verdictContainer.classList.remove('hidden');
        statsGrid.className = "grid grid-cols-3 gap-4";
        reviewLabel.innerText = "Review (Max 300 chars)";
        gameHours.required = true;
        gameRating.required = true;
    } else {
        hoursContainer.classList.add('hidden');
        ratingContainer.classList.add('hidden');
        verdictContainer.classList.add('hidden');
        statsGrid.className = "grid grid-cols-1 gap-4";
        reviewLabel.innerText = "Service Provided (Max 300 chars)";
        gameHours.required = false;
        gameRating.required = false;
    }
}

// ==========================================
// SORTING LOGIC
// ==========================================
function setupSortingListeners() {
    document.querySelectorAll('.sortable-col').forEach(th => {
        th.addEventListener('click', () => {
            const tab = th.closest('#tablePlayedContainer') ? 'played' : 'worked';
            const col = th.getAttribute('data-sort');
            
            if (appState[tab].sortCol === col) {
                appState[tab].sortDir = appState[tab].sortDir === 'desc' ? 'asc' : 'desc';
            } else {
                appState[tab].sortCol = col;
                appState[tab].sortDir = col === 'title' ? 'asc' : 'desc';
            }
            
            updateSortIcons(tab);
            renderTable(tab);
        });
    });
}

function updateSortIcons(tab) {
    const container = tab === 'played' ? tablePlayedContainer : tableWorkedContainer;
    
    container.querySelectorAll('.sort-icon').forEach(icon => {
        icon.className = 'fa-solid fa-sort ml-1 text-gray-600 sort-icon'; 
    });
    
    const col = appState[tab].sortCol;
    if (!col) return;

    const th = container.querySelector(`th[data-sort="${col}"]`);
    if (th) {
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.className = appState[tab].sortDir === 'asc' 
                ? 'fa-solid fa-sort-up ml-1 text-blue-400 sort-icon' 
                : 'fa-solid fa-sort-down ml-1 text-blue-400 sort-icon';
        }
    }
}

// ==========================================
// 1. AUTHENTICATION (STRICT ADMIN ONLY)
// ==========================================
const provider = new GoogleAuthProvider();

loginBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        if (result.user.uid !== ADMIN_UID) {
            await signOut(auth);
            alert("Unauthorized account. Access restricted to Admin only.");
        }
    } catch (error) {
        if (error.code === 'auth/admin-restricted-operation') {
            alert("Access Denied: New sign-ups are disabled for this app.");
        } else if (error.code !== 'auth/popup-closed-by-user') {
            alert("Login error: " + error.message);
        }
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user && user.uid === ADMIN_UID) {
        isAdmin = true;
        document.body.classList.add('is-admin');
        loginBtn.style.display = 'none';
        tabLockIcon.classList.replace('fa-lock', 'fa-unlock');
    } else {
        if (user) signOut(auth);
        isAdmin = false;
        isWorkedTabUnlocked = false; 
        tabLockIcon.classList.replace('fa-unlock', 'fa-lock');
        document.body.classList.remove('is-admin');
        loginBtn.style.display = 'block';
        
        if (currentTab === 'worked') {
            switchTab('played'); 
        }
    }
    
    renderTable('played');
    renderTable('worked');
});

// ==========================================
// 2. MODALS & SHARING
// ==========================================
addGameBtn.addEventListener('click', () => {
    addGameForm.reset();
    document.getElementById('gameId').value = '';
    document.getElementById('gameOldCover').value = '';
    document.getElementById('gameCover').required = true;
    document.getElementById('modalTitle').innerText = currentTab === 'played' ? "Add New Game" : "Add Industry Experience";
    document.getElementById('submitBtn').innerText = "Save Entry";
    
    charCount.innerText = "0 / 300 characters";
    prepareModalForTab(currentTab);
    gameModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => gameModal.classList.add('hidden'));

shareBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied! Anyone can view your library, but only you can edit it.");
});

gameReview.addEventListener('input', () => {
    charCount.innerText = `${gameReview.value.length} / 300 characters`;
});

lightbox.addEventListener('click', () => {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
});

// ==========================================
// TAG COLOR MANAGEMENT (ADMIN ONLY)
// ==========================================
manageTagsBtn.addEventListener('click', () => {
    tagListContainer.innerHTML = '<p class="text-sm text-gray-400">Loading platforms...</p>'; 
    tagSettingsModal.classList.remove('hidden');

    const uniqueTags = new Set();
    
    appState.played.list.forEach(g => g.data.platforms.forEach(p => uniqueTags.add(p.trim())));
    appState.worked.list.forEach(g => g.data.platforms.forEach(p => uniqueTags.add(p.trim())));

    const sortedTags = Array.from(uniqueTags).sort((a, b) => a.localeCompare(b));
    tagListContainer.innerHTML = ''; 

    if (sortedTags.length === 0) {
        tagListContainer.innerHTML = '<p class="text-sm text-gray-400">No platforms found. Add some games first!</p>';
    }

    sortedTags.forEach(tag => {
        const colorConfig = getPlatformColorConfig(tag);
        const cleanTag = tag.replace(/"/g, '&quot;'); 

        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-gray-800/80 p-3 rounded border border-gray-700';
        row.innerHTML = `
            <span class="text-sm font-semibold text-white w-1/2 truncate" title="${tag}">${tag}</span>
            <div class="flex gap-4">
                <div class="flex flex-col items-center">
                    <label class="text-[10px] text-gray-400 mb-1">BG</label>
                    <input type="color" class="bg-picker w-8 h-8 rounded cursor-pointer border-0 bg-transparent" data-tag="${cleanTag}" value="${colorConfig.bg}">
                </div>
                <div class="flex flex-col items-center">
                    <label class="text-[10px] text-gray-400 mb-1">Text</label>
                    <input type="color" class="text-picker w-8 h-8 rounded cursor-pointer border-0 bg-transparent" data-tag="${cleanTag}" value="${colorConfig.text}">
                </div>
            </div>
        `;
        tagListContainer.appendChild(row);
    });
});

closeTagModalBtn.addEventListener('click', () => tagSettingsModal.classList.add('hidden'));

saveTagsBtn.addEventListener('click', async () => {
    saveTagsBtn.innerText = "Saving...";
    saveTagsBtn.disabled = true;

    const newColorSettings = {};
    const bgPickers = document.querySelectorAll('.bg-picker');
    
    bgPickers.forEach(bgInput => {
        const tag = bgInput.getAttribute('data-tag');
        const textInput = document.querySelector(`.text-picker[data-tag="${tag}"]`);
        
        newColorSettings[tag] = {
            bg: bgInput.value,
            text: textInput.value
        };
    });

    try {
        await setDoc(doc(db, "settings", "tagColors"), newColorSettings);
        customTagColors = newColorSettings; 
        tagSettingsModal.classList.add('hidden');
        renderTable('played');
        renderTable('worked');
    } catch (error) {
        alert("Error saving colors: " + error.message + "\n\nMake sure you updated your Firebase Rules to allow writing to /settings/");
    } finally {
        saveTagsBtn.innerText = "Save All Colors";
        saveTagsBtn.disabled = false;
    }
});

// ==========================================
// 3. ADD OR EDIT GAME (FORM SUBMIT)
// ==========================================
addGameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return alert("Unauthorized! You are not logged in as the admin.");

    const btnSubmit = document.getElementById('submitBtn');
    btnSubmit.innerText = "Saving...";
    btnSubmit.disabled = true;

    try {
        const id = document.getElementById('gameId').value;
        let imageUrl = document.getElementById('gameOldCover').value;
        const file = document.getElementById('gameCover').files[0];

        if (file) {
            const storageRef = ref(storage, `covers/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        }

        const gameData = {
            title: document.getElementById('gameTitle').value,
            coverUrl: imageUrl,
            platforms: document.getElementById('gamePlatforms').value.split(',').map(p => p.trim()),
            year: parseInt(document.getElementById('gameYear').value),
            review: document.getElementById('gameReview').value,
        };

        if (currentTab === 'played') {
            gameData.hours = parseFloat(document.getElementById('gameHours').value);
            gameData.rating = parseFloat(document.getElementById('gameRating').value);
            gameData.verdict = document.querySelector('input[name="verdict"]:checked').value;
        }

        const targetCollection = appState[currentTab].collectionName;

        if (id) {
            await updateDoc(doc(db, targetCollection, id), gameData);
        } else {
            gameData.createdAt = new Date();
            await addDoc(collection(db, targetCollection), gameData);
        }

        addGameForm.reset();
        gameModal.classList.add('hidden');
    } catch (error) {
        alert("Error saving: " + error.message);
    } finally {
        btnSubmit.innerText = "Save Entry";
        btnSubmit.disabled = false;
    }
});

// ==========================================
// 4. LOAD & RENDER GAMES 
// ==========================================
async function initDatabases() {
    if (!tagColorsFetched) await fetchTagColors();

    const qPlayed = query(collection(db, appState.played.collectionName), orderBy("createdAt", "desc"));
    if (appState.played.unsubscribe) appState.played.unsubscribe();
    appState.played.unsubscribe = onSnapshot(qPlayed, (querySnapshot) => {
        appState.played.list = [];
        querySnapshot.forEach((docSnap) => {
            appState.played.list.push({ id: docSnap.id, data: docSnap.data() });
        });
        renderTable('played');
    }, (error) => console.error("Live Sync Error (Played):", error));

    const qWorked = query(collection(db, appState.worked.collectionName), orderBy("createdAt", "desc"));
    if (appState.worked.unsubscribe) appState.worked.unsubscribe();
    appState.worked.unsubscribe = onSnapshot(qWorked, (querySnapshot) => {
        appState.worked.list = [];
        querySnapshot.forEach((docSnap) => {
            appState.worked.list.push({ id: docSnap.id, data: docSnap.data() });
        });
        renderTable('worked');
    }, (error) => console.error("Live Sync Error (Worked):", error));
}

function renderTable(tab) {
    const targetBody = tab === 'played' ? gamesTableBody : workedTableBody;
    targetBody.innerHTML = ''; 

    let listToRender = [...appState[tab].list];

    if (listToRender.length === 0) {
        targetBody.innerHTML = `<tr><td colspan="${tab === 'played' ? 8 : 5}" class="p-6 text-center text-gray-400">No entries yet.</td></tr>`;
        return;
    }

    const sortCol = appState[tab].sortCol;
    const sortDir = appState[tab].sortDir;

    if (sortCol) {
        listToRender.sort((a, b) => {
            let valA = a.data[sortCol];
            let valB = b.data[sortCol];
            
            if (sortCol === 'title') {
                valA = (valA || "").toString().toLowerCase();
                valB = (valB || "").toString().toLowerCase();
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
                
                if (valA === valB) {
                    let timeA = a.data.createdAt ? (a.data.createdAt.toMillis ? a.data.createdAt.toMillis() : 0) : 0;
                    let timeB = b.data.createdAt ? (b.data.createdAt.toMillis ? b.data.createdAt.toMillis() : 0) : 0;
                    return timeB - timeA; 
                }
                
                return sortDir === 'desc' ? valB - valA : valA - valB;
            }
        });
    }

    listToRender.forEach((item) => {
        const { id, data } = item;
        
        const tagsHTML = data.platforms.map(p => {
            const colorConfig = getPlatformColorConfig(p);
            return `<span class="tag shadow border border-white/20" style="background-color: ${colorConfig.bg}; color: ${colorConfig.text}">${p}</span>`;
        }).join('');
        
        const adminButtons = `
            <div class="flex items-start justify-center gap-2 sm:gap-3">
                <button class="edit-btn text-blue-400 hover:text-blue-300 transition text-sm sm:text-base p-1.5" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-btn text-red-500 hover:text-red-400 transition text-sm sm:text-base p-1.5" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-800/40 transition duration-200 group";
        tr.setAttribute('data-id', id);
        
        if (tab === 'played') {
            const verdictIcon = data.verdict === 'up' 
                ? '<i class="fa-solid fa-thumbs-up text-green-400 text-lg sm:text-2xl" title="Recommend"></i>' 
                : '<i class="fa-solid fa-thumbs-down text-red-400 text-lg sm:text-2xl" title="Don\'t Recommend"></i>';

            tr.innerHTML = `
                <td class="p-3 sm:p-4 align-top text-center">
                    <img src="${data.coverUrl}" alt="${data.title}" class="cover-img cursor-zoom-in w-16 sm:w-20 mx-auto aspect-[3/4] object-cover rounded shadow border border-gray-700 group-hover:border-blue-500 transition" data-url="${data.coverUrl}">
                </td>
                <td class="p-3 sm:p-4 align-top text-center">
                    <h3 class="text-sm sm:text-base font-bold text-white mb-2 leading-snug">${data.title}</h3>
                    <div class="flex flex-wrap justify-center gap-1">${tagsHTML}</div>
                </td>
                <td class="p-3 sm:p-4 align-top text-center">
                    <span class="inline-flex items-center justify-center text-gray-300 font-mono text-xs sm:text-sm bg-gray-800 px-2 py-1.5 rounded border border-gray-700 whitespace-nowrap shrink-0">
                        <i class="fa-regular fa-clock text-gray-500 mr-1.5"></i>${Number(data.hours).toFixed(1)}h
                    </span>
                </td>
                <td class="p-3 sm:p-4 align-top text-center">
                    <div class="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600 drop-shadow-sm">
                        ${Number(data.rating).toFixed(1)}
                    </div>
                </td>
                <td class="p-3 sm:p-4 align-top">
                    <p class="text-gray-400 text-xs sm:text-sm italic leading-relaxed line-clamp-4 sm:line-clamp-none">"${formatReview(data.review)}"</p>
                </td>
                <td class="p-3 sm:p-4 align-top text-center whitespace-nowrap">
                    <span class="text-gray-300 font-semibold">${data.year || '-'}</span>
                </td>
                <td class="p-3 sm:p-4 align-top text-center pt-5">
                    ${verdictIcon}
                </td>
                <td class="p-3 sm:p-4 align-top text-center admin-only admin-table-cell hidden">
                    ${adminButtons}
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td class="p-3 sm:p-4 align-top text-center">
                    <img src="${data.coverUrl}" alt="${data.title}" class="cover-img cursor-zoom-in w-16 sm:w-20 mx-auto aspect-[3/4] object-cover rounded shadow border border-gray-700 group-hover:border-blue-500 transition" data-url="${data.coverUrl}">
                </td>
                <td class="p-3 sm:p-4 align-top text-center">
                    <h3 class="text-sm sm:text-base font-bold text-white mb-2 leading-snug">${data.title}</h3>
                    <div class="flex flex-wrap justify-center gap-1">${tagsHTML}</div>
                </td>
                <td class="p-3 sm:p-4 align-top">
                    <p class="text-gray-400 text-xs sm:text-sm italic leading-relaxed line-clamp-4 sm:line-clamp-none">"${formatReview(data.review)}"</p>
                </td>
                <td class="p-3 sm:p-4 align-top text-center whitespace-nowrap">
                    <span class="text-gray-300 font-semibold">${data.year || '-'}</span>
                </td>
                <td class="p-3 sm:p-4 align-top text-center admin-only admin-table-cell hidden">
                    ${adminButtons}
                </td>
            `;
        }

        tr.querySelector('.cover-img').addEventListener('click', (e) => {
            lightboxImg.src = e.target.dataset.url;
            lightbox.classList.remove('hidden');
        });

        if (isAdmin) {
            tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(id, data, tab));
            tr.querySelector('.delete-btn').addEventListener('click', () => deleteGameNode(id, data.title, tab));
        }

        targetBody.appendChild(tr);
    });
}

// ==========================================
// 5. ADMIN FUNCTIONS
// ==========================================
function openEditModal(id, data, tabOrigin) {
    if (currentTab !== tabOrigin) switchTab(tabOrigin);
    
    prepareModalForTab(tabOrigin);
    
    document.getElementById('gameId').value = id;
    document.getElementById('gameOldCover').value = data.coverUrl;
    document.getElementById('gameTitle').value = data.title;
    document.getElementById('gamePlatforms').value = data.platforms.join(', ');
    document.getElementById('gameYear').value = data.year || new Date().getFullYear();
    document.getElementById('gameReview').value = data.review;
    
    if (tabOrigin === 'played') {
        document.getElementById('gameHours').value = data.hours;
        document.getElementById('gameRating').value = data.rating;
        document.querySelector(`input[name="verdict"][value="${data.verdict}"]`).checked = true;
    }
    
    document.getElementById('gameCover').required = false; 
    charCount.innerText = `${data.review.length} / 300 characters`;

    document.getElementById('modalTitle').innerText = tabOrigin === 'played' ? "Edit Game" : "Edit Industry Experience";
    document.getElementById('submitBtn').innerText = "Update Entry";
    gameModal.classList.remove('hidden');
}

async function deleteGameNode(id, title, tabOrigin) {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
        try {
            const targetCollection = appState[tabOrigin].collectionName;
            await deleteDoc(doc(db, targetCollection, id));
        } catch (error) {
            alert("Error deleting: " + error.message);
        }
    }
}

// Initialize application
setupSortingListeners();
updateSortIcons('played');
updateSortIcons('worked');
initDatabases();
