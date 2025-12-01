const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const Narudzba = require('./models/Narudzba');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));
app.use(compression());

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(express.static('public')); // Servira frontend

const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/naruci', orderLimiter);
app.use('/api/admin', adminLimiter);

// Brevo / Sendinblue email setup
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const brevoApiKey = brevoClient.authentications['api-key'];
let brevoEnabled = false;
let brevoEmailApi;

if (process.env.BREVO_API_KEY && process.env.MAIL_SENDER && process.env.ADMIN_EMAIL) {
    brevoApiKey.apiKey = process.env.BREVO_API_KEY;
    brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
    brevoEnabled = true;
} else {
    console.warn('Brevo API key / sender / admin email nisu postavljeni - email obavijesti su isključene.');
}

const STATUSI = ['zaprimljeno', 'priprema', 'poslano', 'isporuceno'];

const sendOrderEmails = async (narudzba) => {
    if (!brevoEnabled) return;

    const order = narudzba.toObject ? narudzba.toObject() : narudzba;
    const sender = {
        email: process.env.MAIL_SENDER,
        name: process.env.MAIL_SENDER_NAME || 'Thompson Shop'
    };

    const orderDetails = `
        <ul>
            <li><strong>Model:</strong> ${order.model}</li>
            <li><strong>Ime:</strong> ${order.ime_prezime}</li>
            <li><strong>Adresa:</strong> ${order.adresa}, ${order.grad}</li>
            <li><strong>Telefon:</strong> ${order.telefon}</li>
            <li><strong>Email:</strong> ${order.email || '—'}</li>
            <li><strong>Veličina:</strong> ${order.velicina}</li>
            <li><strong>Količina:</strong> ${order.kolicina}</li>
            <li><strong>Status:</strong> ${order.status}</li>
            <li><strong>Plaćeno:</strong> ${order.placeno ? 'Da' : 'Ne'}</li>
            <li><strong>Napomena:</strong> ${order.napomena || '—'}</li>
            <li><strong>Datum:</strong> ${new Date(order.datum).toLocaleString('hr-HR')}</li>
        </ul>`;

    const adminEmailPayload = {
        sender,
        to: [{ email: process.env.ADMIN_EMAIL }],
        subject: `Nova narudžba - ${order.ime_prezime}`,
        htmlContent: `<p>Stigla je nova narudžba:</p>${orderDetails}`
    };

    try {
        const emailTasks = [brevoEmailApi.sendTransacEmail(adminEmailPayload)];

        if (order.email) {
            const customerEmailPayload = {
                sender,
                to: [{ email: order.email, name: order.ime_prezime }],
                subject: 'Vaša narudžba je zaprimljena - Thompson Shop',
                htmlContent: `
                    <p>Pozdrav ${order.ime_prezime},</p>
                    <p>zaprimili smo Vašu narudžbu. Javimo se čim paket krene prema Vama.</p>
                    <p>Pregled narudžbe:</p>
                    ${orderDetails}
                    <p>Hvala na povjerenju!</p>
                `
            };
            emailTasks.push(brevoEmailApi.sendTransacEmail(customerEmailPayload));
        }

        await Promise.all(emailTasks);
    } catch (err) {
        console.error('Neuspjelo slanje emailova:', err);
    }
};

// Spajanje na MongoDB (optimizirano za Vercel)
let isConnected = false;
const fallbackNarudzbe = [];
const allowMemoryStore = process.env.ALLOW_MEMORY_STORE === 'true';
const useMemoryStore = allowMemoryStore && !process.env.MONGODB_URI;
let memoryStoreNoticeShown = false;
const dbReady = () => isConnected && mongoose.connection.readyState === 1;
const authorize = (req, res) => {
    if (!process.env.ADMIN_PASSWORD) {
        res.status(500).json({ error: 'ADMIN_PASSWORD nije definiran.' });
        return false;
    }

    if (req.headers['x-admin-pass'] !== process.env.ADMIN_PASSWORD) {
        res.status(403).json({ error: 'Kriva lozinka!' });
        return false;
    }
    return true;
};

const touchFallback = (id, changes) => {
    const idx = fallbackNarudzbe.findIndex(n => n._id === id);
    if (idx === -1) return null;
    fallbackNarudzbe[idx] = { ...fallbackNarudzbe[idx], ...changes };
    return fallbackNarudzbe[idx];
};

