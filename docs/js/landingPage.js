/**
 * 落地页UI模块
 * 负责渲染和管理落地页（主菜单）
 */

/**
 * 渲染落地页
 * @param {Function} onStartGame - 开始游戏的回调函数
 */
export function renderLandingPage(onStartGame) {
  const container = document.getElementById('app');
  
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div class="max-w-2xl w-full">
        <!-- 主卡片 -->
        <div class="bg-white rounded-lg shadow-xl p-8 md:p-12 text-center transition-all duration-300 hover:shadow-2xl">
          <!-- 标题 -->
          <h1 class="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-blue-600 mb-4">
            AI发展模拟器
          </h1>
          
          <!-- 副标题 -->
          <p class="text-lg text-gray-600 mb-8">
            体验AI产品从诞生到发展的完整生命周期
          </p>
          
          <!-- 游戏说明 -->
          <div class="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h2 class="text-lg font-bold text-gray-800 mb-3">游戏玩法</h2>
            <ul class="space-y-2 text-gray-600">
              <li class="flex items-start">
                <span class="text-blue-700 mr-2 font-bold">①</span>
                <span>抽取10个词条，选择3个作为AI的核心特性</span>
              </li>
              <li class="flex items-start">
                <span class="text-blue-700 mr-2 font-bold">②</span>
                <span>系统自动生成5项基础属性，分配10个决策点数用于影响后续事件的发展方向</span>
              </li>
              <li class="flex items-start">
                <span class="text-blue-700 mr-2 font-bold">③</span>
                <span>点击屏幕推进回合，体验AI的发展历程，属性会随事件动态变化</span>
              </li>
              <li class="flex items-start">
                <span class="text-blue-700 mr-2 font-bold">④</span>
                <span>触发结局后，可保留一个词条用于下一局</span>
              </li>
            </ul>
          </div>
          
          <!-- 开始游戏按钮 -->
          <button id="start-game-btn" class="w-full bg-gradient-to-r from-blue-800 to-blue-700 text-white text-lg font-bold py-4 px-8 rounded-md hover:from-blue-900 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg">
            开始游戏
          </button>
          
          <!-- 提示文本 -->
          <p class="text-sm text-gray-500 mt-6">
            内容取材自LLM相关新闻、趣事和公众评价
          </p>
        </div>
        
        <!-- With签名 -->
        <div class="text-center mt-6">
          <p class="text-gray-300 text-sm">
            由 <a href="https://with.woa.com/" class="text-blue-400 hover:text-blue-300 font-bold underline" target="_blank">With</a> 通过自然语言生成
          </p>
        </div>
      </div>
    </div>
  `;
  
  // 绑定开始游戏按钮事件
  const startBtn = document.getElementById('start-game-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      // 添加点击动画
      startBtn.classList.add('animate-pulse');
      setTimeout(() => {
        onStartGame();
      }, 200);
    });
  }
}

/**
 * 显示加载动画
 */
export function showLoadingAnimation() {
  const container = document.getElementById('app');
  
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
        <p class="text-white text-xl font-bold">加载中...</p>
      </div>
    </div>
  `;
}