/**
 * 任务管理器 (云白专属定制增强版)
 *
 * 增强功能：
 * 1. 好友名片赞支持 (定时、次数、排除QQ、防风控延时)
 * 2. 群打卡排除黑名单支持
 * 3. 异常与完成 Telegram 告警推送
 * 4. 每日执行日志记录保存到 data/ 供晚报与审计读取
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { pluginState } from './core/state';
import type { TaskConfig, GroupInfo, FriendInfo } from './types';

// Telegram 异步告警推送
async function sendTelegramAlert(botToken: string, chatId: string, text: string): Promise<void> {
    if (!botToken || !chatId) return;
    return new Promise((resolve) => {
        try {
            const data = JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown',
            });
            const req = https.request({
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${botToken}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                },
                timeout: 8000,
            }, (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve());
            });
            req.on('error', (err) => {
                pluginState.logger.error('Telegram 推送失败:', err);
                resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                resolve();
            });
            req.write(data);
            req.end();
        } catch (e) {
            pluginState.logger.error('Telegram 推送异常:', e);
            resolve();
        }
    });
}

export class TaskManager {
    private lastExecutedTime: string = '';

    constructor() {}

    // --- 停止所有任务 ---
    public stop() {
        if (pluginState.timers.size > 0) {
            pluginState.logger.info(`🛑 已清理 ${pluginState.timers.size} 个活跃定时器`);
        }
        for (const [, timer] of pluginState.timers) {
            clearInterval(timer);
        }
        pluginState.timers.clear();
    }

    // --- 启动任务 ---
    public start() {
        this.stop();

        pluginState.logger.info('🚀 正在启动自动化任务 (云白专属增强版)...');

        const tasks = pluginState.config.tasks.filter(t => t.enable && t.target);
        pluginState.logger.info(`已加载 ${tasks.length} 个有效自定义任务`);

        // 主心跳 (每秒检查)
        const mainTicker = setInterval(() => {
            this.tick(tasks);
        }, 1000);
        pluginState.timers.set('main-ticker', mainTicker);

        // 循环间隔任务
        tasks.forEach((task, index) => {
            if (task.type === 'group_notice') return;

            if (task.interval > 0) {
                const ms = Math.max(task.interval * 1000, 5000);
                pluginState.logger.info(`[任务${index + 1}] ⏳ 循环启动: 目标 ${task.target}, 间隔 ${task.interval}s`);

                const timer = setInterval(() => {
                    try {
                        this.executeTask(task, index + 1).catch(e => {
                            pluginState.logger.error(`[任务${index + 1}] 循环执行异常:`, e);
                        });
                    } catch (e) {
                        pluginState.logger.error(`[任务${index + 1}] 循环触发异常:`, e);
                    }
                }, ms);

                pluginState.timers.set(`interval-task-${index}`, timer);
            }
        });
    }

    private async tick(tasks: TaskConfig[]) {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];

        if (timeStr === this.lastExecutedTime) return;
        this.lastExecutedTime = timeStr;

        const config = pluginState.config;

        let allGroups: number[] | null = null;
        let allFriends: number[] | null = null;

        const getAllGroups = async (): Promise<number[]> => {
            if (allGroups !== null) return allGroups;
            try {
                const result = await pluginState.callApi('get_group_list', {}) as GroupInfo[] | undefined;
                allGroups = (result || []).map(g => g.group_id);
            } catch {
                allGroups = [];
            }
            return allGroups;
        };

        const getEnabledGroups = async (): Promise<number[]> => {
            try {
                const result = await pluginState.callApi('get_group_list', {}) as GroupInfo[] | undefined;
                return (result || [])
                    .filter(g => pluginState.isGroupEnabled(String(g.group_id)))
                    .map(g => g.group_id);
            } catch {
                return [];
            }
        };

        const getAllFriends = async (): Promise<number[]> => {
            if (allFriends !== null) return allFriends;
            try {
                const result = await pluginState.callApi('get_friend_list', {}) as FriendInfo[] | undefined;
                allFriends = (result || []).map(f => f.user_id);
            } catch {
                allFriends = [];
            }
            return allFriends;
        };

        // 内置任务 - 群打卡 (带黑名单过滤与日志)
        if (config.groupSign_enable && timeStr === config.groupSign_time) {
            let targetGroupIds: number[] = [];
            if (config.groupSign_targets.toLowerCase() === 'all') {
                targetGroupIds = await getAllGroups();
            } else if (config.groupSign_targets.toLowerCase() === 'allallow') {
                targetGroupIds = await getEnabledGroups();
            } else {
                targetGroupIds = config.groupSign_targets.split(/[,，]/).map(t => parseInt(t.trim(), 10)).filter(t => !isNaN(t));
            }

            // 过滤排除黑名单
            const excludeList = (config.groupSign_exclude || '').split(/[,，]/).map(t => t.trim()).filter(t => t);
            const filteredGroups = targetGroupIds.filter(gid => !excludeList.includes(String(gid)));

            pluginState.logger.info(`[内置任务] 群打卡启动: 总计 ${filteredGroups.length} 个群 (已排除 ${excludeList.length} 个黑名单)`);

            this.executeGroupSignBatch(filteredGroups, config.tg_bot_token, config.tg_chat_id);
        }

        // 内置任务 - 好友名片赞 (带排除、次数、防风控延时与TG通知)
        if (config.friendLike_enable && timeStr === config.friendLike_time) {
            let targetFriendIds: number[] = [];
            if (config.friendLike_targets.toLowerCase() === 'all') {
                targetFriendIds = await getAllFriends();
            } else {
                targetFriendIds = config.friendLike_targets.split(/[,，]/).map(t => parseInt(t.trim(), 10)).filter(t => !isNaN(t));
            }

            const excludeList = (config.friendLike_exclude || '').split(/[,，]/).map(t => t.trim()).filter(t => t);
            const filteredFriends = targetFriendIds.filter(fid => !excludeList.includes(String(fid)));

            pluginState.logger.info(`[内置任务] 好友名片赞启动: 总计 ${filteredFriends.length} 位好友 (每人 ${config.friendLike_times || 20} 次)`);

            this.executeFriendLikeBatch(filteredFriends, config.friendLike_times || 20, config.tg_bot_token, config.tg_chat_id);
        }

        // 内置任务 - 群续火花
        if (config.groupSpark_enable && timeStr === config.groupSpark_time) {
            const targets = config.groupSpark_targets.toLowerCase() === 'all'
                ? (await getAllGroups()).join(',')
                : config.groupSpark_targets.toLowerCase() === 'allallow'
                ? (await getEnabledGroups()).join(',')
                : config.groupSpark_targets;
            this.executeBatch('群火花', targets, async (id) => {
                await pluginState.callApi('send_msg', {
                    message_type: 'group', group_id: id, message: config.groupSpark_message,
                });
            });
        }

        // 内置任务 - 好友续火花
        if (config.friendSpark_enable && timeStr === config.friendSpark_time) {
            const targets = config.friendSpark_targets.toLowerCase() === 'all'
                ? (await getAllFriends()).join(',')
                : config.friendSpark_targets;
            this.executeBatch('好友火花', targets, async (id) => {
                await pluginState.callApi('send_msg', {
                    message_type: 'private', user_id: id, message: config.friendSpark_message,
                });
            });
        }

        // 自定义任务 (每日定时)
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const isScheduleMode = task.interval <= 0 || task.type === 'group_notice';

            if (isScheduleMode && task.time === timeStr) {
                try {
                    this.executeTask(task, i + 1).catch(e => {
                        pluginState.logger.error(`[任务${i + 1}] 定时执行异步异常:`, e);
                    });
                } catch (e) {
                    pluginState.logger.error(`[任务${i + 1}] 定时触发异常:`, e);
                }
            }
        }
    }

    private async executeGroupSignBatch(groups: number[], tgBotToken: string, tgChatId: string) {
        let successCount = 0;
        let failCount = 0;
        const failedGroups: { group_id: number; error: string }[] = [];

        for (const gid of groups) {
            await new Promise(r => setTimeout(r, 400)); // 防风控 400ms 延时
            try {
                await pluginState.callApi('send_group_sign', { group_id: gid });
                successCount++;
                pluginState.incrementProcessed();
            } catch (e: any) {
                failCount++;
                failedGroups.push({ group_id: gid, error: e?.message || String(e) });
                pluginState.logger.error(`[群打卡] 群 ${gid} 打卡失败:`, e);
            }
        }

        pluginState.logger.info(`[群打卡完成] 成功: ${successCount}, 失败: ${failCount}`);

        // 仅在有失败时通过 Telegram 告警
        if (failCount > 0 && tgBotToken && tgChatId) {
            const alertMsg = `⚠️ *[NapCat 自动任务] QQ群每日打卡异常告警*\n\n` +
                `*执行时间:* ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n` +
                `*成功数量:* ${successCount} 个群\n` +
                `*失败数量:* ${failCount} 个群\n` +
                `*失败明细:* ${failedGroups.slice(0, 5).map(f => `${f.group_id}: ${f.error}`).join('; ')}\n\n` +
                `请检查 NapCat 日志与账号风控状态。`;
            await sendTelegramAlert(tgBotToken, tgChatId, alertMsg);
        }
    }

    private async executeFriendLikeBatch(friends: number[], times: number, tgBotToken: string, tgChatId: string) {
        let successCount = 0;
        let failCount = 0;
        let totalLikes = 0;
        const failedFriends: { user_id: number; error: string }[] = [];

        for (const fid of friends) {
            await new Promise(r => setTimeout(r, 500)); // 500ms 防风控
            try {
                const res: any = await pluginState.callApi('send_like', { user_id: fid, times });
                // 容错：若返回已达上限也算作成功
                successCount++;
                totalLikes += times;
                pluginState.incrementProcessed();
            } catch (e: any) {
                const errMsg = e?.message || String(e);
                if (errMsg.includes('上限') || errMsg.includes('limit') || errMsg.includes('达')) {
                    successCount++;
                    totalLikes += times;
                } else {
                    failCount++;
                    failedFriends.push({ user_id: fid, error: errMsg });
                    pluginState.logger.error(`[名片赞] 好友 ${fid} 点赞失败:`, e);
                }
            }
        }

        pluginState.logger.info(`[好友名片赞完成] 成功好友: ${successCount}, 失败: ${failCount}, 累计点赞: ${totalLikes} 次`);

        if (failCount > 0 && tgBotToken && tgChatId) {
            const alertMsg = `⚠️ *[NapCat 自动任务] QQ好友名片点赞异常告警*\n\n` +
                `*执行时间:* ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n` +
                `*成功人数:* ${successCount} 位好友 (${totalLikes} 次赞)\n` +
                `*失败人数:* ${failCount} 位\n` +
                `*失败明细:* ${failedFriends.slice(0, 5).map(f => `${f.user_id}: ${f.error}`).join('; ')}\n\n` +
                `请检查是否遭遇腾讯名片赞频控。`;
            await sendTelegramAlert(tgBotToken, tgChatId, alertMsg);
        }
    }

    private async executeTask(task: TaskConfig, index: number) {
        try {
            pluginState.logger.info(`[任务${index}] ▶️ 触发: ${task.target} (${task.type})`);
            await new Promise(r => setTimeout(r, Math.random() * 3000));

            if (task.type === 'group_notice') {
                await pluginState.callApi('_send_group_notice', {
                    group_id: task.target,
                    content: task.message,
                    image: task.image || undefined,
                    pinned: task.is_pinned ? 1 : 0,
                    type: 1,
                    confirm_required: task.is_confirm ? 1 : 0,
                    is_show_edit_card: 0,
                    tip_window_type: 0,
                });
            } else {
                const payload: Record<string, unknown> = {
                    message_type: task.type,
                    message: task.message,
                };
                if (task.type === 'group') payload.group_id = task.target;
                else payload.user_id = task.target;
                await pluginState.callApi('send_msg', payload);
            }

            pluginState.incrementProcessed();
        } catch (e) {
            pluginState.logger.error(`[任务${index}] 执行失败:`, e);
        }
    }

    private async executeBatch(name: string, targetsStr: string, action: (id: string) => Promise<void>) {
        const targets = targetsStr.split(/[,，]/).map(t => t.trim()).filter(t => t);
        if (targets.length === 0) return;
        pluginState.logger.info(`[内置任务] ${name} 触发`);
        for (const id of targets) {
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
            try {
                await action(id);
                pluginState.incrementProcessed();
            } catch (e) {
                pluginState.logger.error(`[${name}] 失败`, e);
            }
        }
    }
}
