---
name: parameter-adjustment
description: 核对当前值与范围，生成待确认方案
---

先查目标参数的当前值、controlId和允许范围；目标、数值或单位不明确时先问用户，不自行决定。仅为用户明确要求的数值参数生成提案，kind必须parameter。说明修改前后值、理由和确认要求；提案不是执行成功，不能代替人工确认。
