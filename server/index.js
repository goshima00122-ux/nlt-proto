// server/index.js（JSONスキーマ検証入り・require版）
const express = require('express');
const cors = require('cors');
const { validateInstance, validateGradeInput } = require('./validate'); // ★追加

const app = express();
app.use(cors());
app.use(express.json());

// ユーティリティ
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function compare(A, B, C, D) { const L = A * D, R = C * B; return L > R ? '>' : L < R ? '<' : '='; }
function normalize(s) { return (s || '').trim().replace('＞','>').replace('＜','<'); }

// 次の問題を返す
app.get('/api/v1/problems/next', (req, res) => {
  const p = { A: rand(1,9), B: rand(2,9), C: rand(1,9), D: rand(2,9) };
  const inst = {
    instance_id: 'q_' + Math.random().toString(36).slice(2),
    template_id: 'math_frac_compare_v1',
    render: {
      stem: `次の分数を通分して(>,<,=)で答えよ： ${p.A}/${p.B} と ${p.C}/${p.D}`,
      inputs: [{ type: 'text', name: 'rel' }]
    },
    meta: { subject: 'math', skills: ['分数の通分','大小比較'], difficulty: 1500 },
    payload: p
  };

  // ★応答の形を検証（壊れてたら返さない）
  if (!validateInstance(inst)) {
    console.error('instance invalid:', validateInstance.errors);
    return res.status(500).json({ error: 'Invalid instance shape' });
  }
  res.json(inst);
});

// 採点
app.post('/api/v1/attempts/grade', (req, res) => {
  // ★入力の形を検証（欠落・型違いを弾く）
  if (!validateGradeInput(req.body || {})) {
    return res.status(400).json({ error: 'Invalid input', details: validateGradeInput.errors });
  }

  const { answer, payload } = req.body;
  const gt = compare(payload.A, payload.B, payload.C, payload.D);
  const ok = normalize(answer) === gt;

  const leftN  = payload.A * payload.D, rightN = payload.C * payload.B;
  const leftD  = payload.B * payload.D, rightD = payload.D * payload.B;

  res.json({
    correct: ok,
    ground_truth: gt,
    feedback_short: ok
      ? '正解！'
      : `不正解… 正しくは ${gt}。通分すると ${payload.A}/${payload.B} = ${leftN}/${leftD}、 ${payload.C}/${payload.D} = ${rightN}/${rightD}`
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ready: http://localhost:${PORT}`));