const connectDB = async () => {
    if (useMemoryStore) {
        if (!memoryStoreNoticeShown) {
            console.warn('Koristi se memorijski spremnik umjesto MongoDB veze.');
            memoryStoreNoticeShown = true;
        }
        return;
    }
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log('MongoDB connected.');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
};

// --- RUTE ---

// 1. KUPAC: Pošalji narudžbu
app.post('/api/naruci', async (req, res) => {
    await connectDB(); // Osiguraj vezu
    try {
        const payload = {
            ...req.body,
            model: req.body.model || 'Ako Ne Znaš Što Je Bilo',
            status: STATUSI.includes(req.body.status) ? req.body.status : 'zaprimljeno',
            kolicina: Number(req.body.kolicina) || 1,
            placeno: Boolean(req.body.placeno),
            napomena: req.body.napomena || '',
            datum: new Date(),
            zadnjaIzmjena: new Date()
        };
        if (!dbReady() && useMemoryStore) {
            const lokalna = { _id: `local-${Date.now()}`, ...payload };
            fallbackNarudzbe.unshift(lokalna);
            await sendOrderEmails(lokalna);
            return res.json({ success: true, message: 'Narudžba zaprimljena (lokalno).' });
        }
        if (!dbReady() && !useMemoryStore) {
            return res.status(500).json({ error: 'Baza nije dostupna.' });
        }

        const nova = new Narudzba(payload);
        await nova.save();
        await sendOrderEmails(nova);
        res.json({ success: true, message: 'Narudžba zaprimljena!' });
    } catch (error) {
        res.status(500).json({ error: 'Greška pri spremanju.' });
    }
});

// 2. ADMIN: Vidi sve narudžbe
app.get('/api/admin/narudbe', async (req, res) => {
    await connectDB();
    if (!authorize(req, res)) return;

    try {
        if (!dbReady() && useMemoryStore) {
            return res.json(fallbackNarudzbe);
        }
        if (!dbReady() && !useMemoryStore) {
            return res.status(503).json({ error: 'Baza nije dostupna.' });
        }

        const narudzbe = await Narudzba.find().sort({ datum: -1 });
        res.json(narudzbe);
    } catch (error) {
        res.status(500).json({ error: 'Greška pri dohvatu.' });
    }
});

// 3. ADMIN: Ažuriraj status / plaćanje / napomenu
app.patch('/api/admin/narudbe/:id', async (req, res) => {
    await connectDB();
    if (!authorize(req, res)) return;

    const allowedUpdates = {};
    if (req.body.status && STATUSI.includes(req.body.status)) {
        allowedUpdates.status = req.body.status;
    }
    if (typeof req.body.placeno === 'boolean') {
        allowedUpdates.placeno = req.body.placeno;
    }
    if (typeof req.body.napomena === 'string') {
        allowedUpdates.napomena = req.body.napomena;
    }

    if (!Object.keys(allowedUpdates).length) {
        return res.status(400).json({ error: 'Nema valjanih izmjena.' });
    }
    allowedUpdates.zadnjaIzmjena = new Date();

    try {
        if (!dbReady() && useMemoryStore) {
            const updated = touchFallback(req.params.id, allowedUpdates);
            if (!updated) return res.status(404).json({ error: 'Nije pronađeno.' });
            return res.json(updated);
        }
        if (!dbReady() && !useMemoryStore) {
            return res.status(503).json({ error: 'Baza nije dostupna.' });
        }

        const updated = await Narudzba.findByIdAndUpdate(req.params.id, allowedUpdates, { new: true });
        if (!updated) return res.status(404).json({ error: 'Nije pronađeno.' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Greška pri ažuriranju.' });
    }
});

// 4. ADMIN: Brisanje narudžbe
app.delete('/api/admin/narudbe/:id', async (req, res) => {
    await connectDB();
    if (!authorize(req, res)) return;

    try {
        if (!dbReady() && useMemoryStore) {
            const idx = fallbackNarudzbe.findIndex(n => n._id === req.params.id);
            if (idx === -1) return res.status(404).json({ error: 'Nije pronađeno.' });
            fallbackNarudzbe.splice(idx, 1);
            return res.json({ success: true });
        }
        if (!dbReady() && !useMemoryStore) {
            return res.status(503).json({ error: 'Baza nije dostupna.' });
        }

        const deleted = await Narudzba.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Nije pronađeno.' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Greška pri brisanju.' });
    }
});

// Explicit route for root to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Pokretanje servera lokalno ili eksport za Vercel
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server radi na portu ${PORT}`));
}

module.exports = app;
