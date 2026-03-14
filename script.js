const tg = window.Telegram.WebApp;
tg.expand();

// 🔗 URL вашего бэкенда
const API_URL = 'https://anagranrulitbaby-production.up.railway.app';

// Получаем initData для авторизации
const initData = tg.initData;

// 🎮 Кнопка "В Бой!"
document.getElementById('start-btn').addEventListener('click', async () => {
    tg.HapticFeedback.impactOccurred('heavy');
    tg.MainButton.setText('⚔️ НАЧИНАЕМ БОЙ...');
    tg.MainButton.show();
    
    try {
        // 📡 Отправляем запрос на сервер
        const response = await fetch(`${API_URL}/api/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': initData
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            tg.MainButton.setText(`✅ УСПЕХ! Баланс: ${data.balance} 💰`);
            document.getElementById('game-area').innerHTML = `
                <h2>🎁 Добро пожаловать, ${tg.initDataUnsafe.user?.first_name}!</h2>
                <p>💰 Ваш баланс: ${data.balance} монет</p>
                <button onclick="startBattle()">⚔️ Начать бой</button>
            `;
        } else {
            tg.MainButton.setText('❌ ОШИБКА');
            alert('Ошибка: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        tg.MainButton.setText('❌ ОШИБКА СОЕДИНЕНИЯ');
        alert('Не удалось подключиться к серверу');
    }
    
    setTimeout(() => tg.MainButton.hide(), 3000);
});

// ⚔️ Функция начала боя
async function startBattle() {
    tg.HapticFeedback.impactOccurred('medium');
    
    try {
        const response = await fetch(`${API_URL}/api/battle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': initData
            },
            body: JSON.stringify({
                enemyId: null,
                weapon: 'sword'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`⚔️ ПОБЕДА!\n💥 Урон: ${data.battle.damage}\n🏆 Награда: ${data.battle.reward} монет`);
        }
    } catch (error) {
        alert('Ошибка боя: ' + error.message);
    }
}

// Показываем информацию о пользователе
const userName = tg.initDataUnsafe.user?.first_name || 'Игрок';
document.getElementById('user-info').innerText = `Игрок: ${userName}`;
