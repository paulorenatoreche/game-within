// Firebase SDK Imports (Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query, doc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// UI Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addGameBtn = document.getElementById('addGameBtn');
const gameModal = document.getElementById('gameModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const addGameForm = document.getElementById('addGameForm');
const gamesTableBody = document.getElementById('gamesTableBody');
const shareBtn = document.getElementById('shareBtn');
const gameReview = document.getElementById('gameReview');
const charCount = document.getElementById('charCount');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

let isAdmin = false;
let sortableInstance = null; 

// Generate consistent colors from strings
function getPlatformColor(platformName) {
    let hash = 0;
    const str = platformName.trim().toLowerCase();
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 40%)`;
}

// 1. AUTHENTICATION (STRICT ADMIN ONLY)
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
        initSortable(); 
    } else {
        if (user) signOut(auth);
        isAdmin = false;
        document.body.classList.remove('is-admin');
        loginBtn.style.display = 'block';
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
    }
    loadGames(); 
});

// 2. MODALS, LIGHTBOX & SHARING
addGameBtn.addEventListener('click', () => {
    addGameForm.reset();
    document.getElementById('gameId').value = '';
    document.getElementById('gameOldCover').value = '';
    document.getElementById('gameCover').required = true;
    document.getElementById('modalTitle').innerText = "Add New Game";
    document.getElementById('submitBtn').innerText = "Save Game";
    
    charCount.innerText = "0 / 300 characters";
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

// 3. ADD OR EDIT GAME (FORM SUBMIT)
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
            hours: parseFloat(document.getElementById('gameHours').value),
            rating: parseFloat(document.getElementById('gameRating').value),
            year: parseInt(document.getElementById('gameYear').value),
            review: document.getElementById('gameReview').value,
            verdict: document.querySelector('input[name="verdict"]:checked').value
        };

        if (id) {
            await updateDoc(doc(db, "games", id), gameData);
        } else {
            gameData.createdAt = new Date();
            await addDoc(collection(db, "games"), gameData);
        }

        addGameForm.reset();
        gameModal.classList.add('hidden');
        loadGames(); 
    } catch (error) {
        alert("Error saving: " + error.message);
    } finally {
        btnSubmit.innerText = "Save Game";
        btnSubmit.disabled = false;
    }
});

// 4. LOAD & RENDER GAMES
async function loadGames() {
    gamesTableBody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-gray-400">Loading library...</td></tr>';
    
    try {
        const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        gamesTableBody.innerHTML = ''; 

        if (querySnapshot.empty) {
            gamesTableBody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-gray-400">No games added yet.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            const tagsHTML = data.platforms.map(p => {
                const color = getPlatformColor(p);
                return `<span class="tag shadow border border-white/10" style="background-color: ${color}">${p}</span>`;
            }).join('');
            
            const verdictIcon = data.verdict === 'up' 
                ? '<i class="fa-solid fa-thumbs-up text-green-400 text-lg sm:text-2xl" title="Recommend"></i>' 
                : '<i class="fa-solid fa-thumbs-down text-red-400 text-lg sm:text-2xl" title="Don\'t Recommend"></i>';

            const adminButtons = `
                <div class="flex items-center justify-center gap-2 sm:gap-3">
                    <i class="fa-solid fa-grip-vertical drag-handle text-gray-500 hover:text-white cursor-grab active:cursor-grabbing text-base sm:text-lg transition p-1.5" title="Drag to reorder"></i>
                    <button class="edit-btn text-blue-400 hover:text-blue-300 transition text-sm sm:text-base p-1.5" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="delete-btn text-red-500 hover:text-red-400 transition text-sm sm:text-base p-1.5" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-800/40 transition duration-200 group";
            tr.setAttribute('data-id', docSnap.id);
            
            tr.innerHTML = `
                <td class="p-2 sm:p-3 align-middle text-center">
                    <img src="${data.coverUrl}" alt="${data.title}" class="cover-img cursor-zoom-in w-16 sm:w-20 mx-auto aspect-[3/4] object-cover rounded shadow border border-gray-700 group-hover:border-blue-500 transition" data-url="${data.coverUrl}">
                </td>
                <td class="p-2 sm:p-3 align-middle text-center">
                    <h3 class="text-sm sm:text-base font-bold text-white mb-1.5 leading-snug">${data.title}</h3>
                    <div class="flex flex-wrap justify-center gap-1">${tagsHTML}</div>
                </td>
                <td class="p-2 sm:p-3 align-middle text-center">
                    <span class="inline-flex items-center justify-center text-gray-300 font-mono text-xs sm:text-sm bg-gray-800 px-2 py-1 rounded border border-gray-700 whitespace-nowrap shrink-0">
                        <i class="fa-regular fa-clock text-gray-500 mr-1"></i>${Number(data.hours).toFixed(1)}h
                    </span>
                </td>
                <td class="p-2 sm:p-3 align-middle text-center">
                    <div class="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600 drop-shadow-sm">
                        ${Number(data.rating).toFixed(1)}
                    </div>
                </td>
                <td class="p-2 sm:p-3 align-middle">
                    <p class="text-gray-400 text-xs sm:text-sm italic leading-relaxed line-clamp-3 sm:line-clamp-none">"${data.review}"</p>
                </td>
                <td class="p-2 sm:p-3 align-middle text-center whitespace-nowrap">
                    <span class="text-gray-300 font-semibold">${data.year || '-'}</span>
                </td>
                <td class="p-2 sm:p-3 align-middle text-center">
                    ${verdictIcon}
                </td>
                <td class="p-2 sm:p-3 align-middle text-center admin-only admin-table-cell hidden">
                    ${adminButtons}
                </td>
            `;

            tr.querySelector('.cover-img').addEventListener('click', (e) => {
                lightboxImg.src = e.target.dataset.url;
                lightbox.classList.remove('hidden');
            });

            if (isAdmin) {
                tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(docSnap.id, data));
                tr.querySelector('.delete-btn').addEventListener('click', () => deleteGameNode(docSnap.id, data.title));
            }

            gamesTableBody.appendChild(tr);
        });

        if (isAdmin) {
            initSortable();
        }
    } catch (error) {
        console.error("Error loading games:", error);
        gamesTableBody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-red-400">Error loading the library.</td></tr>';
    }
}

