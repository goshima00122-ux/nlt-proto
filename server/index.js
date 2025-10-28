// server/index.js
// Node: v22 / Express v5 で動作確認
const express = require('express');
const cors = require('cors');
const Ajv = require('ajv');

// --- CORS 設定（必要に応じて許可ドメインを限定） ---
const corsOptions = {
  origin: [
    // フロント（Vercel）ドメインを許可
    'https://nlt-proto.vercel.app',
    // localhost 開発時
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  credentials: false,
};

// --- AJV 準備（厳格モード回避＆Union許可） ---
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });

// ------ バリデーションスキーマ ------
// 出題インスタンス（分数/最大公約数いずれも受けるために oneOf）
const fractionPayloadSchema = {
  type: 'object',
  properties: { A: { type: 'integer' }, B: { type: 'integer' }, C: { type: 'integer' }, D: { type: 'integer' } },
  required: ['A', 'B', 'C', 'D'],
  additionalProperties: false,
};

const gcdPayloadSchema = {
  type: 'object',
  properties: { X: { type: 'integer' }, Y: { type: 'integer' } },
  required: ['X', 'Y'],
  additionalProperties: false,
};

const instanceSchema = {
  type: 'object',
  properties: {
    instance_id: { type: 'string' },
    template_id: { type: 'string' }, // 'math_frac_compare_v1' | 'math_gcd_v1'
    render: {
      type: 'object',
      properties: {
        stem: { type: 'string', minLength: 1 },
        inputs: { type: 'array' }, // 将来拡張
      },
      required: ['stem'],
      additionalProperties: true,
    },
    meta: { type: 'object' },
    payload: {
      oneOf: [fractionPayloadSchema, gcdPayloadSchema],
    },
  },
  required: ['instance_id', 'template_id', 'render', 'payload'],
  additionalProperties: true,
};

const gradeInputSchema = {
  type: 'object',
  properties: {
    answer: { type: ['string', 'number'] },
    payload: { oneOf: [fractionPayloadSchema, gcdPayloadSchema] },
    template_id: { type: 'string' },
  },
  required: ['answer', 'payload', 'template_id'],
  additionalProperties: false,
};

const validateInstance = ajv.compile(instanceSchema);
const validateGradeInput = ajv.compile(gradeInputSchema);

// ------ ユーティリティ（問題生成など） ------
function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genFraction(difficulty = 'normal') {
  // 難易度に応じて範囲を変える
  const range = difficulty === 'easy' ? 7 : difficulty === 'hard' ? 19 : 11;
  let A = randint(1, range);
  let B = randint(2, range + 1);
  let C = randint(1, range);
  let D = randint(2, range + 1);
  // 同値ばかりだと退屈なので少し調整
  if (A * D === C * B) A += 1;
  return { A, B, C, D };
}

function genGcd(difficulty = 'normal') {
  const range = difficulty === 'easy' ? 30 : difficulty === 'hard' ? 120 : 60;
  let X = randint(10, range);
  let Y = randint(10, range);
  if (X === Y) X += 1;
  return { X, Y };
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// ------ アプリ起動 ------
const app = express();
// 先に JSON パーサ
app.use(express.json());

// /api 全体に CORS（OPTIONS も自動処理）
app.use('/api', cors(corsOptions));

// API ルーター
const api = express.Router();

// GET /api/v1/problems/next?unit=fraction|gcd&difficulty=easy|normal|hard
api.get('/v1/problems/next', (req, res) => {
  const unit = (req.query.unit || 'fraction').toString(); // 'fraction' | 'gcd'
  const difficulty = (req.query.difficulty || 'normal').toString(); // 'easy'|'normal'|'hard'

  let instance;
  if (unit === 'gcd') {
    const payload = genGcd(difficulty);
    instance = {
      instance_id: cryptoRandomId(),
      template_id: 'math_gcd_v1',
      render: {
        stem: `${payload.X} と ${payload.Y} の最大公約数を答えよ（半角数字）`,
      },
      meta: { subject: 'math', unit: 'gcd', difficulty },
      payload,
    };
  } else {
    const payload = genFraction(difficulty);
    instance = {
      instance_id: cryptoRandomId(),
      template_id: 'math_frac_compare_v1',
      render: {
        stem: `次の分数を通分して(>,<,=)で答えよ： ${payload.A}/${payload.B} と ${payload.C}/${payload.D}`,
      },
      meta: { subject: 'math', unit: 'fraction', difficulty },
      payload,
    };
  }

  if (!validateInstance(instance)) {
    return res.status(500).json({ error: 'instance invalid', details: validateInstance.errors });
  }
  return res.json(instance);
});

// POST /api/v1/grade
// body: { template_id, answer, payload }
api.post('/v1/grade', (req, res) => {
  const data = req.body;

  // もし Ajv で validateGradeInput を使っている場合は有効化
  if (typeof validateGradeInput === 'function' && !validateGradeInput(data)) {
    return res.status(400).json({ ok: false, reason: 'invalid-input', errors: validateGradeInput.errors });
  }

  const { template_id, answer, payload } = data;
  let correct = false;
  let expected;

  if (template_id === 'math_frac_compare_v1') {
    // 分数の大小： A/B と C/D を交差掛け算で比較
    const lhs = payload.A * payload.D;
    const rhs = payload.C * payload.B;
    expected = lhs > rhs ? '>' : lhs < rhs ? '<' : '=';
    correct = (String(answer).trim() === expected);

  } else if (template_id === 'math_gcd_v1') {
    // 最大公約数
    const g = (function gcd(x, y) {
      x = Math.abs(x); y = Math.abs(y);
      while (y) [x, y] = [y, x % y];
      return x;
    })(payload.X, payload.Y);
    expected = String(g);
    correct = (String(answer).trim() === expected);

  } else {
    return res.status(400).json({ ok: false, reason: 'unknown-template' });
  }

  return res.json({ ok: true, correct, expected });
});

// 404（/api の中だけでハンドリング）
api.use((req, res) => res.status(404).json({ error: 'not found' }));

// ルーターを /api にぶら下げ（CORS の後）
app.use('/api', api);

// ポートは Render が PORT を渡す：なければローカル 10000
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`API ready: http://localhost:${PORT}`);
});

// ランダムID（簡易）
function cryptoRandomId() {
  return 'q_' + Math.random().toString(36).slice(2, 10);
}
