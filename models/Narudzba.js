const mongoose = require('mongoose');

const NarudzbaSchema = new mongoose.Schema({
    model: { type: String, required: true },
    ime_prezime: { type: String, required: true },
    adresa: { type: String, required: true },
    grad: { type: String, required: true },
    telefon: { type: String, required: true },
    email: { type: String },
    velicina: { type: String, required: true }, // S, M, L, XL...
    kolicina: { type: Number, default: 1 },
    status: {
        type: String,
        enum: ['zaprimljeno', 'priprema', 'poslano', 'isporuceno'],
        default: 'zaprimljeno'
    },
    placeno: { type: Boolean, default: false },
    napomena: { type: String, default: '' },
    datum: { type: Date, default: Date.now },
    zadnjaIzmjena: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Narudzba', NarudzbaSchema);
