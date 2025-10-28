// server/index.js
const express = require('express');
const cors = require('cors');
const Ajv = require('ajv');

const app = express();
const PORT = process.env.PORT || 10000;

// ---- CORS 設定（許可するオリジンを列挙）----
const allowlist = [
  'https://nlt-proto.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];
const corsOptions = {
  origin(origin, cb) {
    // ローカルのcurl/サーバ内など origin がないケースも許可
    if (!origin) return cb(null, true);
    cb(null, allowlist.includes(origin));
  }
};
// 先に JSON パース
app.use(express.json());

// プリフライト：ワイルドカードは使わず「全体」でも OK
app.options('*', cors(corsOptions));

// /api 以下専用のルーターを作ってマウント（★ /api/* を使わない）
const api = express.Router();
api.use(cors(corsOptions));

// ---- バリデーション（以前の validate.js を1ファイルにまとめ）----
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });

const fractionPayloadSchema = {
  type: 'object',
  properties: {
    A: { type: 'integer' },
    B: { type: 'integer' },
    C: { type: 'integer' },
    D: { type: 'integer' }
  },
  required: ['A', 'B', 'C', 'D'],
  additionalProperties: false
};

const gcdPayloadSchema = {
  type: 'object',
  properties: {
    X: { type: 'integer' },
    Y: { type: 'integer' }
  },
  required: ['X', 'Y'],
  additionalProperties: false
};

const instanceSchema = {
  type: 'object',
  properties: {
    instance_id: { type: 'string' },
    template_id: { type: 'string' },
    render: {
      type: 'object',
      properties: {
        stem: { type: 'string', minLength: 3 },
        inputs: { type: 'array', minItems: 1 }
      },
      required: ['stem', 'inputs'],
      additionalProperties: true
    },
    meta: { type: 'object' },
    // payload は分数 or GCD のどちらか
    payload: {
      oneOf: [fractionPayloadSchema, gcdPayloadSchema]
    }
  },
  required: ['instance_id', 'template_id', 'render', 'payload'],
  additionalProperties: true
};

const gradeInputSchema = {
  type: 'object',
  properties: {
    answer: { type: ['string', 'number'] },
    payload: { oneOf: [fractionPayloadSchema, gcdPayloadSchema] }
  },
  required: ['answer', 'payload'],
  additionalProperties: false
};

const validateInstance = ajv.compile(instanceSchema);
const validateGradeInput = ajv.compile(gradeInputSchema);

// ---- ユーティリティ ----
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// ---- 出題 API ----
// 例：/api/v1/problems/next?unit=fraction&difficulty=normal
api.get('/v1/problems/next', (req, res) => {
  const unit = String(req.query.unit || 'fraction');   // 'fraction' or 'gcd'
  const difficulty = String(req.query.difficulty || 'normal');

  let instance;
  if (unit === 'gcd') {
    // 最大公約数
    const X = randInt(12, 99);
    const Y = randInt(12, 99);
    instance = {
      instance_id: `g_${Date.now()}`,
      template_id: 'math_gcd_v1',
      render: {
        stem: `${X} と ${Y} の最大公約数を答えよ（半角数字）`,
        inputs: [{ type: 'text', name: 'gcd' }]
      },
      meta: { subject: 'math', unit, difficulty },
      payload: { X, Y }
    };
  } else {
    // 分数の大小
    const A = randInt(1, 9), B = randInt(2, 9);
    const C = randInt(1, 9), D = randInt(2, 9);
    instance = {
      instance_id: `f_${Date.now()}`,
      template_id: 'math_frac_compare_v1',
      render: {
        stem: `次の分数を通分して(>,<,=)で答えよ： ${A}/${B} と ${C}/${D}`,
        inputs: [{ type: 'text', name: 'rel' }]
      },
      meta: { subject: 'math', unit: 'fraction', difficulty },
      payload: { A, B, C, D }
    };
  }

  if (!validateInstance(instance)) {
    return res.status(500).json({ error: 'invalid_instance', detail: validateInstance.errors });
  }
  res.json(instance);
});

// ---- 採点 API ----
api.post('/v1/grade', (req, res) => {
  const body = req.body;
  if (!validateGradeInput(body)) {
    return res.status(400).json({ ok: false, error: 'bad_request', detail: validateGradeInput.errors });
  }

  const { answer, payload } = body;

  // GCD のとき
  if (payload && typeof payload.X === 'number' && typeof payload.Y === 'number') {
    const correct = gcd(payload.X, payload.Y);
    const ok = String(answer).trim() === String(correct);
    return res.json({ ok, correct, feedback: ok ? '正解！' : `正解は ${correct}` });
  }

  // 分数比較のとき
  const { A, B, C, D } = payload;
  const left = A / B;
  const right = C / D;
  const rel = left > right ? '>' : left < right ? '<' : '=';

  const user = String(answer).trim();
  const ok = user === rel;
  res.json({ ok, correct: rel, feedback: ok ? '正解！' : `正解は「${rel}」` });
});

// ルーターを /api にマウント（★ /api/* を使わない）
app.use('/api', api);

// 簡単なヘルスチェック
app.get('/', (_req, res) => res.send('API ready'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`API ready: http://localhost:${PORT}`);
});
