export default {
    render() {
        return `
            <div class="text-center space-y-8 animate-fade-in">
                <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-4">
                    颜色认知挑战
                </h1>
                <p class="text-xl text-gray-600 mb-2">
                    不要读字，要看颜色！<br>
                    挑战你的大脑反应速度。
                </p>
                <p class="text-sm text-gray-500 mb-8">
                    🧠 健脑神器 - 锻炼专注力与反应力
                </p>
                
                <div class="flex flex-col space-y-4 w-64 mx-auto">
                    <button id="btn-start" class="btn-active bg-primary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 flex items-center justify-center">
                        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        开始游戏
                    </button>
                    
                    <button id="btn-history" class="btn-active bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-full border border-gray-300 shadow-sm transition duration-300 flex items-center justify-center">
                        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        历史记录
                    </button>
                    
                    <button id="btn-settings" class="btn-active bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-full border border-gray-300 shadow-sm transition duration-300 flex items-center justify-center">
                        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        游戏设置
                    </button>
                </div>
            </div>
        `;
    },

    afterRender(router) {
        // 启动动态渐变背景
        this.startDynamicBackground();
        
        document.getElementById('btn-start').addEventListener('click', () => {
            this.stopDynamicBackground();
            router.navigate('/game');
        });
        document.getElementById('btn-history').addEventListener('click', () => {
            this.stopDynamicBackground();
            router.navigate('/history');
        });
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.stopDynamicBackground();
            router.navigate('/settings');
        });
    },
    
    startDynamicBackground() {
        const body = document.body;
        
        // 定义多组接近白色的浅色渐变方案（极低饱和度）
        const gradients = [
            'linear-gradient(135deg, #f8f9ff 0%, #faf8ff 100%)', // 极浅紫蓝
            'linear-gradient(135deg, #fff8f9 0%, #fffafa 100%)', // 极浅粉
            'linear-gradient(135deg, #f8fcff 0%, #f9feff 100%)', // 极浅蓝
            'linear-gradient(135deg, #f8fff9 0%, #fafffa 100%)', // 极浅绿
            'linear-gradient(135deg, #fffdf8 0%, #fffef9 100%)', // 极浅黄
            'linear-gradient(135deg, #f9f8ff 0%, #fdfcff 100%)', // 极浅紫
            'linear-gradient(135deg, #f8fffe 0%, #faffff 100%)', // 极浅青
            'linear-gradient(135deg, #fff9f8 0%, #fffbfa 100%)', // 极浅橙
            'linear-gradient(135deg, #fef8ff 0%, #fffaff 100%)', // 极浅粉紫
            'linear-gradient(135deg, #f8fff8 0%, #fafffe 100%)'  // 极浅薄荷
        ];
        
        let currentIndex = 0;
        
        // 设置初始渐变
        body.style.background = gradients[currentIndex];
        body.style.transition = 'background 3s ease-in-out';
        
        // 每5秒切换一次渐变
        this.backgroundInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % gradients.length;
            body.style.background = gradients[currentIndex];
        }, 5000);
    },
    
    stopDynamicBackground() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
        // 恢复默认背景
        document.body.style.background = '';
        document.body.style.backgroundColor = '#F9FAFB'; // bg-gray-50
    }
};