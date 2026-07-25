import { UIAbility, Want } from '@kit.AbilityKit'
import { window } from '@kit.ArkUI'
import { SessionStore } from '../service/SessionStore'

export default class EntryAbility extends UIAbility {
  onCreate(want: Want): void {
    SessionStore.initialize(this.context)
    console.info('[BottlingFactory] EntryAbility created')
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (error) => {
      if (error.code) {
        console.error(`[BottlingFactory] load page failed: ${JSON.stringify(error)}`)
      }
    })
  }

  onWindowStageDestroy(): void {
    console.info('[BottlingFactory] window destroyed')
  }
}
