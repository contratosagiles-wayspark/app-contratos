const u = require('./server/utils/sanitize');
const s = require('./server/validators/suscripciones');
const a = require('./server/validators/admin');

let pass = 0, fail = 0;
function t(name, cond) {
    if (cond) { pass++; console.log('PASS: ' + name); }
    else { fail++; console.log('FAIL: ' + name); }
}

// Sanitize tests
t('sanitizeString XSS', u.sanitizeString('<script>') === '&lt;script&gt;');
t('sanitizeString quotes', u.sanitizeString('"hello"') === '&quot;hello&quot;');
t('sanitizeForPDF ctrl chars', u.sanitizeForPDF('a\x00b') === 'ab');
t('sanitizeForPDF keeps accents', u.sanitizeForPDF('áéíóúñü') === 'áéíóúñü');
t('sanitizeForPDF truncates', u.sanitizeForPDF('x'.repeat(60000)).length === 50000);
t('sanitizeObject deep', JSON.stringify(u.sanitizeObject({ a: '<b>' })) === '{"a":"&lt;b&gt;"}');
t('sanitizeObject number passthrough', u.sanitizeObject(42) === 42);
t('sanitizeObject null passthrough', u.sanitizeObject(null) === null);

// Suscripciones schema
t('bad plan rejected', !s.crearSuscripcionSchema.safeParse({ plan: 'invalido' }).success);
t('bad plan message', s.crearSuscripcionSchema.safeParse({ plan: 'x' }).error.issues[0].message === 'Plan inválido. Opciones: pro, empresa.');
t('good plan pro', s.crearSuscripcionSchema.safeParse({ plan: 'pro' }).success);
t('good plan empresa', s.crearSuscripcionSchema.safeParse({ plan: 'empresa' }).success);
t('empty webhook ok', s.webhookSchema.safeParse({}).success);
t('webhook with extra fields', s.webhookSchema.safeParse({ type: 'payment', data: { id: '123' }, extra: 'ok' }).success);
t('webhook data.id as number', s.webhookSchema.safeParse({ type: 'x', data: { id: 123 } }).success);

// Admin schemas
t('bad uuid rejected', !a.idUsuarioParamSchema.safeParse({ id: 'not-uuid' }).success);
t('bad uuid message', a.idUsuarioParamSchema.safeParse({ id: 'bad' }).error.issues[0].message === 'ID de usuario inválido.');
t('valid uuid', a.idUsuarioParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' }).success);
t('dias 0 fail', !a.trialSchema.safeParse({ dias: 0 }).success);
t('dias 0 message', a.trialSchema.safeParse({ dias: 0 }).error.issues[0].message === 'Mínimo 1 día.');
t('dias 30 ok', a.trialSchema.safeParse({ dias: 30 }).success);
t('dias 366 fail', !a.trialSchema.safeParse({ dias: 366 }).success);
t('empty nota fail', !a.notaSchema.safeParse({ nota: '' }).success);
t('nota ok', a.notaSchema.safeParse({ nota: 'test note' }).success);
t('plan defaults', a.cambiarPlanSchema.safeParse({ plan: 'pro' }).data.plan_estado === 'activo');
t('plan invalid', !a.cambiarPlanSchema.safeParse({ plan: 'platinum' }).success);
t('query defaults', a.queryUsuariosSchema.safeParse({}).data.page === 1);
t('query page coerce', a.queryUsuariosSchema.safeParse({ page: '3' }).data.page === 3);

console.log('\n' + pass + '/' + (pass + fail) + ' tests passed');
if (fail > 0) process.exit(1);
