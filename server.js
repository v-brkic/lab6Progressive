const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const path = require('path');
const cors = require('cors');

// Kreiranje Express aplikacije
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

const publicVapidKey = 'BDAe6gQ3I4z6LtjYseXfv424kYre2v0t-6n-opGI7me2Yj81eUZpjljE7UPyKBFUYy1aFehpTTuwRc_FSDmFpJc';
const privateVapidKey = 'W78QldNq9km9BeBQrckbfXKPcW3kbz_5rmfbDuVNp9Y';

// Postavljanje VAPID detalja
webpush.setVapidDetails(
    'mailto:vinko.brkic@fer.hr',
    publicVapidKey,
    privateVapidKey
);

// Spremanje pretplata u memoriju (za proizvodnju koristite bazu podataka)
let subscriptions = [];

// Endpoint za pretplatu na push notifikacije
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    res.status(201).json({});
});

// Endpoint za upload fotografija
app.post('/upload', (req, res) => {
    const { image } = req.body;
    // Ovdje možete implementirati spremanje slike na poslužitelj ili cloud storage
    console.log('Primljena fotografija:', image);
    res.status(200).json({ message: 'Fotografija primljena' });

    // Slanje push notifikacija svim pretplaćenim korisnicima
    const payload = JSON.stringify({ title: 'FotoBilješke', body: 'Nova fotografija je uploadana!' });
    subscriptions.forEach(subscription => {
        webpush.sendNotification(subscription, payload).catch(err => console.error('Push notifikacija nije poslana:', err));
    });
});

// Serviranje statičkih datoteka iz public direktorija
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all ruta za frontend (npr., React Router)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Pokretanje servera
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server radi na portu ${PORT}`);
});
