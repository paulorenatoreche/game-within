// Importações do Firebase SDK Modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// COLE SUAS CONFIGURAÇÕES DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "AIzaSyA0am-MxYNuFNvcVo2AHBLEf3-5ymsVAhs",
    authDomain: "game-within.firebaseapp.com",
    projectId: "game-within",
    storageBucket: "game-within.firebasestorage.app",
    messagingSenderId: "887478087985",
    appId: "1:887478087985:web:5d3befd92e5f1cae1fc010"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Elementos da UI
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addGameBtn = document.getElementById('addGameBtn');
const gameModal = document.getElementById('gameModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const addGameForm = document.getElementById('addGameForm');
const gamesGrid = document.getElementById('gamesGrid');
const shareBtn = document.getElementById('shareBtn');

let isAdmin = false;

// 1. AUTENTICAÇÃO
const provider = new GoogleAuthProvider();

loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => alert("Erro ao logar: " + error.message));
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        isAdmin = true;
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
        loginBtn.style.display = 'none';
        console.log("Seu UID para as regras do Firebase é:", user.uid); // GUARDE ESSE CÓDIGO
    } else {
        isAdmin = false;
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        loginBtn.style.display = 'block';
    }
});

// 2. MODAL & COMPARTILHAMENTO
addGameBtn.addEventListener('click', () => gameModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => gameModal.classList.add('hidden'));

shareBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copiado! Qualquer um pode ver sua biblioteca, mas só você pode editar.");
});

// 3. ADICIONAR JOGO
addGameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return alert("Não autorizado!");

    const btnSubmit = addGameForm.querySelector('button[type="submit"]');
    btnSubmit.innerText = "Salvando...";
    btnSubmit.disabled = true;

    try {
        // Upload da Imagem
        const file = document.getElementById('gameCover').files[0];
        const storageRef = ref(storage, `covers/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);

        // Salvar no Firestore
        await addDoc(collection(db, "games"), {
            title: document.getElementById('gameTitle').value,
            coverUrl: imageUrl,
            platforms: document.getElementById('gamePlatforms').value.split(',').map(p => p.trim()),
            hours: Number(document.getElementById('gameHours').value),
            rating: Number(document.getElementById('gameRating').value),
            review: document.getElementById('gameReview').value,
            verdict: document.querySelector('input[name="verdict"]:checked').value,
            createdAt: new Date()
        });

        alert("Jogo salvo com sucesso!");
        addGameForm.reset();
        gameModal.classList.add('hidden');
        loadGames(); // Recarrega a lista
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    } finally {
        btnSubmit.innerText = "Salvar Jogo";
        btnSubmit.disabled = false;
    }
});

// 4. CARREGAR E RENDERIZAR JOGOS
async function loadGames() {
    gamesGrid.innerHTML = '<p class="text-gray-400">Carregando biblioteca...</p>';
    
    try {
        const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        gamesGrid.innerHTML = ''; // Limpa grid

        if(querySnapshot.empty) {
            gamesGrid.innerHTML = '<p class="text-gray-400">Nenhum jogo cadastrado ainda.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Gerar ícones nerd baseado na nota (🤓)
            let nerds = '';
            for(let i=0; i<data.rating; i++) nerds += '🤓 ';

            // Gerar Tags
            const tagsHTML = data.platforms.map(p => `<span class="tag">${p}</span>`).join('');
            
            // Veredito
            const verdictIcon = data.verdict === 'up' 
                ? '<i class="fa-solid fa-thumbs-up text-green-400 text-xl" title="Recomendo"></i>' 
                : '<i class="fa-solid fa-thumbs-down text-red-400 text-xl" title="Não Recomendo"></i>';

            // HTML do Card
            const card = document.createElement('div');
            card.className = "bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 flex flex-col hover:border-blue-500 transition";
            card.innerHTML = `
                <div class="h-48 overflow-hidden relative">
                    <img src="${data.coverUrl}" alt="${data.title}" class="w-full h-full object-cover">
                    <div class="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-sm font-bold border border-gray-600">
                        <i class="fa-solid fa-clock mr-1 text-gray-400"></i>${data.hours}h
                    </div>
                </div>
                <div class="p-5 flex-grow flex flex-col">
                    <h3 class="text-xl font-bold text-white mb-2">${data.title}</h3>
                    <div class="flex flex-wrap gap-2 mb-4">${tagsHTML}</div>
                    <p class="text-gray-400 text-sm flex-grow mb-4 italic">"${data.review}"</p>
                    <div class="flex justify-between items-center border-t border-gray-700 pt-4 mt-auto">
                        <div class="text-lg">${nerds}</div>
                        <div>${verdictIcon}</div>
                    </div>
                </div>
            `;
            gamesGrid.appendChild(card);
        });
    } catch (error) {
        console.error("Erro ao carregar jogos:", error);
        gamesGrid.innerHTML = '<p class="text-red-400">Erro ao carregar a biblioteca.</p>';
    }
}

// Inicializa a aplicação carregando os jogos
loadGames();