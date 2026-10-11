'use client';
import { ACTION_KEYS } from './dash-input';
import { SettingsPopover } from './SettingsPopover';
export function ControlsHelp({
  colony = false,
  onOpen,
}: {
  colony?: boolean;
  onOpen?: () => void;
}) {
  return (
    <SettingsPopover label="键位" onOpen={onOpen}>
      <strong>左手移动，右手动作</strong>
      <div className="controls-help-row">
        <kbd>W A S D</kbd>
        <span>移动，也可用方向键或鼠标</span>
      </div>
      {!colony && (
        <div className="controls-help-row">
          <kbd>空格</kbd>
          <span>冲刺 · Shift 潜行</span>
        </div>
      )}
      {!colony && (
        <div className="controls-help-row">
          <kbd>{ACTION_KEYS.skill}</kbd>
          <span>身体技能 / 第一能力</span>
        </div>
      )}
      <div className="controls-help-row">
        <kbd>{ACTION_KEYS.interact}</kbd>
        <span>
          {colony ? '采集、存放、建设和喂养' : '分享、采集、筑巢等情境互动'}
        </span>
      </div>
      {!colony && (
        <>
          <div className="controls-help-row">
            <kbd>{ACTION_KEYS.command}</kbd>
            <span>第二能力 / 指挥伙伴</span>
          </div>
          <div className="controls-help-row">
            <kbd>{ACTION_KEYS.learnedSkill}</kbd>
            <span>使用学会的 DNA 能力</span>
          </div>
          <div className="controls-help-row">
            <kbd>{ACTION_KEYS.feature}</kbd>
            <span>陆地结构动作</span>
          </div>
          <div className="controls-help-row">
            <kbd>{ACTION_KEYS.evolve}</kbd>
            <span>查看与孕育下一代</span>
          </div>
        </>
      )}
      <div className="controls-help-row">
        <kbd>Esc</kbd>
        <span>暂停 / 继续</span>
      </div>
      <small>动作按钮也可以直接点击。只有当前身体具备的动作才会生效。</small>
    </SettingsPopover>
  );
}
