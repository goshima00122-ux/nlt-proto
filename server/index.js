// server/index.js
const express = require('express');
const cors = require('cors');
const { validateInstance, validateGradeInput } = require('./validate');

const app = express();

/* ===== CORS =====
   Vercelのあなたの公開URLを許可します。
   必要なら 'https://あなたの別ドメイン' を追加してください。 */
const ALLOW = [
  'https://nlt-proto.vercel.app',   // あなたのVercelのURLに合わせて
  /\.vercel\.app$/                  // 同一プロジェクトの alias も許可
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // 直叩き許可
    const ok = ALLOW.some(a => a instanceof RegExp ? a.test(origin) : a === origin);
    return cb(null, ok);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
// preflight（'*' はExpress v5でNGなので必要なパスだけ）
app.options('/', cors());
app.options('/api/*', cors());

app.use(express.json());

/* ===== Utils ===== */
const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
const normalize = s => (s||'').trim().replace('＞','>').replace('＜','<').replace('＝','=');
const id = ()=>'q_' + Math.random().toString(36).slice(2);
const gcd = (a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a;};
const compare = (A,B,C,D)=> (A*D)>(C*B)?'>':(A*D)<(C*B)?'<':'=';

/* ===== Instance builders ===== */
const makeFractionCompare = (p, difficulty=1500)=>({
  instance_id:id(),
  template_id:'math_frac_compare_v1',
  render:{
    stem:`次の分数を通分して(>,<,=)で答えよ： ${p.A}/${p.B} と ${p.C}/${p.D}`,
    inputs:[{type:'text',name:'rel'}]
  },
  meta:{subject:'math',skills:['分数の通分','大小比較'],difficulty},
  payload:p
});

const makeGcd = (p, difficulty=1400)=>({
  instance_id:id(),
  template_id:'math_gcd_v1',
  render:{
    stem:`${p.X} と ${p.Y} の最大公約数を答えよ（半角数字）`,
    inputs:[{type:'text',name:'ans'}]
  },
  meta:{subject:'math',skills:['最大公約数'],difficulty},
  payload:p
});

/* ===== Health ===== */
app.get('/', (_,res)=>res.json({ok:true, service:'nlt-proto'}));

/* ===== Next problem =====
   ?type=fraction_compare|gcd
   ?level=1|2|3   （やさしい|ふつう|むずかしい）
*/
app.get('/api/v1/problems/next', (req,res)=>{
  const type  = String(req.query.type || 'fraction_compare').toLowerCase();
  const level = Number(req.query.level || 2); // 1..3
  let inst;

  // 難易度→数字レンジのマッピング
  const diffNum = level===1 ? 1200 : level===2 ? 1500 : 1800;

  if (type === 'fraction_compare') {
    const max = level===1 ? 7 : level===2 ? 12 : 20; // B,D を上げると通分が難しく
    const p = {
      A: rand(1, max-1), B: rand(2, max),
      C: rand(1, max-1), D: rand(2, max)
    };
    inst = makeFractionCompare(p, diffNum);
  } else if (type === 'gcd') {
    const max = level===1 ? 20 : level===2 ? 60 : 120;
    const p = { X: rand(6, max), Y: rand(6, max) };
    inst = makeGcd(p, diffNum);
  } else {
    return res.status(400).json({ error:'unknown type' });
  }

  if (!validateInstance(inst)) {
    return res.status(500).json({ error:'invalid instance', details: validateInstance.errors });
  }
  res.json(inst);
});

/* ===== Grade ===== */
app.post('/api/v1/attempts/grade', (req,res)=>{
  if (!validateGradeInput(req.body||{})) {
    return res.status(400).json({ error:'invalid input', details: validateGradeInput.errors });
  }
  const { answer, payload } = req.body;

  // 分数の大小
  if (typeof payload.A==='number' && typeof payload.B==='number') {
    const gt = compare(payload.A, payload.B, payload.C, payload.D);
    const ok = normalize(answer)===gt;
    const Ln = payload.A*payload.D, Rn = payload.C*payload.B, Dn = payload.B*payload.D;
    return res.json({
      correct: ok,
      ground_truth: gt,
      feedback_short: ok
        ? '正解！'
        : `不正解… 正しくは ${gt}。通分：${payload.A}/${payload.B}=${Ln}/${Dn}、${payload.C}/${payload.D}=${Rn}/${Dn}`
    });
  }

  // 最大公約数
  if (typeof payload.X==='number' && typeof payload.Y==='number') {
    const gt = String(gcd(payload.X, payload.Y));
    const ok = String(normalize(answer))===gt;
    return res.json({
      correct: ok,
      ground_truth: gt,
      feedback_short: ok ? '正解！' : `不正解… 正しくは ${gt}`
    });
  }

  res.status(400).json({ error:'unknown payload' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`API ready: http://localhost:${PORT}`));
