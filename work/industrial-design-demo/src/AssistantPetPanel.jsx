import { BatteryCharging, ChevronRight, Coins, HardHat, Heart, Shirt, Wrench } from 'lucide-react';
import { petActions, petAttributes, petLevel, petLevelXp, petReward, petShop } from './assistant-pet';

const types = { supply: '道具', gear: '装备', outfit: '装扮' };
const statIcons = { energy: BatteryCharging, bond: Heart, condition: Wrench };

export default function AssistantPetPanel({ view, pet, preview, onAction, dispatch, showView }) {
  const level = petLevel(pet.xp);
  const inShop = view === 'pet-shop';
  const owned = Object.entries(petShop).filter(([id]) => pet.bag[id] > 0);
  return <section className="ai-pet-page" aria-label={inShop ? 'Token 商城' : '机器人养成'}>
    <div className="ai-pet-heading">
      <h2>{inShop ? 'Token 商城' : '机器人养成'}</h2>
      <span className="ai-pet-wallet"><Coins size={16} />{pet.tokens} Token 币</span>
      <button type="button" onClick={() => showView(inShop ? 'pet' : 'pet-shop')}>{inShop ? '返回养成' : '逛商城'}<ChevronRight size={14} /></button>
    </div>
    {inShop ? Object.entries(types).map(([kind, label]) => <section className="ai-pet-section" key={kind}>
      <h3>{label}</h3>
      <ul className="ai-pet-items">{Object.entries(petShop).filter(([, item]) => item.kind === kind).map(([id, item]) => {
        const Icon = kind === 'gear' ? HardHat : kind === 'outfit' ? Shirt : statIcons[item.attribute];
        const hasItem = kind !== 'supply' && Boolean(pet.bag[id]);
        return <li key={id}><Icon size={21} /><div><strong>{item.name}</strong><small>{item.attribute ? `${petAttributes[item.attribute]} +${item.amount}` : item.detail}</small></div>
          <button type="button" aria-label={`购买${item.name}，${item.price} Token 币`} disabled={hasItem || pet.tokens < item.price} onClick={() => dispatch({ type: 'buy', id })}>
            {hasItem ? '已拥有' : pet.tokens < item.price ? `${item.price} 币 · 不足` : `${item.price} 币购买`}
          </button></li>;
      })}</ul>
    </section>) : <>
      <div className="ai-pet-profile">
        {preview}
        <div className="ai-pet-profile-data">
          <strong>Lv. {level} · 巡检机器人</strong>
          <label><span>升级进度</span><span>{pet.xp % petLevelXp} / {petLevelXp} XP</span><progress max={petLevelXp} value={pet.xp % petLevelXp} aria-label="升级进度" /></label>
          <small>已对话 {pet.rounds} 轮 · 每轮 +{petReward.xp} XP、+{petReward.tokens} 币</small>
        </div>
      </div>
      <section className="ai-pet-section"><h3>属性</h3><div className="ai-pet-stats">{Object.entries(petAttributes).map(([id, label]) => {
        const Icon = statIcons[id];
        return <label key={id} data-stat={id}><Icon size={15} /><span>{label}</span><strong>{pet[id]}/100</strong><meter min={0} max={100} value={pet[id]} aria-label={label} /></label>;
      })}</div></section>
      <section className="ai-pet-section"><h3>互动动作</h3><div className="ai-pet-actions">
        {petActions.map((action) => <button type="button" key={action.id} disabled={level < action.level} onClick={() => onAction(action.id)}>{action.title}{level < action.level && <small>Lv. {action.level} 解锁</small>}</button>)}
        <button type="button" onClick={() => onAction('rest')}>原地休息 <small>体力 +8</small></button>
      </div></section>
      <section className="ai-pet-section"><h3>背包</h3>{!owned.length ? <p className="ai-pet-empty">背包为空</p> : <ul className="ai-pet-items">{owned.map(([id, item]) => {
        const isSupply = item.kind === 'supply';
        const wearing = pet[item.kind] === id;
        return <li key={id}><div><strong>{item.name}</strong><small>{isSupply ? `剩余 ${pet.bag[id]} 件 · ${petAttributes[item.attribute]} +${item.amount}` : wearing ? '已穿戴' : types[item.kind]}</small></div>
          <button type="button" disabled={isSupply && pet[item.attribute] >= 100} onClick={() => dispatch({ type: isSupply ? 'use' : 'equip', id })}>{isSupply ? pet[item.attribute] >= 100 ? '属性已满' : '使用' : wearing ? '卸下' : '穿戴'}</button></li>;
      })}</ul>}</section>
    </>}
  </section>;
}
