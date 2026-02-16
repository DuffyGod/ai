import HomeView from './views/home.js';
import GameView from './views/game.js';
import SettingsView from './views/settings.js';
import HistoryView from './views/history.js';

const routes = {
    '/': HomeView,
    '/game': GameView,
    '/settings': SettingsView,
    '/history': HistoryView
};

const router = {
    navigate(path) {
        const view = routes[path] || routes['/'];
        const app = document.getElementById('app');
        
        // Simple transition
        app.style.opacity = '0';
        
        setTimeout(() => {
            app.innerHTML = view.render();
            app.style.opacity = '1';
            if (view.afterRender) {
                view.afterRender(this);
            }
        }, 200);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    router.navigate('/');
});
