import { ptDiagrams } from '~/server/database/schema';
import { useDB } from '~/server/database';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const did = requireNumericParam(event, 'did', '图表');
  const db = useDB();
  return requireEntity(db, ptDiagrams, did, '图表');
});
