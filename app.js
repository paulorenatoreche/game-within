// Firebase SDK Imports (Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
// REPLACE WITH YOUR ACTUAL GOOGLE ACCOUNT UID
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
let loadedGamesList = []; // Array to hold current games for reordering

// 1. AUTHENTICATION
const provider = new GoogleAuthProvider();

loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => alert("Login error: " + error.message));
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        // STRICT ADMIN CHECK: Only allow the predefined UID
        if (user.uid === ADMIN_UID) {
            isAdmin = true;
            document.body.classList.add('is-admin');
            loginBtn.style.display = 'none';
        } else {
            // Unauthorized User - Sign them out immediately
            alert("Unauthorized account. You do not have permission to edit this library.");
            signOut(auth);
            isAdmin = false;
            document.body.classList.remove('is-admin');
            loginBtn.style.display = 'block';
        }
    } else {
        isAdmin = false;
        document.body.classList.remove('is-admin');
        loginBtn.style.display = 'block';
    }
    loadGames(); // Reload to show/hide admin controls on rows
});

// 2. MODALS, LIGHTBOX & SHARING
addGameBtn.addEventListener('click', () => {
    addGameForm.reset();
    document.getElementById('gameId').value = '';
    document.getElementById('gameOldCover').value = '';
    document.getElementById('gameCover').required = true;
    document.getElementById('modalTitle').innerText = "Add New Game";
    document.getElementById('submitBtn').innerText = "Save Game";
    
    // Reset character counter
    charCount.innerText = "0 / 300 characters";
    
    gameModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => gameModal.classList.add('hidden'));

shareBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied! Anyone can view your library, but only you can edit it.");
});

// Update character counter on input
gameReview.addEventListener('input', () => {
    charCount.innerText = `${gameReview.value.length} / 300 characters`;
});

// Lightbox behavior
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

        // Upload new image if provided
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
            // Edit existing game
            await updateDoc(doc(db, "games", id), gameData);
        } else {
            // Add new game
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
    loadedGamesList = []; // Clear array
    
    try {
        const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        gamesTableBody.innerHTML = ''; 

        if(querySnapshot.empty) {
            gamesTableBody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-gray-400">No games added yet.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedGamesList.push({ id: docSnap.id, data: data });
            
            const tagsHTML = data.platforms.map(p => `<span class="tag">${p}</span>`).join('');
            
            const verdictIcon = data.verdict === 'up' 
                ? '<i class="fa-solid fa-thumbs-up text-green-400 text-2xl" title="Recommend"></i>' 
                : '<i class="fa-solid fa-thumbs-down text-red-400 text-2xl" title="Don\'t Recommend"></i>';

            // Build Admin Buttons HTML
            const adminButtons = `
                <div class="flex items-center justify-center gap-3">
                    <button class="edit-btn text-blue-400 hover:text-blue-300 transition" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <div class="flex flex-col gap-1">
                        <button class="up-btn text-gray-400 hover:text-white transition text-xs" title="Move Up"><i class="fa-solid fa-chevron-up"></i></button>
                        <button class="down-btn text-gray-400 hover:text-white transition text-xs" title="Move Down"><i class="fa-solid fa-chevron-down"></i></button>
                    </div>
                    <button class="delete-btn text-red-500 hover:text-red-400 transition" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-800/40 transition duration-200 group";
            tr.innerHTML = `
                <td class="p-4 align-middle text-center">
                    <img src="${data.coverUrl}" alt="${data.title}" class="cover-img cursor-zoom-in w-24 mx-auto aspect-[3/4] object-cover rounded shadow-md border border-gray-700 group-hover:border-blue-500 transition" data-url="${data.coverUrl}">
                </td>
                <td class="p-4 align-middle text-center">
                    <h3 class="text-xl font-bold text-white mb-2 leading-tight">${data.title}</h3>
                    <div class="flex flex-wrap justify-center gap-1.5">${tagsHTML}</div>
                </td>
                <td class="p-4 align-middle text-center">
                    <span class="text-gray-300 font-mono text-lg bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">
                        <i class="fa-regular fa-clock text-gray-500 mr-1 text-sm"></i>${Number(data.hours).toFixed(1)}h
                    </span>
                </td>
                <td class="p-4 align-middle text-center">
                    <div class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600 drop-shadow-md">
                        ${Number(data.rating).toFixed(1)}
                    </div>
                </td>
                <td class="p-4 align-middle">
                    <p class="text-gray-400 text-sm italic leading-relaxed">"${data.review}"</p>
                </td>
                <td class="p-4 align-middle text-center">
                    <span class="text-gray-300 font-bold tracking-wider">${data.year || '-'}</span>
                </td>
                <td class="p-4 align-middle text-center">
                    ${verdictIcon}
                </td>
                <td class="p-4 align-middle text-center admin-only admin-table-cell hidden">
                    ${adminButtons}
                </td>
            `;

            // Attach event listeners for this specific row
            tr.querySelector('.cover-img').addEventListener('click', (e) => {
                lightboxImg.src = e.target.dataset.url;
                lightbox.classList.remove('hidden');
            });

            if (isAdmin) {
                tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(docSnap.id, data));
                tr.querySelector('.up-btn').addEventListener('click', () => moveGame(docSnap.id, 'up'));
                tr.querySelector('.down-btn').addEventListener('click', () => moveGame(docSnap.id, 'down'));
                tr.querySelector('.delete-btn').addEventListener('click', () => deleteGameNode(docSnap.id, data.title));
            }

            gamesTableBody.appendChild(tr);
        });
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
    
    // File input is optional on edit
    document.getElementById('gameCover').required = false; 

    // Update character counter based on existing review length
    charCount.innerText = `${data.review.length} / 300 characters`;

    document.getElementById('modalTitle').innerText = "Edit Game";
    document.getElementById('submitBtn').innerText = "Update Game";
    gameModal.classList.remove('hidden');
}

async function moveGame(id, direction) {
    const index = loadedGamesList.findIndex(g => g.id === id);
    if (index === -1) return;

    let swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Check if move is out of bounds
    if (swapIndex < 0 || swapIndex >= loadedGamesList.length) return; 

    const currentDoc = loadedGamesList[index];
    const swapDoc = loadedGamesList[swapIndex];

    try {
        // Swap timestamps to reorder without breaking sorting logic
        await updateDoc(doc(db, "games", currentDoc.id), { createdAt: swapDoc.data.createdAt });
        await updateDoc(doc(db, "games", swapDoc.id), { createdAt: currentDoc.data.createdAt });
        loadGames(); // Refresh table
    } catch (error) {
        alert("Error reordering: " + error.message);
    }
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
