import { describe, expect, it } from '@ohos/hypium'
import { FACTORY_STAGES } from '../main/ets/config/FactoryStages'
import { controlsForStage } from '../main/ets/config/WorkstationControls'
import { isFinalCommandStatus, roleAllows, shouldApplyStateVersion } from '../main/ets/service/WorkstationPolicy'

export default function localUnitTest() {
  describe('WorkstationP0Policy', () => {
    it('definesDistinctControlsForNineStages', 0, () => {
      expect(FACTORY_STAGES.length).assertEqual(9)
      FACTORY_STAGES.forEach(stage => {
        const controls = controlsForStage(stage.code)
        expect(controls.parameters.length + controls.actions.length > 0).assertTrue()
      })
      expect(controlsForStage('GAS_INSPECTION').parameters.some(item => item.commandType === 'SET_VOC_LIMIT')).assertFalse()
      expect(controlsForStage('WAREHOUSE_INBOUND').parameters.some(item => item.commandType === 'SET_WAREHOUSE_VOC_LIMIT')).assertFalse()
      expect(controlsForStage('AGV_TRANSPORT').actions.some(item => item.commandType === 'EMERGENCY_STOP')).assertFalse()
    })

    it('enforcesFourRoleHierarchy', 0, () => {
      expect(roleAllows('VIEWER', 'OPERATOR')).assertFalse()
      expect(roleAllows('OPERATOR', 'OPERATOR')).assertTrue()
      expect(roleAllows('OPERATOR', 'ENGINEER')).assertFalse()
      expect(roleAllows('ENGINEER', 'OPERATOR')).assertTrue()
      expect(roleAllows('ADMIN', 'ENGINEER')).assertTrue()
    })

    it('recognizesOnlyBackendFinalCommandStates', 0, () => {
      expect(isFinalCommandStatus('PENDING')).assertFalse()
      expect(isFinalCommandStatus('SENT')).assertFalse()
      expect(isFinalCommandStatus('ACKNOWLEDGED')).assertTrue()
      expect(isFinalCommandStatus('FAILED')).assertTrue()
      expect(isFinalCommandStatus('TIMEOUT')).assertTrue()
      expect(isFinalCommandStatus('CANCELLED')).assertTrue()
    })

    it('rejectsOutOfOrderSnapshotVersions', 0, () => {
      expect(shouldApplyStateVersion('FILLING', 20, 'FILLING', 19)).assertFalse()
      expect(shouldApplyStateVersion('FILLING', 20, 'FILLING', 20)).assertTrue()
      expect(shouldApplyStateVersion('FILLING', 20, 'PACKING', 1)).assertTrue()
    })
  })
}
