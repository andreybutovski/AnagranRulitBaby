require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

// 🔐 Инициализация пула подключений
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 🔐 Безопасность
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// 🛡 Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
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

// 🗄 Инициализация БД (создание таблиц)
const initializeDatabase = async () => {
    try {
        console.log('🗄 Инициализация базы данных...');
        
        // Таблица пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT UNIQUE NOT NULL,
                username VARCHAR(255),
                balance INTEGER DEFAULT 1000,
                level INTEGER DEFAULT 1,
                experience INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP
            )
        `);
        console.log('✅ Таблица users создана');
        
        // Таблица персонажей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id SERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                rarity VARCHAR(50) DEFAULT 'common',
                power INTEGER DEFAULT 100,
                magic_power INTEGER DEFAULT 50,
                equipped_weapon VARCHAR(100),
                equipped_armor VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Таблица characters создана');
        
        // Таблица предметов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50),
                rarity VARCHAR(50),
                power_bonus INTEGER DEFAULT 0,
                price INTEGER DEFAULT 100
            )
        `);
        console.log('✅ Таблица items создана');
        
        // Инвентарь
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
                item_id INTEGER REFERENCES items(id),
                quantity INTEGER DEFAULT 1,
                acquired_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Таблица inventory создана');
        
        // История боёв
        await pool.query(`
            CREATE TABLE IF NOT EXISTS battles (
                id SERIAL PRIMARY KEY,
                player1_id BIGINT REFERENCES users(telegram_id),
                player2_id BIGINT REFERENCES users(telegram_id),
                winner_id BIGINT REFERENCES users(telegram_id),
                reward INTEGER,
                damage_dealt INTEGER,
                battle_time TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Таблица battles создана');
        
        // Покупки
        await pool.query(`
            CREATE TABLE IF NOT EXISTS purchases (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT REFERENCES users(telegram_id),
                amount INTEGER NOT NULL,
                stars INTEGER NOT NULL,
                payment_id VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Таблица purchases создана');
        
        // Индексы
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id)');
        console.log('✅ Индексы созданы');
        
        // Тестовые предметы
        await pool.query(`
            INSERT INTO items (name, type, rarity, power_bonus, price)
            VALUES 
            ('Меч Света', 'weapon', 'common', 50, 100),
            ('Щит Тьмы', 'armor', 'common', 30, 80),
            ('Кристалл Маны', 'magic', 'rare', 100, 250),
            ('Драконий Клинок', 'weapon', 'epic', 200, 500),
            ('Кольцо Бессмертия', 'magic', 'legendary', 500, 1000)
            ON CONFLICT DO NOTHING
        `);
        console.log('✅ Тестовые предметы добавлены');
        
        console.log('🎉 База данных полностью инициализирована!');
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error);
    }
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
        
        await pool.query(`
            INSERT INTO users (telegram_id, username, balance, created_at)
            VALUES ($1, $2, 1000, NOW())
            ON CONFLICT (telegram_id) DO UPDATE
            SET last_login = NOW()
        `, [telegramId, username]);
        
        res.json({ success: true, message: 'Welcome to GiftRaid!', balance: 1000 });
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
        
        const result = {
            winner: telegramId,
            reward: Math.floor(Math.random() * 100) + 50,
            damage: Math.floor(Math.random() * 500) + 100
        };
        
        res.json({ success: true, battle: result });
    } catch (error) {
        console.error('Battle error:', error);
        res.status(500).json({ error: 'Battle failed' });
    }
});

// 💰 API: Баланс
app.get('/api/balance', authMiddleware, async (req, res) => {
    try {
        const telegramId = req.user.id;
        const result = await pool.query(
            'SELECT balance FROM users WHERE telegram_id = $1',
            [telegramId]
        );
        const balance = result.rows[0]?.balance || 0;
        res.json({ success: true, balance });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: 'Error' });
    }
});

// 🚀 Запуск сервера
const startServer = async () => {
    await initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`🔐 GiftRaid Server running on port ${PORT}`);
        console.log(`🌐 URL: https://anagranrulitbaby-production.up.railway.app`);
    });
};

startServer();
