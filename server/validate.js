// server/validate.js
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });

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
    payload: {
      type: 'object',
      properties: { A:{type:'integer'}, B:{type:'integer'}, C:{type:'integer'}, D:{type:'integer'} },
      required: ['A','B','C','D']
    }
  },
  required: ['instance_id','template_id','render','payload'],
  additionalProperties: true
};

const gradeInputSchema = {
  type: 'object',
  properties: {
    answer: { type: ['string','number'] },
    payload: instanceSchema.properties.payload
  },
  required: ['answer','payload'],
  additionalProperties: false
};

const validateInstance = ajv.compile(instanceSchema);
const validateGradeInput = ajv.compile(gradeInputSchema);

module.exports = { validateInstance, validateGradeInput };
