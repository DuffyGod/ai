import { store } from '../store.js';
import { generateQuestion, getRandomItem } from '../utils.js';

let gameState = {
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: 0,
    questions: [],
    timer: null,
    timeLeft: 0,
    settings: null,
    isActive: false,
    isProcessing: false,
    lastQuestionColor: null
};

export default {
    render() {
        return `
            <div id="game-container" class="w-full max-w-md mx-auto animate-fade-in flex flex-col" style="height: 85vh;">
                <!-- Header: Progress & Score -->
                <div class="flex justify-between items-center mb-3 bg-white p-3 rounded-xl shadow-sm flex-shrink-0">
                    <div class="flex flex-col">
                        <span class="text-xs text-gray-500 uppercase tracking-wider">进度</span>
                        <span id="progress-display" class="text-lg font-bold text-primary">1 / 10</span>
                    </div>

                    <div class="flex flex-col text-right">
                        <span class="text-xs text-gray-500 uppercase tracking-wider">得分</span>
                        <span id="score-display" class="text-lg font-bold text-green-500">0</span>
                    </div>
                </div>

                <!-- Timer Progress Bar -->
                <div class="mb-3 bg-white rounded-xl shadow-sm p-3 flex-shrink-0">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-gray-500 uppercase tracking-wider">剩余时间</span>
                        <span id="timer-text" class="text-sm font-bold text-gray-700">0.0s</span>
                    </div>
                    <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div id="timer-bar" class="h-full transition-all ease-linear rounded-full" style="width: 100%; background-color: #10B981;"></div>
                    </div>
                </div>

                <!-- Question Area -->
                <div class="bg-white rounded-2xl shadow-xl p-4 mb-3 text-center flex flex-col items-center justify-center relative overflow-hidden flex-grow" style="min-height: 200px;">
                    <div id="question-text" class="text-5xl md:text-6xl select-none transition-transform duration-300 transform hover:scale-105">
                        准备...
                    </div>
                    <p class="mt-4 text-gray-400 text-sm">请选择文字<span class="font-bold text-gray-600">实际显示</span>的颜色</p>
                </div>

                <!-- Options Area -->
                <div id="options-container" class="grid grid-cols-1 gap-2 flex-shrink-0">
                    <!-- Options will be injected here -->
                </div>
            </div>

            <!-- Game Over Modal (Hidden by default) -->
            <div id="game-over-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden opacity-0 transition-opacity duration-300">
                <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform scale-90 transition-transform duration-300" id="modal-content">
                    <h2 class="text-3xl font-bold text-gray-800 mb-2">挑战结束!</h2>
                    <div class="text-6xl mb-4">🎉</div>
                    
                    <div class="space-y-2 mb-8">
                        <p class="text-gray-600">最终得分</p>
                        <p class="text-5xl font-extrabold text-primary" id="final-score">0</p>
                        <p class="text-gray-400 text-sm">共 <span id="final-total">0</span> 题</p>
                        <p class="text-gray-500 text-sm mt-2">每题限时: <span id="final-time" class="font-semibold">0</span> 秒</p>
                        <p class="text-gray-400 text-xs mt-1">💡 可在设置中调整答题时间</p>
                    </div>

                    <div class="flex flex-col space-y-3">
                        <button id="btn-restart" class="w-full bg-primary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-300">
                            再玩一次
                        </button>
                        <button id="btn-home" class="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-xl border border-gray-200 transition duration-300">
                            返回主页
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender(router) {
        this.router = router;
        this.startGame();

        // Bind modal buttons
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.startGame();
        });
        document.getElementById('btn-home').addEventListener('click', () => {
            router.navigate('/');
        });
    },

    startGame() {
        // Reset State
        const settings = store.getSettings();
        const allColors = store.getAllColors();
        // Filter available colors based on settings
        const availableColors = allColors.filter(c => settings.activeColors.includes(c.name));

        gameState = {
            currentQuestionIndex: 0,
            score: 0,
            totalQuestions: settings.totalQuestions,
            questions: [],
            timer: null,
            timeLeft: settings.timePerQuestion,
            settings: settings,
            availableColors: availableColors,
            isActive: true,
            isProcessing: false,
            lastQuestionColor: null
        };

        // Hide modal
        const modal = document.getElementById('game-over-modal');
        modal.classList.add('hidden', 'opacity-0');
        modal.querySelector('#modal-content').classList.add('scale-90');
        modal.querySelector('#modal-content').classList.remove('scale-100');

        this.updateUI();
        this.nextQuestion();
    },

    nextQuestion() {
        if (!gameState.isActive) return;

        if (gameState.currentQuestionIndex >= gameState.totalQuestions) {
            this.endGame();
            return;
        }

        // Generate new question, passing the last question's color to avoid repetition
        const question = generateQuestion(gameState.availableColors, gameState.lastQuestionColor);
        gameState.currentQuestion = question;
        gameState.lastQuestionColor = question.color;
        
        // Reset Timer
        gameState.timeLeft = gameState.settings.timePerQuestion;
        this.startTimer();

        // Render Question
        this.renderQuestion(question);
        this.updateUI();
    },

    renderQuestion(question) {
        const questionTextEl = document.getElementById('question-text');
        const optionsContainer = document.getElementById('options-container');

        // Set Question Text and Color
        questionTextEl.textContent = question.text;
        questionTextEl.style.color = question.color;
        
        // Random Font - 移除transition-all，只保留transform过渡，减小字体大小，扩展到10种字体
        const fontClass = `font-random-${Math.floor(Math.random() * 10) + 1}`;
        questionTextEl.className = `text-5xl md:text-6xl select-none transition-transform duration-300 transform hover:scale-105 ${fontClass}`;

        // Render Options - 进一步减小按钮高度和字体
        optionsContainer.innerHTML = question.options.map(opt => `
            <button class="option-btn w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-1.5 px-3 rounded-xl border-2 border-gray-200 shadow-sm hover:border-primary hover:shadow-md transition duration-200 text-sm" data-answer="${opt}">
                ${opt}
            </button>
        `).join('');

        // Bind Click Events
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAnswer(e.target.dataset.answer));
        });
    },

    handleAnswer(selectedAnswer) {
        if (!gameState.isActive || gameState.isProcessing) return;
        
        gameState.isProcessing = true;
        this.stopTimer();

        const isCorrect = selectedAnswer === gameState.currentQuestion.answer;
        
        if (isCorrect) {
            gameState.score++;
            this.showFeedback(true, selectedAnswer);
            gameState.currentQuestionIndex++;
            
            // 正确答案快速过渡
            setTimeout(() => {
                gameState.isProcessing = false;
                this.nextQuestion();
            }, 300);
        } else {
            // 错误答案：高亮显示错误和正确答案，暂停1秒
            this.showFeedback(false, selectedAnswer);
            gameState.currentQuestionIndex++;
            
            // 错误答案暂停1秒后继续
            setTimeout(() => {
                gameState.isProcessing = false;
                this.nextQuestion();
            }, 1000);
        }
    },

    showFeedback(isCorrect, selectedAnswer) {
        const container = document.getElementById('game-container');
        const allButtons = document.querySelectorAll('.option-btn');
        const body = document.body;
        
        if (isCorrect) {
            // 正确答案：全屏柔和绿色背景闪烁
            body.style.transition = 'background-color 0.3s ease';
            body.style.backgroundColor = '#86EFAC'; // 更柔和的绿色 (green-300)
            
            setTimeout(() => {
                body.style.backgroundColor = '';
            }, 300);
            
            // 高亮正确选项
            allButtons.forEach(btn => {
                if (btn.dataset.answer === selectedAnswer) {
                    btn.classList.add('option-correct');
                }
            });
        } else {
            // 错误答案：全屏柔和红色背景闪烁
            body.style.transition = 'background-color 0.3s ease';
            body.style.backgroundColor = '#FCA5A5'; // 柔和的红色 (red-300)
            
            setTimeout(() => {
                body.style.backgroundColor = '';
            }, 300);
            
            allButtons.forEach(btn => {
                if (btn.dataset.answer === selectedAnswer) {
                    // 高亮用户选择的错误答案
                    btn.classList.add('option-wrong');
                } else if (btn.dataset.answer === gameState.currentQuestion.answer) {
                    // 高亮正确答案
                    btn.classList.add('option-correct');
                }
            });
        }
    },

    startTimer() {
        this.stopTimer();
        const timerBar = document.getElementById('timer-bar');
        const timerText = document.getElementById('timer-text');
        const totalTime = gameState.settings.timePerQuestion;
        
        // Reset progress bar
        timerBar.style.transition = 'none';
        timerBar.style.width = '100%';
        timerBar.style.backgroundColor = '#10B981'; // 绿色
        
        // Force reflow
        timerBar.offsetHeight;

        // Start animation
        timerBar.style.transition = `width ${totalTime}s linear, background-color ${totalTime}s linear`;
        timerBar.style.width = '0%';
        
        // Update time display with 1 decimal place
        timerText.textContent = gameState.timeLeft.toFixed(1) + 's';

        // Update every 100ms for smooth display
        let elapsed = 0;
        const updateInterval = 100; // 100ms
        
        gameState.timer = setInterval(() => {
            elapsed += updateInterval;
            gameState.timeLeft = Math.max(0, totalTime - elapsed / 1000);
            timerText.textContent = gameState.timeLeft.toFixed(1) + 's';
            
            // Calculate color based on remaining time percentage
            const percentage = gameState.timeLeft / totalTime;
            const color = this.getTimerColor(percentage);
            timerBar.style.backgroundColor = color;

            if (gameState.timeLeft <= 0) {
                this.handleTimeout();
            }
        }, updateInterval);
    },
    
    getTimerColor(percentage) {
        // 从绿色 (#10B981) 渐变到红色 (#EF4444)
        if (percentage > 0.5) {
            // 绿色到黄色
            const factor = (1 - percentage) * 2; // 0 to 1
            const r = Math.round(16 + (251 - 16) * factor);
            const g = Math.round(185 + (191 - 185) * factor);
            const b = Math.round(129 + (36 - 129) * factor);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // 黄色到红色
            const factor = (0.5 - percentage) * 2; // 0 to 1
            const r = Math.round(251 + (239 - 251) * factor);
            const g = Math.round(191 - 191 * factor);
            const b = Math.round(36 + (68 - 36) * factor);
            return `rgb(${r}, ${g}, ${b})`;
        }
    },

    stopTimer() {
        if (gameState.timer) {
            clearInterval(gameState.timer);
            gameState.timer = null;
        }
    },

    handleTimeout() {
        if (!gameState.isActive || gameState.isProcessing) return;
        
        gameState.isProcessing = true;
        this.stopTimer();
        
        // 显示超时提示
        this.showTimeoutMessage();
        
        // 全屏柔和红色背景闪烁
        const body = document.body;
        body.style.transition = 'background-color 0.3s ease';
        body.style.backgroundColor = '#FCA5A5'; // 柔和的红色 (red-300)
        
        setTimeout(() => {
            body.style.backgroundColor = '';
        }, 300);
        
        // 高亮正确答案
        const allButtons = document.querySelectorAll('.option-btn');
        allButtons.forEach(btn => {
            if (btn.dataset.answer === gameState.currentQuestion.answer) {
                btn.classList.add('option-correct');
            }
        });
        
        gameState.currentQuestionIndex++;
        
        // 超时暂停1秒后继续
        setTimeout(() => {
            gameState.isProcessing = false;
            this.nextQuestion();
        }, 1000);
    },
    
    showTimeoutMessage() {
        const questionArea = document.querySelector('#game-container > div:nth-child(2)');
        const message = document.createElement('div');
        message.className = 'timeout-message';
        message.textContent = '⏰ 超时了！';
        questionArea.style.position = 'relative';
        questionArea.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 1000);
    },

    updateUI() {
        document.getElementById('score-display').textContent = gameState.score;
        document.getElementById('progress-display').textContent = `${gameState.currentQuestionIndex + 1} / ${gameState.totalQuestions}`;
    },

    endGame() {
        gameState.isActive = false;
        this.stopTimer();

        // Save History
        store.addHistory({
            score: gameState.score,
            total: gameState.totalQuestions,
            timePerQuestion: gameState.settings.timePerQuestion
        });

        // Show Modal
        const modal = document.getElementById('game-over-modal');
        const modalContent = document.getElementById('modal-content');
        
        document.getElementById('final-score').textContent = gameState.score;
        document.getElementById('final-total').textContent = gameState.totalQuestions;
        document.getElementById('final-time').textContent = gameState.settings.timePerQuestion.toFixed(1);

        // 根据得分显示不同的表情和标题
        const modalTitle = modal.querySelector('h2');
        const modalEmoji = modal.querySelector('.text-6xl');
        
        // 移除之前可能存在的挑战提示
        const existingHint = modal.querySelector('.challenge-hint');
        if (existingHint) {
            existingHint.remove();
        }
        
        if (gameState.score <= 3) {
            // 得分0-3分：安慰
            const comfortEmojis = ['😢', '💪', '🤗', '😔', '🌈'];
            const comfortTitles = ['别灰心！', '加油！', '再试一次！', '继续努力！', '你可以的！'];
            const randomIndex = Math.floor(Math.random() * comfortEmojis.length);
            
            modalEmoji.textContent = comfortEmojis[randomIndex];
            modalTitle.textContent = comfortTitles[randomIndex];
            
            // 在时间提示下方添加延长时间的提示按钮
            const timeHint = modal.querySelector('.text-gray-400.text-xs.mt-1');
            if (timeHint) {
                const hintButton = document.createElement('button');
                hintButton.className = 'challenge-hint w-full text-sm text-white mt-3 font-semibold bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105';
                hintButton.innerHTML = '⏱️ 延长答题时间，降低游戏难度';
                hintButton.addEventListener('click', () => {
                    this.router.navigate('/settings');
                });
                timeHint.parentNode.insertBefore(hintButton, timeHint.nextSibling);
            }
        } else if (gameState.score <= 6) {
            // 得分4-6分：鼓励
            const encourageEmojis = ['👍', '💪', '🌟', '⭐', '🔥'];
            const encourageTitles = ['不错哦！', '继续加油！', '越来越好了！', '再接再厉！'];
            const randomIndex = Math.floor(Math.random() * encourageEmojis.length);
            
            modalEmoji.textContent = encourageEmojis[randomIndex];
            modalTitle.textContent = encourageTitles[randomIndex];
        } else if (gameState.score <= 9) {
            // 得分7-9分：称赞
            const praiseEmojis = ['🎉', '👏', '✨', '🌟', '🏆'];
            const praiseTitles = ['太棒了！', '做得好！', '真厉害！', '表现出色！', '非常优秀！'];
            const randomIndex = Math.floor(Math.random() * praiseEmojis.length);
            
            modalEmoji.textContent = praiseEmojis[randomIndex];
            modalTitle.textContent = praiseTitles[randomIndex];
        } else {
            // 得分10分：满分祝贺并提示提高难度
            const perfectEmojis = ['🏆', '👑', '💎', '🎊', '🌟'];
            const perfectTitles = ['完美！满分通关！', '太强了！全对！', '无敌！满分达成！', '神级表现！', '完美无缺！'];
            const randomIndex = Math.floor(Math.random() * perfectEmojis.length);
            
            modalEmoji.textContent = perfectEmojis[randomIndex];
            modalTitle.textContent = perfectTitles[randomIndex];
            
            // 在时间提示下方添加挑战按钮
            const timeHint = modal.querySelector('.text-gray-400.text-xs.mt-1');
            if (timeHint) {
                const hintButton = document.createElement('button');
                hintButton.className = 'challenge-hint w-full text-sm text-white mt-3 font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105';
                hintButton.innerHTML = '🎯 降低答题时间，挑战更高难度！';
                hintButton.addEventListener('click', () => {
                    this.router.navigate('/settings');
                });
                timeHint.parentNode.insertBefore(hintButton, timeHint.nextSibling);
            }
        }

        modal.classList.remove('hidden');
        // Trigger reflow for transition
        void modal.offsetWidth;
        
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-90');
        modalContent.classList.add('scale-100');
    }
};