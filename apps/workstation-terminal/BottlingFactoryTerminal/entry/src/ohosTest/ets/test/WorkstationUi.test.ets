import { describe, expect, it, Level } from '@ohos/hypium'
import { abilityDelegatorRegistry, Driver, ON } from '@kit.TestKit'
import { UIAbility, Want } from '@kit.AbilityKit'

const delegator: abilityDelegatorRegistry.AbilityDelegator = abilityDelegatorRegistry.getAbilityDelegator()

export default function workstationUiTest() {
  describe('WorkstationUiP0', () => {
    it('opensCurrentStageBeforeReadOnlyControls', Level.LEVEL2, async (done: () => void) => {
      const driver: Driver = Driver.create()
      const bundleName: string = abilityDelegatorRegistry.getArguments().bundleName
      const want: Want = { bundleName: bundleName, abilityName: 'EntryAbility' }
      await delegator.startAbility(want)
      await driver.waitForIdle(2000, 5000)
      const ability: UIAbility = await delegator.getCurrentTopAbility()
      expect(ability.context.abilityInfo.name).assertEqual('EntryAbility')
      await driver.assertComponentExist(ON.text('工位工作台'))
      const stage = await driver.findComponent(ON.text('预处理'))
      await stage.click()
      await driver.waitForIdle(2000, 5000)
      await driver.assertComponentExist(ON.text('实时作业画面'))
      await driver.assertComponentExist(ON.id('workstation-scene-2d'))
      await driver.assertComponentExist(ON.id('workstation-scene-3d'))
      await driver.assertComponentExist(ON.text('本站调参与控制'))
      await driver.assertComponentExist(ON.text('未登录 · READ ONLY'))
      done()
    })
  })
}
