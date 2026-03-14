require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

// 🔐 Безопасность
app.use(helmet());
app.use(cors({ origin: '*' })); // Потом ограничим
app.use(express.json());

// 🛡 Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // макс 100 запросов
    message: 'Too many requests'
});
app.use('/api/', limiter);

// 🔐 Проверка Telegram initData
const validateTelegramData = (initData) => {
    try {
        const secret = crypto.createHmac('sha256', 'WebAppData')
            .update(process.env.TELEGRAM_BOT_TOKEN).digest();
        
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        const dataCheckString = Array.from(urlParams.entries())
            .sort()
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        
        const computedHash = crypto.createHmac('sha256', secret)
            .update(dataCheckString)
            .digest('hex');
        
        return computedHash === hash;
    } catch (e) {
        return false;
    }
};

// 🛡 Middleware авторизации
const authMiddleware = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];
    if (!initData || !validateTelegramData(initData)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (userStr) {
        req.user = JSON.parse(decodeURIComponent(userStr));
    }
    next();
};

// 📌 Главная
app.get('/', (req, res) => {
    res.json({ 
        message: '🎁 GiftRaid API is running!',
        version: '1.0.0',
        status: 'secure'
    });
});

// 🎮 API: Начало игры
app.post('/api/start', authMiddleware, async (req, res) => {
    try {
        const telegramId = req.user.id;
        const username = req.user.username || req.user.first_name;
        
        // Подключение к БД
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        
        // Создаём/обновляем пользователя
        await pool.query(`
            INSERT INTO users (telegram_id, username, balance, created_at)
            VALUES ($1, $2, 1000, NOW())
            ON CONFLICT (telegram_id) DO UPDATE
            SET last_login = NOW()
        `, [telegramId, username]);
        
        res.json({ 
            success: true, 
            message: 'Welcome to GiftRaid!',
            balance: 1000
        });
        
        await pool.end();
    } catch (error) {
        console.error('Start error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ⚔️ API: Начало боя
app.post('/api/battle', authMiddleware, async (req, res) => {
    try {
        const telegramId = req.user.id;
        const { enemyId, weapon } = req.body;
        
        // Здесь будет логика боя
        const result = {
            winner: telegramId,
            reward: Math.floor(Math.random() * 100) + 50,
            damage: Math.floor(Math.random() * 500) + 100
        };
        
        res.json({ 
            success: true,
            battle: result
        });
    } catch (error) {
        console.error('Battle error:', error);
        res.status(500).json({ error: 'Battle failed' });
    }
});

// 💰 API: Баланс
app.get('/api/balance', authMiddleware, async (req, res) => {
    try {
        const telegramId = req.user.id;
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        
        const result = await pool.query(
            'SELECT balance FROM users WHERE telegram_id = $1',
            [telegramId]
        );
        
        const balance = result.rows[0]?.balance || 0;
        
        res.json({ success: true, balance });
        await pool.end();
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: 'Error' });
    }
});

// 🚀 Запуск
app.listen(PORT, () => {
    console.log(`🔐 GiftRaid Server running on port ${PORT}`);
    console.log(`🌐 URL: https://anagranrulitbaby-production.up.railway.app`);
});
