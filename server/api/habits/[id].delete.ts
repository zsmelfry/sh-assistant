import { habits } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

// 级联删除打卡记录由数据库外键约束处理
export default createDeleteHandler(habits, '习惯', { stringId: true });
