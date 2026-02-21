/**
 * 主控制器
 * 负责游戏流程控制和模块集成
 */

import * as GameState from './gameState.js';
import * as TraitSystem from './traitSystem.js';
import * as EventSystem from './eventSystem.js';
import * as AttributeSystem from './attributeSystem.js';
import * as ParameterSystem from './parameterSystem.js';
import { renderLandingPage, showLoadingAnimation } from './landingPage.js';
import { renderTraitDrawPage, renderTraitSelectPage, renderDecisionAllocationPage } from './preparationPage.js';
import { renderExperiencePage, resetExperiencePage } from './experiencePage.js';

/**
 * 游戏主类
 */
class Game {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化游戏
   */
  async init() {
    if (this.initialized) return;

    showLoadingAnimation();

    try {
      // 加载游戏数据
      await TraitSystem.loadTraits();
      await EventSystem.loadEvents();

      this.initialized = true;

      // 显示落地页
      this.showLandingPage();
    } catch (error) {
      console.error('游戏初始化失败:', error);
      alert('游戏加载失败，请刷新页面重试');
    }
  }

  /**
   * 显示落地页
   */
  showLandingPage() {
    GameState.clearState();
    GameState.initState();
    renderLandingPage(() => this.startGame());
  }

  /**
   * 开始游戏
   */
  startGame() {
    // 初始化游戏状态
    GameState.initState();
    GameState.setPhase(GameState.GamePhase.TRAIT_DRAW);

    // 显示词条抽取页面
    this.showTraitDrawPage();
  }

  /**
   * 显示词条抽取页面
   */
  showTraitDrawPage() {
    renderTraitDrawPage(() => this.drawTraits());
  }

  /**
   * 抽取词条
   */
  drawTraits() {
    const drawnTraits = TraitSystem.drawTraits();
    GameState.setDrawnTraits(drawnTraits);
    GameState.setPhase(GameState.GamePhase.TRAIT_SELECT);

    // 显示词条选择页面
    this.showTraitSelectPage(drawnTraits);
  }

  /**
   * 显示词条选择页面
   */
  showTraitSelectPage(traits) {
    renderTraitSelectPage(traits, (selectedTraits) => this.confirmTraits(selectedTraits));
  }

  /**
   * 确认选择的词条
   */
  confirmTraits(selectedTraits) {
    GameState.setSelectedTraits(selectedTraits);
    GameState.setPhase(GameState.GamePhase.DECISION);

    // 显示决策参数分配页面
    this.showDecisionAllocationPage();
  }

  /**
   * 显示决策参数分配页面
   */
  showDecisionAllocationPage() {
    renderDecisionAllocationPage((allocation) => this.confirmDecisionAllocation(allocation));
  }

  /**
   * 确认决策参数分配
   */
  confirmDecisionAllocation(allocation) {
    const state = GameState.getState();
    
    // 应用词条效果到决策参数
    const result = TraitSystem.applyNewTraitEffects(state.selectedTraits, allocation);
    
    // 更新决策参数
    GameState.updateDecisionParams(result.decisionParams);
    
    // 记录绑定的事件
    if (result.boundEvents && result.boundEvents.length > 0) {
      // 将绑定事件添加到启动阶段事件队列
      GameState.addLogicFlags(result.boundEvents.map(id => `bound_event_${id}`));
    }
    
    GameState.setPhase(GameState.GamePhase.EXPERIENCE);
    GameState.setStage(GameState.GameStage.STARTUP);

    // 进入体验阶段
    this.startExperience();
  }

