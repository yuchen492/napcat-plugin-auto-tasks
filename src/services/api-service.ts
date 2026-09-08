/**
 * API 服务模块 (支持好友名片赞、黑名单与告警配置)
 */

import type {
    NapCatPluginContext,
} from 'napcat-types/napcat-onebot/network/plugin/types';
import { pluginState } from '../core/state';
import type { PluginConfig, TaskConfig } from '../types';

export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;

    router.getNoAuth('/status', (_req, res) => {
        res.json({
            code: 0,
            data: {
                pluginName: ctx.pluginName,
                uptime: pluginState.getUptime(),
                uptimeFormatted: pluginState.getUptimeFormatted(),
                config: pluginState.config,
                stats: pluginState.stats,
            },
        });
    });

    router.getNoAuth('/config', (_req, res) => {
        res.json({ code: 0, data: pluginState.config });
    });

    router.postNoAuth('/config', async (req, res) => {
        try {
            const body = req.body as Record<string, unknown> | undefined;
            if (!body) {
                return res.status(400).json({ code: -1, message: '请求体为空' });
            }
            pluginState.updateConfig(body as Partial<PluginConfig>);
            ctx.logger.info('配置已通过 API 保存');
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            ctx.logger.error('保存配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 获取任务列表 */
    router.getNoAuth('/tasks', (_req, res) => {
        res.json({
            code: 0,
            data: {
                builtinTasks: {
                    groupSign: {
                        enable: pluginState.config.groupSign_enable,
                        time: pluginState.config.groupSign_time,
                        targets: pluginState.config.groupSign_targets,
                        exclude: pluginState.config.groupSign_exclude,
                    },
                    friendLike: {
                        enable: pluginState.config.friendLike_enable,
                        time: pluginState.config.friendLike_time,
                        times: pluginState.config.friendLike_times,
                        targets: pluginState.config.friendLike_targets,
                        exclude: pluginState.config.friendLike_exclude,
                    },
                    groupSpark: {
                        enable: pluginState.config.groupSpark_enable,
                        time: pluginState.config.groupSpark_time,
                        message: pluginState.config.groupSpark_message,
                        targets: pluginState.config.groupSpark_targets,
                    },
                    friendSpark: {
                        enable: pluginState.config.friendSpark_enable,
                        time: pluginState.config.friendSpark_time,
                        message: pluginState.config.friendSpark_message,
                        targets: pluginState.config.friendSpark_targets,
                    },
                },
                alerts: {
                    tg_bot_token: pluginState.config.tg_bot_token,
                    tg_chat_id: pluginState.config.tg_chat_id,
                },
                tasks: pluginState.config.tasks,
            },
        });
    });

    /** 保存任务配置 */
    router.postNoAuth('/tasks', async (req, res) => {
        try {
            const body = req.body as Record<string, unknown> | undefined;
            if (!body) {
                return res.status(400).json({ code: -1, message: '请求体为空' });
            }

            const updates: Partial<PluginConfig> = {};

            if (body.builtinTasks && typeof body.builtinTasks === 'object') {
                const bt = body.builtinTasks as Record<string, Record<string, unknown>>;

                if (bt.groupSign) {
                    if (typeof bt.groupSign.enable === 'boolean') updates.groupSign_enable = bt.groupSign.enable;
                    if (typeof bt.groupSign.time === 'string') updates.groupSign_time = bt.groupSign.time;
                    if (typeof bt.groupSign.targets === 'string') updates.groupSign_targets = bt.groupSign.targets;
                    if (typeof bt.groupSign.exclude === 'string') updates.groupSign_exclude = bt.groupSign.exclude;
                }
                if (bt.friendLike) {
                    if (typeof bt.friendLike.enable === 'boolean') updates.friendLike_enable = bt.friendLike.enable;
                    if (typeof bt.friendLike.time === 'string') updates.friendLike_time = bt.friendLike.time;
                    if (typeof bt.friendLike.times === 'number') updates.friendLike_times = bt.friendLike.times;
                    if (typeof bt.friendLike.targets === 'string') updates.friendLike_targets = bt.friendLike.targets;
                    if (typeof bt.friendLike.exclude === 'string') updates.friendLike_exclude = bt.friendLike.exclude;
                }
                if (bt.groupSpark) {
                    if (typeof bt.groupSpark.enable === 'boolean') updates.groupSpark_enable = bt.groupSpark.enable;
                    if (typeof bt.groupSpark.time === 'string') updates.groupSpark_time = bt.groupSpark.time;
                    if (typeof bt.groupSpark.message === 'string') updates.groupSpark_message = bt.groupSpark.message;
                    if (typeof bt.groupSpark.targets === 'string') updates.groupSpark_targets = bt.groupSpark.targets;
                }
                if (bt.friendSpark) {
                    if (typeof bt.friendSpark.enable === 'boolean') updates.friendSpark_enable = bt.friendSpark.enable;
                    if (typeof bt.friendSpark.time === 'string') updates.friendSpark_time = bt.friendSpark.time;
                    if (typeof bt.friendSpark.message === 'string') updates.friendSpark_message = bt.friendSpark.message;
                    if (typeof bt.friendSpark.targets === 'string') updates.friendSpark_targets = bt.friendSpark.targets;
                }
            }

            if (body.alerts && typeof body.alerts === 'object') {
                const al = body.alerts as Record<string, unknown>;
                if (typeof al.tg_bot_token === 'string') updates.tg_bot_token = al.tg_bot_token;
                if (typeof al.tg_chat_id === 'string') updates.tg_chat_id = al.tg_chat_id;
            }

            if (Array.isArray(body.tasks)) {
                updates.tasks = body.tasks as TaskConfig[];
            }

            pluginState.updateConfig(updates);
            ctx.logger.info('任务配置已更新');
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            ctx.logger.error('更新任务配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // ==================== 群管理（无鉴权）====================

    router.getNoAuth('/groups', async (_req, res) => {
        try {
            const groups = await ctx.actions.call(
                'get_group_list',
                {},
                ctx.adapterName,
                ctx.pluginManager.config
            ) as Array<{ group_id: number; group_name: string; member_count: number; max_member_count: number }>;

            const groupsWithConfig = (groups || []).map((group) => {
                const groupId = String(group.group_id);
                return {
                    group_id: group.group_id,
                    group_name: group.group_name,
                    member_count: group.member_count,
                    max_member_count: group.max_member_count,
                    enabled: pluginState.isGroupEnabled(groupId),
                };
            });

            res.json({ code: 0, data: groupsWithConfig });
        } catch (e) {
            ctx.logger.error('获取群列表失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    router.postNoAuth('/groups/:id/config', async (req, res) => {
        try {
            const groupId = req.params?.id;
            if (!groupId) {
                return res.status(400).json({ code: -1, message: '缺少群 ID' });
            }

            const body = req.body as Record<string, unknown> | undefined;
            const enabled = body?.enabled;
            pluginState.updateGroupConfig(groupId, { enabled: Boolean(enabled) });
            ctx.logger.info(`群 ${groupId} 配置已更新: enabled=${enabled}`);
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            ctx.logger.error('更新群配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    router.postNoAuth('/groups/bulk-config', async (req, res) => {
        try {
            const body = req.body as Record<string, unknown> | undefined;
            const { enabled, groupIds } = body || {};

            if (typeof enabled !== 'boolean' || !Array.isArray(groupIds)) {
                return res.status(400).json({ code: -1, message: '参数错误' });
            }

            for (const groupId of groupIds) {
                pluginState.updateGroupConfig(String(groupId), { enabled });
            }

            ctx.logger.info(`批量更新群配置完成 | 数量: ${groupIds.length}, enabled=${enabled}`);
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            ctx.logger.error('批量更新群配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    ctx.logger.debug('API 路由注册完成');
}
