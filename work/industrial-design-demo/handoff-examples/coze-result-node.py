import json
import re


def resolve_result(params):
    question = params.get('question', '')
    context = json.loads(params.get('context') or '{}')
    answer = params.get('answer', '')
    parsed = None
    try:
        parsed = json.loads(answer.strip().removeprefix('```json').removesuffix('```'))
        if isinstance(parsed, dict) and isinstance(parsed.get('answer'), str):
            answer = parsed['answer']
    except (ValueError, TypeError):
        pass
    if context.get('agentProtocol') == 1:
        if not isinstance(parsed, dict) or not isinstance(parsed.get('tool_calls'), list):
            raise ValueError('Missing agent tool protocol')
        return {'answer': json.dumps(parsed, ensure_ascii=False), 'operation': ''}
    aliases = {
        'PK-ARM-01:pickRate': ['机械臂抓取节拍', '抓取节拍', '取放速度'],
        'PK-GRIP-01:gripForce': ['夹爪夹持力', '夹持力', '夹持力度'],
    }
    matches = [p for p in context.get('parameters', [])
               if any(label and label in question for label in aliases.get(p['id'], [p['name']]))]
    adjustment = re.search(r'(?:调整|设定|设置|改成|改为|调到|调成|调为|修改)', question)
    result = {'answer': answer, 'operation': ''}
    discussion_only = re.search(r'举例|假设|解释|作文|文章|通知|标题|翻译|不要修改|不修改', question)
    if matches and not discussion_only and re.search(r'减少|增加|提高|降低|一半|一倍', question):
        result['answer'] = '请明确调整后的具体数值。相对调整尚未生成设备操作，也没有执行。'
        return result
    if re.search(r'再发|重发|重复执行|重新执行', question):
        result['answer'] = '请先核实上一条操作记录和设备回读，避免重复下发。当前没有再次执行；请提供具体操作和目标值。'
        return result
    if adjustment and matches and not discussion_only:
        # Only a single explicit target is handled; no guesses, relative changes or batch writes.
        tail = question[adjustment.end():]
        numbers = re.findall(r'(?<![\d.])-?\d+(?:\.\d+)?', tail)
        if len(matches) != 1 or len(numbers) != 1 or re.search(r'增加|减少|提高|降低|一半|一倍', question):
            result['answer'] = '请明确一个参数名称和调整后的数值，例如“把机械臂抓取节拍调整到10瓶/min”。'
            return result
        p, value = matches[0], float(numbers[0])
        result['operation'] = json.dumps({'controlId': p['id'], 'value': value}, ensure_ascii=False)
        result['answer'] = f"建议将{p['name']}从 {p.get('value')} 调整为 {value:g} {p.get('unit', '')}。尚未写入，请核对后确认。"
    elif matches and any(word in question for word in ['多少', '当前', '目前', '查看', '查询']):
        result['answer'] = '当前设定：' + '；'.join(f"{p['name']} {p.get('value', '未知')} {p.get('unit', '')}" for p in matches) + '。设定值不代表实际测量值。'
    elif any(word in question for word in ['多少', '当前', '目前', '查看', '查询']):
        readings = [r for r in context.get('line', {}).get('states', [])
                    if r.get('metric') and (r['metric'] in question or
                    (r['metric'] == 'VOC 浓度' and 'VOC' in question.upper()))]
        if readings:
            parts = []
            for r in readings:
                if r.get('value') is None or r.get('quality') in ['offline', 'stale', 'invalid']:
                    parts.append(f"{r['metric']}：暂无有效读数")
                else:
                    source = '模拟读数' if r.get('source') == 'simulation' else '设备读数'
                    parts.append(f"{r['metric']}：{r['value']} {r.get('unit', '')}（{source}）")
            result['answer'] = '；'.join(parts) + '。'
    return result


async def main(args: Args) -> Output:
    return resolve_result(args.params)