  /**
   * 开始体验阶段
   */
  startExperience() {
    const state = GameState.getState();
    
    // 初始化能力属性为0（将通过启动阶段事件设置）
    const abilityParams = {
      foundation: 0,
      thinking: 0,
      plasticity: 0,
      performance: 0,
      principle: 0
    };
    GameState.setAbilityParams(abilityParams);
    
    // 初始化调节参数为0（将通过背景事件设置）
    const resourceParams = {
      money: 0,
      users: 0,
      data: 0
    };
    GameState.setResourceParams(resourceParams);
    
    // 初始化放大参数
    const amplifyParams = {
      coding: 0,
      text: 0,
      voice: 0,
      image: 0,
      video: 0,
      robot: 0,
      research: 0
    };
    GameState.setAmplifyParams(amplifyParams);
    
    // 初始化客观参数
    const objectiveParams = {
      market: 0,
      regulation: 0,
      reputation: 0,
      anxiety: 0
    };
    GameState.setObjectiveParams(objectiveParams);
    
    // 准备启动阶段事件队列（不立即生成）
    this.prepareStartupEventQueue();
    
    renderExperiencePage(GameState.getState(), () => this.nextTurn());
  }

  /**
   * 准备启动阶段事件队列
   */
  prepareStartupEventQueue() {
    const state = GameState.getState();
    
    // 使用EventSystem的统一接口准备事件队列
    const eventQueue = EventSystem.prepareStartupEvents(
      state.decisionParams,
      EventSystem.getAllEvents()
    );
    
    // 设置事件队列
    GameState.setEventQueue(eventQueue);
  }

  /**
   * 下一回合
   */
  nextTurn() {
    const state = GameState.getState();
    
    // 增加回合数
    GameState.incrementTurn();
    
    let event = null;
    
    try {
      // 如果在启动阶段，从事件队列中取出事件
      if (state.stage === GameState.GameStage.STARTUP) {
        const eventId = GameState.popEventFromQueue();
        
        console.log('启动阶段 - 从队列取出事件ID:', eventId);
        
        if (eventId) {
          // 使用EventSystem的统一接口获取并处理事件
          event = EventSystem.getNextStartupEvent(
            eventId,
            EventSystem.getAllEvents(),
            GameState.getState()
          );
        } else {
          // 启动阶段事件队列已空，进入成长阶段
          console.log('启动阶段事件队列已空，进入成长阶段');
          GameState.setStage(GameState.GameStage.GROWTH);
          // 生成成长阶段事件
          event = EventSystem.generateNextEvent();
        }
      } else {
        // 成长阶段和终结阶段
        
        // 检查是否需要进入终结阶段
        if (state.stage === GameState.GameStage.GROWTH && state.turn >= 16) {
          GameState.setStage(GameState.GameStage.ENDING);
        }
        
        // 生成事件
        event = EventSystem.generateNextEvent();
      }
      
      if (!event) {
        console.error('无法生成事件 - 当前状态:', {
          stage: state.stage,
          turn: state.turn,
          eventQueue: state.eventQueue
        });
        throw new Error('无法生成事件');
      }

      console.log('生成的事件:', event.name, event);

      // 应用事件效果
      const effects = EventSystem.applyEventEffects(event);
      
      // 添加事件到历史（包含回合数）
      GameState.addEventToHistory({
        ...event,
        turn: GameState.getState().turn,
        effects: effects
      });

      // 检查是否为结局事件
      if (EventSystem.isEndingEvent(event)) {
        GameState.setGameOver();
        GameState.setPhase(GameState.GamePhase.ENDING);
      }
      
      // 无论是否结局，都在体验页面中显示
      const updatedState = GameState.getState();
      renderExperiencePage(updatedState, () => this.nextTurn());
      
    } catch (error) {
      console.error('nextTurn执行出错:', error);
      alert('游戏运行出错，请查看控制台了解详情');
    }
  }

  /**
   * 返回落地页
   */
  returnToLanding(reservedTrait) {
    // 重置体验页面状态
    resetExperiencePage();
    
    // 保存保留词条
    if (reservedTrait) {
      GameState.saveReservedTrait(reservedTrait);
    } else {
      GameState.clearReservedTrait();
    }

    // 返回落地页
    this.showLandingPage();
  }
}

// 创建游戏实例
const game = new Game();

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
  game.init();
});

// 导出游戏实例（用于调试）
window.game = game;