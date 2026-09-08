import type { PluginStatus } from '../types'
import { IconRefresh, IconClock } from '../components/icons'

interface StatusPageProps {
    status: PluginStatus | null
    onRefresh: () => void
}

export default function StatusPage({ status, onRefresh }: StatusPageProps) {
    if (!status) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400 dark:text-gray-500">加载中...</div>
            </div>
        )
    }

    const cards = [
        { label: '运行时长', value: status.uptimeFormatted, color: 'from-blue-500 to-blue-600', icon: '⏱️' },
        { label: '今日处理', value: String(status.stats.todayProcessed), color: 'from-emerald-500 to-emerald-600', icon: '📊' },
        { label: '累计处理', value: String(status.stats.processed), color: 'from-purple-500 to-purple-600', icon: '📈' },
        { label: '自定义任务', value: String(status.config.tasks?.length || 0), color: 'from-orange-500 to-orange-600', icon: '🤖' },
    ]

    const builtinStatus = [
        { name: 'QQ 群每日打卡', enabled: status.config.groupSign_enable, time: status.config.groupSign_time },
        { name: 'QQ 好友每日名片赞', enabled: status.config.friendLike_enable, time: status.config.friendLike_time },
        { name: '群自动续火花', enabled: status.config.groupSpark_enable, time: status.config.groupSpark_time },
        { name: '好友自动续火花', enabled: status.config.friendSpark_enable, time: status.config.friendSpark_time },
    ]

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white dark:bg-[#25262B] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">{card.icon}</span>
                            <button onClick={onRefresh} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                                <IconRefresh size={14} />
                            </button>
                        </div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{card.value}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* 内置任务状态 */}
            <div className="bg-white dark:bg-[#25262B] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">内置核心任务状态</h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {builtinStatus.map((task, i) => (
                        <div key={i} className="px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${task.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{task.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <IconClock size={12} />
                                <span>{task.time}</span>
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${task.enabled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'}`}>
                                    {task.enabled ? '运行中' : '已禁用'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 插件信息 */}
            <div className="bg-white dark:bg-[#25262B] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">插件信息</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500 dark:text-gray-400">插件名称</span>
                        <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">{status.pluginName} (云白专属增强版)</div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400">全局开关</span>
                        <div className={`font-medium mt-0.5 ${status.config.enabled ? 'text-emerald-600' : 'text-red-500'}`}>
                            {status.config.enabled ? '已启用' : '已禁用'}
                        </div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400">调试模式</span>
                        <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">{status.config.debug ? '开启' : '关闭'}</div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400">统计日期</span>
                        <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">{status.stats.lastUpdateDay}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