// 5. ADMIN FUNCTIONS
function openEditModal(id, data) {
    document.getElementById('gameId').value = id;
    document.getElementById('gameOldCover').value = data.coverUrl;
    document.getElementById('gameTitle').value = data.title;
    document.getElementById('gamePlatforms').value = data.platforms.join(', ');
    document.getElementById('gameHours').value = data.hours;
    document.getElementById('gameRating').value = data.rating;
    document.getElementById('gameYear').value = data.year || new Date().getFullYear();
    document.getElementById('gameReview').value = data.review;
    document.querySelector(`input[name="verdict"][value="${data.verdict}"]`).checked = true;
    
    document.getElementById('gameCover').required = false; 
    charCount.innerText = `${data.review.length} / 300 characters`;

    document.getElementById('modalTitle').innerText = "Edit Game";
    document.getElementById('submitBtn').innerText = "Update Game";
    gameModal.classList.remove('hidden');
}

// Drag and Drop Initialization (Guaranteed Firestore Persistence)
function initSortable() {
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }

    sortableInstance = Sortable.create(gamesTableBody, {
        handle: '.drag-handle', 
        animation: 200, 
        forceFallback: true, 
        fallbackClass: 'sortable-drag', 
        ghostClass: 'sortable-ghost',
        
        onEnd: async function (evt) {
            if (evt.oldIndex === evt.newIndex) return;

            // Get current visual order of IDs from the table
            const rows = Array.from(gamesTableBody.querySelectorAll('tr[data-id]'));
            const newOrderIds = rows.map(row => row.dataset.id);

            // Generate clean, strictly decreasing timestamps so Firestore orders correctly
            const baseTime = Date.now();
            const batch = writeBatch(db);

            newOrderIds.forEach((id, index) => {
                const docRef = doc(db, "games", id);
                // Guaranteed valid Date object: index 0 is newest, index 1 is older, etc.
                const newTimestamp = new Date(baseTime - (index * 60000));
                batch.update(docRef, { createdAt: newTimestamp });
            });

            try {
                await batch.commit();
                console.log("New order successfully saved to Firebase!");
            } catch (error) {
                console.error("Firebase writeBatch error:", error);
                alert("Error saving order: " + error.message);
                loadGames(); // Revert visual order on error
            }
        }
    });
}

async function deleteGameNode(id, title) {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
        try {
            await deleteDoc(doc(db, "games", id));
            loadGames();
        } catch (error) {
            alert("Error deleting: " + error.message);
        }
    }
}

// Initialize application
loadGames();
