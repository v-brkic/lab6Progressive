// Importiranje idb biblioteke
import { openDB } from 'idb';

// Inicijalizacija IndexedDB
const dbPromise = openDB('fotobiljeske-db', 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('photos')) {
            db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        }
    },
});

// Funkcija za pohranu fotografije u IndexedDB
async function savePhoto(photo) {
    const db = await dbPromise;
    await db.add('photos', { photo, synced: false });
}

// Funkcija za dohvat nesinkroniziranih fotografija
async function getUnsyncedPhotos() {
    const db = await dbPromise;
    return await db.getAllFromIndex('photos', 'synced', false);
}

// Registracija Service Worker-a
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
    .then(reg => {
        console.log('Service Worker registriran.', reg);
    })
    .catch(err => {
        console.error('Service Worker registracija nije uspjela:', err);
    });
}

// Pretplata na Push Notifikacije
async function subscribePush() {
    if ('PushManager' in window) {
        try {
            const register = await navigator.serviceWorker.ready;
            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('BDAe6gQ3I4z6LtjYseXfv424kYre2v0t-6n-opGI7me2Yj81eUZpjljE7UPyKBFUYy1aFehpTTuwRc_FSDmFpJc')
            });
            await fetch('/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Pretplata na push notifikacije uspješna.');
        } catch (err) {
            console.error('Pretplata na push nije uspjela:', err);
        }
    } else {
        console.warn('Push notifikacije nisu podržane u ovom pregledniku.');
    }
}

// Pomoćna funkcija za konverziju VAPID ključa
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Pozivanje funkcije za pretplatu na push
subscribePush();

// Pristup kameri
const cameraButton = document.getElementById('camera-button');
const photosContainer = document.getElementById('photos');

cameraButton.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        // Kreiranje modalnog prozora za pregled kamere
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.flexDirection = 'column';
        modal.appendChild(video);

        // Dodavanje snimanja
        const captureButton = document.createElement('button');
        captureButton.innerText = 'Snimi';
        captureButton.style.marginTop = '1em';
        captureButton.style.padding = '10px 20px';
        captureButton.style.fontSize = '1em';
        captureButton.style.backgroundColor = '#f44336';
        captureButton.style.color = 'white';
        captureButton.style.border = 'none';
        captureButton.style.borderRadius = '5px';
        captureButton.style.cursor = 'pointer';
        captureButton.style.transition = 'background-color 0.3s';

        captureButton.addEventListener('mouseover', () => {
            captureButton.style.backgroundColor = '#d32f2f';
        });

        captureButton.addEventListener('mouseout', () => {
            captureButton.style.backgroundColor = '#f44336';
        });

        modal.appendChild(captureButton);
        document.body.appendChild(modal);

        captureButton.addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async blob => {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const imgURL = reader.result;
                    addPhoto(imgURL);
                    await savePhoto(imgURL); // Pohranjivanje u IndexedDB
                };
                reader.readAsDataURL(blob);
            }, 'image/png');
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(modal);
        });

    } catch (err) {
        console.error('Greška pri pristupu kameri:', err);
    }
});

// Dodavanje fotografije u prikaz i pohrana u IndexedDB
async function addPhoto(src) {
    const img = document.createElement('img');
    img.src = src;
    img.classList.add('photo');
    img.loading = 'lazy'; // Omogućava lazy loading
    photosContainer.appendChild(img);

    // Kreiranje dijeljenja
    const shareButton = document.createElement('button');
    shareButton.innerText = 'Dijeli';
    shareButton.style.display = 'block';
    shareButton.style.marginTop = '0.5em';
    shareButton.style.padding = '5px 10px';
    shareButton.style.fontSize = '0.9em';
    shareButton.style.backgroundColor = '#2196f3';
    shareButton.style.color = 'white';
    shareButton.style.border = 'none';
    shareButton.style.borderRadius = '3px';
    shareButton.style.cursor = 'pointer';
    shareButton.style.transition = 'background-color 0.3s';

    shareButton.addEventListener('mouseover', () => {
        shareButton.style.backgroundColor = '#1976d2';
    });

    shareButton.addEventListener('mouseout', () => {
        shareButton.style.backgroundColor = '#2196f3';
    });

    shareButton.addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({
                title: 'FotoBilješke',
                text: 'Pogledaj ovu fotografiju!',
                url: src
            })
            .then(() => console.log('Fotografija je dijeljena.'))
            .catch(err => console.error('Greška pri dijeljenju:', err));
        } else {
            // Fallback za preglednike koji ne podržavaju Web Share API
            const link = document.createElement('a');
            link.href = src;
            link.download = 'fotografija.png';
            link.innerText = 'Preuzmi fotografiju';
            shareButton.replaceWith(link);
        }
    });

    photosContainer.appendChild(shareButton);

    // Spremanje u IndexedDB
    await savePhoto(src);

    // Registracija background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-photos');
            console.log('Registriran background sync za sinkronizaciju fotografija.');
        } catch (err) {
            console.error('Registracija background sync nije uspjela:', err);
        }
    } else {
        console.warn('Background Sync nije podržan u ovom pregledniku.');
        // Alternativno, možete ponuditi ručnu sinkronizaciju korisniku
    }
}

// Učitavanje fotografija iz IndexedDB pri učitavanju stranice
window.addEventListener('load', async () => {
    const db = await dbPromise;
    const photos = await db.getAll('photos');
    photos.forEach(photo => {
        addPhoto(photo.photo);
    });
});
