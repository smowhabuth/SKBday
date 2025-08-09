require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const app = express();

// Database setup
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB successfully!');
});

// User model
const User = mongoose.model('User', new mongoose.Schema({
    accessCode: { type: String, unique: true },
    name: String,
    isAdmin: { type: Boolean, default: false }
}));

// Comment model
const Comment = mongoose.model('Comment', new mongoose.Schema({
    day: Number,
    text: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
}));

// Passport configuration
passport.use(new LocalStrategy({
    usernameField: 'accessCode',
    passwordField: 'accessCode'
}, (accessCode, password, done) => {
    User.findOne({ accessCode })
        .then(user => {
            if (!user) {
                return done(null, false);
            }
            return done(null, user);
        })
        .catch(err => done(err));
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => done(null, user))
        .catch(err => done(err));
});

// Middleware
app.use('/css', express.static(__dirname + '/public/css'));
app.use('/js', express.static(__dirname + '/public/js'));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(expressLayouts);


app.set('view engine', 'ejs');
app.set('view options', { layout: true });
app.set('view cache', false);
app.set('layout', 'layout');

// Routes
app.get('/', (req, res) => {
    req.user ? res.redirect(`/day/1?code=${req.user.accessCode}`) : res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { query: req.query }));

app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Auth error:', err);
            return next(err);
        }
        if (!user) {
            console.log('Failed login attempt:', req.body.accessCode);
            return res.redirect('/login?error=invalid');
        }
        req.logIn(user, err => {
            if (err) return next(err);
            return res.redirect('/');
        });
    })(req, res, next);
});

app.get('/day/:dayNumber', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    
    const dayNumber = parseInt(req.params.dayNumber);
    if (dayNumber < 1 || dayNumber > 3) return res.redirect('/');
    
    const comments = await Comment.find({ day: dayNumber }).populate('author').sort({ createdAt: -1 });
    res.render(`day${dayNumber}`, { 
        user: req.user, 
        comments,
        dayNumber,
        nextDay: dayNumber < 3 ? dayNumber + 1 : null
    });
});

app.post('/comment', async (req, res) => {
    if (!req.user) return res.status(401).send('Not authenticated');
    
    const comment = new Comment({
        text: req.body.text,
        day: parseInt(req.body.day),
        author: req.user._id
    });
    
    await comment.save();
    res.redirect(`/day/${req.body.day}?code=${req.user.accessCode}`);
});

app.get('/generate-codes', async (req, res) => {
    const friends = [
        { name: "Sarah", code: "SZA42" },
        { name: "Mike", code: "MIK89" },
        { name: "Emily", code: "EMY33" }
    ];
    
    for (const friend of friends) {
        await User.findOneAndUpdate(
            { accessCode: friend.code },
            { name: friend.name, accessCode: friend.code },
            { upsert: true, new: true }
        );
    }
    
    const qrCodes = await Promise.all(friends.map(async friend => {
        const url = `${process.env.BASE_URL || 'http://localhost:3000'}/login?code=${friend.code}`;
        const qr = await QRCode.toDataURL(url);
        return { ...friend, qr, url };
    }));
    
    res.render('codes', { qrCodes });
});

// Admin page to view/add users (add this with your other routes)
app.get('/admin/users', async (req, res) => {
    try {
        const users = await User.find();
        res.render('admin-users', { users });
    } catch (err) {
        res.status(500).send('Error loading users');
    }
});

app.post('/admin/add-user', async (req, res) => {
    try {
        const { name, accessCode } = req.body;
        const user = new User({ name, accessCode: accessCode.toUpperCase() });
        await user.save();
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).send('Error adding user');
    }
});

app.get('/debug/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/generate-qr/:code', async (req, res) => {
    try {
        const url = `${process.env.BASE_URL || 'http://localhost:3000'}/login?code=${req.params.code}`;
        const qr = await QRCode.toDataURL(url);
        
        res.render('qr-code', { 
            qr, 
            url,
            user: await User.findOne({ accessCode: req.params.code })
        });
    } catch (err) {
        res.status(500).send('Error generating QR');
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
