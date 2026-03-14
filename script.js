const tg = window.Telegram.WebApp;
tg.expand();

document.getElementById('start-btn').addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('heavy');
    alert('🎮 Игра загружается...');
});

const userName = tg.initDataUnsafe.user?.first_name || 'Игрок';
document.getElementById('user-info').innerText = `Игрок: ${userName}`;