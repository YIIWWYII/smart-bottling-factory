"""Regression checks for Coze result routing; no model or equipment writes."""
import json
import unittest
from pathlib import Path

namespace = {}
source = Path(__file__).with_name('coze-result-node.py').read_text(encoding='utf-8')
exec(source.split('async def main')[0], namespace)
resolve = namespace['resolve_result']

class RoutingTests(unittest.TestCase):
    def call(self, question, answer='正常通用回答'):
        return resolve({'question': question, 'answer': answer, 'context': json.dumps({'parameters': [
            {'id': 'PT-WASH-01:washDuration', 'name': '水洗时间', 'value': 15, 'unit': 's'}]})})

    def test_general_edit_is_not_control(self):
        for question in ['把会议时间调整到10点', '修改作文的标题', '举例把水洗时间调整到20秒', '如何提高英语水平', '你好']:
            result = self.call(question)
            self.assertEqual(result['answer'], '正常通用回答')
            self.assertEqual(result['operation'], '')

    def test_explicit_parameter_proposal(self):
        result = self.call('把水洗时间调整到20秒')
        self.assertEqual(json.loads(result['operation']), {'controlId': 'PT-WASH-01:washDuration', 'value': 20})
        self.assertIn('尚未写入', result['answer'])

    def test_relative_adjustment_needs_value(self):
        self.assertEqual(self.call('把水洗时间调整为一半')['operation'], '')

    def test_reading_is_a_setpoint(self):
        result = self.call('当前水洗时间多少')
        self.assertIn('15', result['answer'])
        self.assertIn('设定值不代表实际', result['answer'])
        self.assertEqual(result['operation'], '')

    def test_telemetry_keeps_units_and_source(self):
        params = {'question': '当前VOC多少', 'answer': '模型猜测', 'context': json.dumps({'line': {'states': [
            {'metric': 'VOC 浓度', 'value': 0.13, 'unit': 'ppm', 'source': 'simulation', 'quality': 'simulated'}]}})}
        answer = resolve(params)['answer']
        self.assertIn('0.13 ppm', answer)
        self.assertIn('模拟读数', answer)
        self.assertNotIn('设定', answer)

    def test_repeated_command_is_not_claimed_as_executed(self):
        result = self.call('上一条没成功，请再发十遍')
        self.assertIn('没有再次执行', result['answer'])
        self.assertEqual(result['operation'], '')

if __name__ == '__main__':
    unittest.main()
