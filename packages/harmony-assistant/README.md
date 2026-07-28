# HarmonyOS Shared Assistant

`@bottling/harmony-assistant` is the only ArkUI assistant implementation used by the digital display, workstation terminal, and admin console. It is a HAR, not a standalone HAP.

This package follows `contracts/assistant-host-contract.md` from `codex/ai-architecture@53b375b`.

## Local dependency

Add the dependency to each App's `entry/oh-package.json5`:

```json5
{
  "dependencies": {
    "@bottling/harmony-assistant": "file:../../../../packages/harmony-assistant/harmonyassistant"
  }
}
```

Each host HAP must declare `ohos.permission.INTERNET`; the HAR also declares it, but final network permission is verified on the host application.

Import only through the package name:

```typescript
import {
  AssistantController,
  AssistantDock,
  AssistantHostAdapter,
  AssistantSelectionPublisher,
  AssistantVisibilityPublisher,
  AssistantEntityType,
  createSelection
} from '@bottling/harmony-assistant'
```

The host owns one `AssistantSelectionPublisher` and one `AssistantVisibilityPublisher`, implements `AssistantHostAdapter`, and constructs one `AssistantController`.

## Host adapter

```typescript
class DisplayAssistantHostAdapter implements AssistantHostAdapter {
  readonly sourceApp = 'DISPLAY'

  async getContext(): Promise<AssistantContext> {
    return {
      contextVersion: 1,
      sourceApp: this.sourceApp,
      pageRoute: currentRoute,
      capturedAt: new Date().toISOString(),
      lineId: snapshot.lineId,
      stageCode: selectedStageCode,
      stateVersion: snapshot.stateVersion,
      dataGeneratedAt: snapshot.generatedAt,
      userRoleHint: currentUser.role
    }
  }

  async getAccessToken(): Promise<string | undefined> {
    return session.token
  }

  getServiceEndpoint(): AssistantServiceEndpoint {
    return {
      httpBaseUrl: apiConfig.aiHttpBaseUrl,
      wsBaseUrl: apiConfig.aiWsBaseUrl
    }
  }

  subscribeSelection(listener: AssistantSelectionListener): AssistantSubscription {
    return selectionPublisher.subscribe(listener)
  }

  subscribeVisibility(listener: AssistantVisibilityListener): AssistantSubscription {
    return visibilityPublisher.subscribe(listener)
  }

  async navigateToEntity(entity: AssistantEntityRef): Promise<AssistantNavigationResult> {
    return routeToEntity(entity)
  }
}
```

`getContext()` is called before every send and retry. Do not cache an old startup snapshot. Tokens are only placed in the `Authorization` header and must not be written into context, messages, logs, or local storage.

## Mounting

Mount `AssistantDock` as the last item in the page root `Stack` so it appears above business content:

```typescript
Stack({ alignContent: Alignment.TopEnd }) {
  // Existing business page.
  AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
    .margin({ top: 16, right: 16 })
}
```

Publish page visibility from lifecycle methods:

```typescript
aboutToAppear(): void {
  visibilityPublisher.publish('VISIBLE')
}

aboutToDisappear(): void {
  selectionPublisher.clear(currentRoute, 'ARKUI')
  visibilityPublisher.publish('HIDDEN')
}
```

Call `controller.dispose()` when the adapter is permanently released.

## Selection

For a device, product, text fragment, KPI, alarm, or knowledge document click, create a stable selection and publish it through the host publisher:

```typescript
const selection = createSelection(
  AssistantEntityType.DEVICE,
  deviceCode,
  deviceName,
  'ARKUI',
  currentRoute,
  snapshot.stateVersion,
  [
    { code: 'status', label: '状态', displayValue: deviceStatus },
    { code: 'speed', label: '速度', displayValue: speedText, unit: '瓶/分钟' }
  ]
)
selectionPublisher.publish(selection)
```

Stable ID rules:

- `LINE`: backend `lineId`.
- `STAGE`: backend `stageCode`; include `lineId` in host context when there are multiple lines.
- `DEVICE`: backend `deviceCode`.
- `PRODUCT`: backend `traceCode`.
- `PARAMETER`: `deviceCode:parameterCode`.
- `KPI`: `lineId:kpiCode` or `stageCode:kpiCode`.
- `KNOWLEDGE_DOCUMENT`: AI center `knowledgeId`.
- `TEXT_FRAGMENT`: `pageRoute:ownerEntityId:fieldCode`.

Never use list indexes, ArkUI temporary component IDs, Three.js `uuid/name`, display text, or click-time UUIDs as entity IDs. `fields` must only contain values already authorized and visible on the current page.

## Boundary

The assistant package never imports production command repositories and never exposes command, manual-lock release, knowledge approval, or device MQTT APIs. The three host apps must not copy this UI, implement their own AI client, directly call `/assistant/**`, or inject business control functions into the adapter.
