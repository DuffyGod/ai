const STORAGE_KEY_SETTINGS = 'color_challenge_settings';
const STORAGE_KEY_HISTORY = 'color_challenge_history';

const DEFAULT_COLORS = [
    { name: '红色', value: '#EF4444' }, // red-500 更亮的红色
    { name: '绿色', value: '#10B981' }, // emerald-500 保持鲜艳
    { name: '蓝色', value: '#3B82F6' }, // blue-500 更亮的蓝色
    { name: '黄色', value: '#FBBF24' }, // amber-400 更亮更饱满的黄色
    { name: '紫色', value: '#8B5CF6' }, // violet-500 更亮的紫色
    { name: '粉色', value: '#EC4899' }, // pink-500 更亮的粉色
    { name: '黑色', value: '#1F2937' }, // gray-800 深灰色（纯黑在白底上太刺眼）
    { name: '橙色', value: '#F97316' }, // orange-500 更亮的橙色
    { name: '棕色', value: '#92400E' }, // amber-800 深棕色，与其他颜色有明显区分
];

const DEFAULT_SETTINGS = {
    timePerQuestion: 4.0, // seconds - 改为浮点数，从3秒改为4秒
    totalQuestions: 10,
    activeColors: DEFAULT_COLORS.map(c => c.name) // store names
};

export const store = {
    getSettings() {
        const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (saved) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
        return DEFAULT_SETTINGS;
    },

    saveSettings(settings) {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    },

    getAllColors() {
        return DEFAULT_COLORS;
    },

    getHistory() {
        const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
        return saved ? JSON.parse(saved) : [];
    },

    addHistory(record) {
        const history = this.getHistory();
        // Add new record to the beginning
        history.unshift({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...record
        });
        // Keep only last 50 records
        if (history.length > 50) {
            history.length = 50;
        }
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    }
};