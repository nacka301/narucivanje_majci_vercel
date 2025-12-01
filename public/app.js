const form = document.getElementById('orderForm');
const btn = document.getElementById('btnNaruci');
const successMessage = document.getElementById('successMessage');
const modelSelect = document.getElementById('model');
const orderButtons = document.querySelectorAll('.order-btn');
const scrollTriggers = document.querySelectorAll('[data-scroll]');
const successModal = document.getElementById('successModal');
const closeModal = document.getElementById('closeModal');
let modalTimer;
const nav = document.getElementById('mainNav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

const smoothScrollTo = (selector) => {
    const target = document.querySelector(selector);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

orderButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const selectedModel = button.getAttribute('data-model');
        if (selectedModel) {
            modelSelect.value = selectedModel;
        }
        smoothScrollTo('#order');
        form.querySelector('#ime').focus();
    });
});

scrollTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
        const destination = trigger.getAttribute('data-scroll');
        if (destination) {
            smoothScrollTo(destination);
            if (navLinks.classList.contains('is-open')) {
                toggleMobileNav();
            }
        }
    });
});

const toggleMobileNav = () => {
    navLinks.classList.toggle('is-open');
    document.body.classList.toggle('mobile-nav-open');
};

navToggle?.addEventListener('click', toggleMobileNav);

navLinks?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
        if (navLinks.classList.contains('is-open')) {
            toggleMobileNav();
        }
    });
});

window.addEventListener('scroll', () => {
    if (!nav) return;
    if (window.scrollY > 50) {
        nav.classList.add('glass-nav--scrolled');
    } else {
        nav.classList.remove('glass-nav--scrolled');
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Provjera košarice
    const modelValue = modelSelect.value;
    if (!modelValue || modelValue.trim() === '') {
        alert('Košarica je prazna! Dodajte najmanje jednu majicu.');
        return;
    }
    
    btn.innerText = 'Šaljem...';
    btn.disabled = true;

    const narudzba = {
        model: modelValue,
        ime_prezime: document.getElementById('ime').value,
        adresa: document.getElementById('adresa').value,
        grad: document.getElementById('grad').value,
        email: document.getElementById('email').value || undefined,
        telefon: document.getElementById('telefon').value,
        velicina: document.getElementById('velicina').value,
        kolicina: kosarica.length > 0 ? kosarica.reduce((sum, s) => sum + s.kolicina, 0) : Number(document.getElementById('kolicina').value)
    };

    try {
        const res = await fetch('/api/naruci', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(narudzba)
        });

        if (res.ok) {
            form.reset();
            kosarica = [];
            osvjeziPrikaz();
            successMessage.classList.remove('hidden');
            successModal.classList.remove('hidden');
            btn.innerText = 'ZAVRŠI NARUDŽBU (20 €)';
            btn.disabled = false;
            modalTimer = setTimeout(() => {
                successModal.classList.add('hidden');
            }, 10000);
        } else {
            alert('Greška. Pokušajte ponovno.');
            btn.disabled = false;
            btn.innerText = '🔴 ZAVRŠI NARUDŽBU';
        }
    } catch (err) {
        console.error(err);
        alert('Greška u povezivanju.');
        btn.disabled = false;
        btn.innerText = '🔴 ZAVRŠI NARUDŽBU';
    }
});

const hideModal = () => {
    if (!successModal) return;
    successModal.classList.add('hidden');
    if (modalTimer) {
        clearTimeout(modalTimer);
        modalTimer = null;
    }
};

closeModal?.addEventListener('click', hideModal);

successModal?.addEventListener('click', (event) => {
    if (event.target === successModal) {
        hideModal();
    }
});
