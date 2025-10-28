// server/index.js
const express = require('express');
const cors = require('cors');
const { validateInstance, validateGradeInput } = require('./validate');

const app = express();

// CORS（Vercelの公開URLを許可。必要なら追加）
const ALLOW = ['https://nlt-proto.vercel.app', /\.vercel\.app$/];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOW.some(a => a instanceof RegExp ? a.test(origin) : a === origin)) return cb(null, true);
    cb(null, false);
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.options('*', cors());
app.use(express.json());

// 小ユーティリティ
const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
const normalize = s => (s||'').trim().replace('＞','>').replace('＜','<').replace('＝','=');
const id = ()=>'q_' + Math.random().toString(36).slice(2);
const gcd = (a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a;};
const compare = (A,B,C,D)=> (A*D)>(C*B)?'>':(A*D)<(C*B)?'<':'=';

// 出題インスタンス生成
const makeFractionCompare = (p)=>({
  instance_id:id(),
  template_id:'math_frac_compare_v1',
  render:{ stem:`次の分数を通分して(>,<,=)で答えよ： ${p.A}/${p.B} と ${p.C}/${p.D}`, inputs:[{type:'text',name:'rel'}]},
  meta:{subject:'math',skills:['分数の通分','大小比較'],difficulty:1500},
  payload:p
});
const makeGcd = (p)=>({
  instance_id:id(),
  template_id:'math_gcd_v1',
  render:{ stem:`${p.X} と ${p.Y} の最大公約数を答えよ（半角数字）`, inputs:[{type:'text',name:'ans'}]},
  meta:{subject:'math',skills:['最大公約数'],difficulty:1400},
  payload:p
});

// ヘルス
app.get('/', (_,res)=>res.json({ok:true,service:'nlt-proto'}));

// 次の問題
app.get('/api/v1/problems/next', (req,res)=>{
  const type = String(req.query.type||'fraction_compare').toLowerCase();
  let inst;
  if (type==='fraction_compare') {
    const p = { A:rand(1,9), B:rand(2,9), C:rand(1,9), D:rand(2,9) };
    inst = makeFractionCompare(p);
  } else if (type==='gcd') {
    const p = { X:rand(6,40), Y:rand(6,40) };
    inst = makeGcd(p);
  } else {
    return res.status(400).json({error:'unknown type'});
  }
  if (!validateInstance(inst)) return res.status(500).json({error:'invalid instance',details:validateInstance.errors});
  res.json(inst);
});

// 採点
app.post('/api/v1/attempts/grade', (req,res)=>{
  if (!validateGradeInput(req.body||{})) {
    return res.status(400).json({error:'invalid input',details:validateGradeInput.errors});
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
    const gt = String(gcd(payload.X,payload.Y));
    const ok = String(normalize(answer))===gt;
    return res.json({ correct: ok, ground_truth: gt, feedback_short: ok?'正解！':`不正解… 正しくは ${gt}` });
  }

  res.status(400).json({error:'unknown payload'});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`API ready: http://localhost:${PORT}`));
