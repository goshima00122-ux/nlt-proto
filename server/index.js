// server/index.js
const express = require('express');
const cors = require('cors');

const app = express();

// ---------- CORS ----------
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// ---------- ユーティリティ ----------
function rid() {
  return 'id_' + Math.random().toString(36).slice(2, 10);
}
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// ---------- ルータ（/api 配下に集約） ----------
const api = express.Router();

// 動作確認
api.get('/v1/health', (_req, res) => res.json({ ok: true }));

// 出題API
// GET /api/v1/problems/next?unit=fraction|gcd&difficulty=easy|normal|hard
api.get('/v1/problems/next', (req, res) => {
  const unit = req.query.unit === 'gcd' ? 'gcd' : 'fraction';
  const difficulty = req.query.difficulty || 'normal';

  if (unit === 'fraction') {
    const A = 1 + Math.floor(Math.random() * 9);
    const B = 2 + Math.floor(Math.random() * 9);
    const C = 1 + Math.floor(Math.random() * 9);
    const D = 2 + Math.floor(Math.random() * 9);

    return res.json({
      instance_id: rid(),
      template_id: 'math_frac_compare_v1',
      render: { stem: `次の分数を通分して(>,<,=)で答えよ： ${A}/${B} と ${C}/${D}` },
      inputs: [{ type: 'text', name: 'rel' }],
      meta: { unit: 'fraction', difficulty },
      payload: { A, B, C, D }
    });
  }

  // gcd
  const X = 10 + Math.floor(Math.random() * 90);
  const Y = 10 + Math.floor(Math.random() * 90);

  return res.json({
    instance_id: rid(),
    template_id: 'math_gcd_v1',
    render: { stem: `${X} と ${Y} の最大公約数を答えよ（半角数字）` },
    inputs: [{ type: 'text', name: 'gcd' }],
    meta: { unit: 'gcd', difficulty },
    payload: { X, Y }
  });
});

// 採点API（正答 expected を返す）
api.post('/v1/grade', (req, res) => {
  try {
    const { template_id, answer, payload } = req.body || {};
    if (!template_id || !payload) {
      return res.status(400).json({ ok: false, reason: 'invalid-input' });
    }

    let expected = '-';
    if (template_id === 'math_frac_compare_v1') {
      const lhs = payload.A * payload.D;
      const rhs = payload.C * payload.B;
      expected = lhs > rhs ? '>' : lhs < rhs ? '<' : '=';
    } else if (template_id === 'math_gcd_v1') {
      expected = String(gcd(payload.X, payload.Y));
    } else {
      return res.status(400).json({ ok: false, reason: 'unknown-template' });
    }

    const correct = String(answer).trim() === String(expected);
    return res.json({ ok: true, correct, expected });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, reason: 'server-error' });
  }
});

app.use('/api', api);

// ---------- 起動 ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`API ready: http://localhost:${PORT}`);
});
