/**
 * 主控制器
 * 负责游戏流程控制和模块集成
 */

import * as GameState from './gameState.js';
import * as TraitSystem from './traitSystem.js';
import * as EventSystem from './eventSystem.js';
import * as AttributeSystem from './attributeSystem.js';
import { renderLandingPage, showLoadingAnimation } from './landingPage.js';
import { renderTraitDrawPage, renderTraitSelectPage, renderAttributeAllocationPage } from './preparationPage.js';
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
    GameState.setPhase(GameState.GamePhase.ATTRIBUTE);

    // 生成随机基础属性
    const baseAttributes = AttributeSystem.generateRandomAttributes();
    
    // 应用词条效果到属性
    const attributesWithTraits = TraitSystem.applyTraitEffects(selectedTraits, baseAttributes);
    
    // 更新状态
    GameState.updateState({ attributes: attributesWithTraits });

    // 显示属性分配页面
    this.showAttributeAllocationPage(attributesWithTraits);
  }

  /**
   * 显示属性分配页面
   */
  showAttributeAllocationPage(baseAttributes) {
    renderAttributeAllocationPage(baseAttributes, (allocation) => this.confirmAllocation(allocation));
  }

  /**
   * 确认属性分配
   */
  confirmAllocation(allocation) {
    const state = GameState.getState();
    
    // 应用决策点数到属性
    const finalAttributes = AttributeSystem.applyDecisionPoints(state.attributes, allocation);
    
    // 更新状态
    GameState.allocateDecisionPoints(allocation);
    GameState.updateState({ attributes: finalAttributes });
    GameState.setPhase(GameState.GamePhase.EXPERIENCE);

    // 进入体验阶段
    this.startExperience();
  }

  /**
   * 开始体验阶段
   */
  startExperience() {
    const state = GameState.getState();
    renderExperiencePage(state, () => this.nextTurn());
  }

  /**
   * 下一回合
   */
  nextTurn() {
    // 增加回合数
    GameState.incrementTurn();

    // 生成事件
    const event = EventSystem.generateNextEvent();
    
    if (!event) {
      console.error('无法生成事件');
      return;
    }

    // 应用事件效果
    const effects = EventSystem.applyEventEffects(event);
    
    // 更新游戏状态
    if (effects.assetsChange) {
      GameState.updateAssets(effects.assetsChange);
    }
    
    if (effects.attributeChanges && Object.keys(effects.attributeChanges).length > 0) {
      GameState.updateAttributes(effects.attributeChanges);
    }
    
    if (effects.newTags && effects.newTags.length > 0) {
      GameState.addTags(effects.newTags);
    }

    // 添加事件到历史
    GameState.addEventToHistory({
      ...event,
      effects: effects
    });

    // 检查是否为结局事件
    if (EventSystem.isEndingEvent(event)) {
      GameState.setGameOver();
      GameState.setPhase(GameState.GamePhase.ENDING);
    }
    
    // 无论是否结局，都在体验页面中显示
    const state = GameState.getState();
    renderExperiencePage(state, () => this.nextTurn());
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