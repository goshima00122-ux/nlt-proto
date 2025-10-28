// server/validate.js
const Ajv = require('ajv');
// Ajv の警告を抑え、union 型を許可
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });

// --- payload スキーマ（タイプ別） ---
const fractionPayloadSchema = {
  type: 'object',
  properties: {
    A: { type: 'integer' }, B: { type: 'integer' },
    C: { type: 'integer' }, D: { type: 'integer' }
  },
  required: ['A','B','C','D'],
  additionalProperties: false
};

const gcdPayloadSchema = {
  type: 'object',
  properties: {
    X: { type: 'integer' }, Y: { type: 'integer' }
  },
  required: ['X','Y'],
  additionalProperties: false
};

// --- 出題インスタンス全体 ---
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
      required: ['stem','inputs'],
      additionalProperties: true
    },
    meta: { type: 'object' },
    // ★ payload はタイプ別のどちらか
    payload: {
      oneOf: [ fractionPayloadSchema, gcdPayloadSchema ]
    }
  },
  required: ['instance_id','template_id','render','payload'],
  additionalProperties: true
};

// --- 採点入力 ---
const gradeInputSchema = {
  type: 'object',
  properties: {
    answer: { type: ['string','number'] },
    // ★ 採点側も同じ payload バリエーションを許可
    payload: { oneOf: [ fractionPayloadSchema, gcdPayloadSchema ] }
  },
  required: ['answer','payload'],
  additionalProperties: false
};

const validateInstance = ajv.compile(instanceSchema);
const validateGradeInput = ajv.compile(gradeInputSchema);

module.exports = { validateInstance, validateGradeInput };
