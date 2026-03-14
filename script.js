const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://anagranrulitbaby-production.up.railway.app';
const initData = tg.initData;

document.getElementById('start-btn').addEventListener('click', async () => {
    // 🔥 ПРОВЕРКА: если это сработает — код выполняется!
    alert('🎯 КНОПКА НАЖАТА! Код работает.');
    
    tg.MainButton.setText('⚔️ ПОДКЛЮЧЕНИЕ...');
    tg.MainButton.show();
    
    try {
        console.log('📡 Запрос на:', `${API_URL}/api/start`);
        
        const response = await fetch(`${API_URL}/api/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': initData
            }
        });
        
        console.log('📥 Статус:', response.status);
        const data = await response.json();
        console.log('📦 Ответ:', data);
        
        if (data.success) {
            alert(`✅ УСПЕХ! Баланс: ${data.balance}`);
        } else {
            alert('❌ Ошибка: ' + JSON.stringify(data));
        }
    } catch (error) {
        console.error('❌ Error:', error);
        alert('❌ ОШИБКА: ' + error.message);
    }
    
    tg.MainButton.hide();
});
