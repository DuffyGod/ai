import { store } from '../store.js';
import { formatDate } from '../utils.js';

export default {
    render() {
        const history = store.getHistory();

        let content = '';
        if (history.length === 0) {
            content = `
                <div class="text-center py-12">
                    <p class="text-gray-500 text-lg">暂无游戏记录，快去挑战吧！</p>
                </div>
            `;
        } else {
            const rows = history.map((record, index) => {
                const scorePercent = Math.round((record.score / record.total) * 100);
                let scoreColor = 'text-red-500';
                if (scorePercent >= 80) scoreColor = 'text-green-500';
                else if (scorePercent >= 60) scoreColor = 'text-yellow-500';

                return `
                    <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td class="py-4 px-6 text-sm text-gray-600">${formatDate(record.timestamp)}</td>
                        <td class="py-4 px-6 text-sm font-bold ${scoreColor}">${record.score} / ${record.total}</td>
                        <td class="py-4 px-6 text-sm text-gray-600">${(record.timePerQuestion || 3).toFixed(1)}秒/题</td>
                    </tr>
                `;
            }).join('');

            content = `
                <div class="overflow-hidden rounded-xl border border-gray-200">
                    <table class="min-w-full bg-white">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">得分</th>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设置</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        return `
            <div class="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 animate-fade-in h-[80vh] flex flex-col">
                <div class="flex items-center justify-between mb-6 flex-shrink-0">
                    <h2 class="text-3xl font-bold text-gray-800">历史记录</h2>
                    <button id="btn-back" class="text-gray-500 hover:text-gray-700 transition">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="flex-grow overflow-y-auto custom-scrollbar">
                    ${content}
                </div>
            </div>
        `;
    },

    afterRender(router) {
        document.getElementById('btn-back').addEventListener('click', () => {
            router.navigate('/');
        });
    }
};