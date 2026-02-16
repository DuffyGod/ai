import { store } from '../store.js';

export default {
    render() {
        const settings = store.getSettings();
        const allColors = store.getAllColors();

        const colorCheckboxes = allColors.map(color => {
            const isChecked = settings.activeColors.includes(color.name) ? 'checked' : '';
            return `
                <label class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input type="checkbox" name="colors" value="${color.name}" ${isChecked} class="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary">
                    <div class="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style="background-color: ${color.value}"></div>
                    <span class="text-gray-700 font-medium">${color.name}</span>
                </label>
            `;
        }).join('');

        return `
            <div class="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 animate-fade-in flex flex-col" style="height: 80vh;">
                <div class="flex items-center justify-between mb-6 flex-shrink-0">
                    <h2 class="text-3xl font-bold text-gray-800">游戏设置</h2>
                    <button id="btn-back" class="text-gray-500 hover:text-gray-700 transition">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="space-y-6 flex-grow overflow-y-auto custom-scrollbar">
                    <!-- Time Setting -->
                    <div>
                        <label class="block text-lg font-semibold text-gray-700 mb-2">
                            每题限时 (秒)
                        </label>
                        <div class="flex items-center space-x-4 mb-3">
                            <input type="range" id="time-slider" min="1" max="10" step="0.1" value="${settings.timePerQuestion}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary">
                            <span id="time-display" class="text-2xl font-bold text-primary w-20 text-center">${settings.timePerQuestion.toFixed(1)}</span>
                        </div>
                        <div class="flex items-center space-x-2 mb-2">
                            <label class="text-sm text-gray-600">精确设置:</label>
                            <input type="number" id="time-input" min="1" max="10" step="0.1" value="${settings.timePerQuestion}" class="w-24 px-3 py-1 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-primary focus:border-transparent">
                            <span class="text-sm text-gray-600">秒</span>
                        </div>
                        <p class="text-sm text-gray-500 mt-1">时间越短，难度越高！支持0.1秒精度调整</p>
                    </div>

                    <!-- Colors Setting -->
                    <div>
                        <label class="block text-lg font-semibold text-gray-700 mb-4">
                            参与颜色 (至少选4个)
                        </label>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            ${colorCheckboxes}
                        </div>
                        <p id="color-error" class="text-red-500 text-sm mt-2 hidden">请至少选择4种颜色以保证游戏正常进行。</p>
                    </div>
                </div>

                <!-- Save Button -->
                <div class="pt-4 flex-shrink-0">
                    <button id="btn-save" class="w-full bg-primary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300">
                        保存设置
                    </button>
                </div>
            </div>
        `;
    },

    afterRender(router) {
        const settings = store.getSettings();
        const timeSlider = document.getElementById('time-slider');
        const timeDisplay = document.getElementById('time-display');
        const timeInput = document.getElementById('time-input');
        const btnSave = document.getElementById('btn-save');
        const btnBack = document.getElementById('btn-back');
        const colorError = document.getElementById('color-error');

        // Update time display on slider change
        timeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value).toFixed(1);
            timeDisplay.textContent = value;
            timeInput.value = value;
        });
        
        // Update slider and display on input blur (when user finishes input)
        timeInput.addEventListener('blur', (e) => {
            let value = parseFloat(e.target.value);
            
            // If invalid, reset to current slider value
            if (isNaN(value)) {
                value = parseFloat(timeSlider.value);
            } else {
                // Clamp value between 1 and 10
                value = Math.max(1, Math.min(10, value));
                value = Math.round(value * 10) / 10; // Round to 1 decimal place
            }
            
            timeSlider.value = value;
            timeDisplay.textContent = value.toFixed(1);
            e.target.value = value.toFixed(1);
        });
        
        // Allow real-time sync from input to display (without clamping)
        timeInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                timeDisplay.textContent = value.toFixed(1);
            }
        });

        // Back button
        btnBack.addEventListener('click', () => {
            router.navigate('/');
        });

        // Save settings
        btnSave.addEventListener('click', () => {
            const selectedColors = Array.from(document.querySelectorAll('input[name="colors"]:checked'))
                .map(cb => cb.value);

            if (selectedColors.length < 4) {
                colorError.classList.remove('hidden');
                return;
            }

            colorError.classList.add('hidden');

            // Final validation and clamping before save
            let timeValue = parseFloat(timeInput.value);
            if (isNaN(timeValue)) {
                timeValue = parseFloat(timeSlider.value);
            } else {
                timeValue = Math.max(1, Math.min(10, timeValue));
                timeValue = Math.round(timeValue * 10) / 10;
            }

            const newSettings = {
                ...settings,
                timePerQuestion: timeValue,
                activeColors: selectedColors
            };

            store.saveSettings(newSettings);
            
            // Show feedback
            const originalText = btnSave.textContent;
            btnSave.textContent = '已保存！';
            btnSave.classList.add('bg-green-500');
            btnSave.classList.remove('bg-primary');
            
            setTimeout(() => {
                router.navigate('/');
            }, 500);
        });
    }
};