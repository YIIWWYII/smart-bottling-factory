# HarmonyOS Shared Assistant

`@bottling/harmony-assistant` is the only ArkUI assistant implementation used by the digital display, workstation terminal, and admin console. It is a HAR, not a standalone HAP.

## Local dependency

Add the dependency to each App's `entry/oh-package.json5`:

```json5
{
  "dependencies": {
    "@bottling/harmony-assistant": "file:../../../../packages/harmony-assistant/harmonyassistant"
  }
}
```

Import only through the package name:

```typescript
import {
  AssistantController,
  AssistantDock,
  AssistantHostAdapter,
  AssistantSelectionPublisher,
  createSelection
} from '@bottling/harmony-assistant'
```

The host owns one `AssistantSelectionPublisher`, implements `AssistantHostAdapter`, and constructs one `AssistantController`. Mount `AssistantDock` as the last item in the page's root `Stack` so it appears above business content:

```typescript
Stack({ alignContent: Alignment.TopEnd }) {
  // Existing business page.
  AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
    .margin({ top: 16, right: 16 })
}
```

Call `controller.reportHostVisibility(true/false)` from page lifecycle methods and `controller.dispose()` when the host adapter is permanently released. A page change or entity deselection must call `AssistantSelectionPublisher.clear()`.

For a device, product, text fragment, or KPI click, create a stable selection and publish it through the host publisher:

```typescript
const selection = createSelection(
  AssistantEntityType.DEVICE,
  deviceCode,
  deviceName,
  'ARKUI',
  router.getState().path ?? '',
  stateVersion,
  deviceLabel
)
selectionPublisher.publish(selection)
```

The assistant package never imports production command repositories and never exposes command, manual-lock release, knowledge approval, or device MQTT APIs.
