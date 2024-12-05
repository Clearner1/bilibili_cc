// ==UserScript==
// @name         Bilibili CC字幕查看器
// @namespace    https://github.com/indefined/UserScripts
// @version      0.1.0
// @description  显示Bilibili CC字幕，支持复制和导出
// @author       Zane
// @match        *://*.bilibili.com/video/*
// @grant        none
// ==/UserScript==

// 这里定义了网页上字幕显示的样式
// 包括字体、颜色、大小、边框等外观设置
const styles = `
    /* 字幕容器的基本样式 */
    .bcc-subtitle-container {
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        font-size: 14px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        margin-top: 12px;
        width: 100%;
        box-sizing: border-box;
    }

    /* 可折叠的头部区域样式 */
    .bcc-subtitle-container .bcc-collapse-header {
        background: var(--bpx-aux-header-bg, #f4f4f4);
        color: var(--bpx-aux-header-font, #222);
        height: 44px;
        padding: 0 12px;
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        box-sizing: border-box;
    }

    /* 字幕内容区域样式 */
    .bcc-subtitle-container .bcc-subtitle-content {
        background: var(--v_bg1, #FFFFFF);
        border: 1px solid var(--v_line_regular, #E3E5E7);
        border-top: none;
        border-radius: 0 0 6px 6px;
        height: 0;
        overflow: hidden;
        transition: all 0.3s;
        width: 100%;
        box-sizing: border-box;
    }

    /* 功能按钮区域样式 */
    .bcc-subtitle-container .bcc-subtitle-function {
        display: flex;
        align-items: center;
        height: 40px;
        padding: 0 12px;
        border-bottom: 1px solid var(--v_line_regular, #E3E5E7);
        justify-content: space-between;
        background: var(--v_bg1, #FFFFFF);
        color: var(--v_text2, #61666D);
    }

    /* 单条字幕项样式 */
    .bcc-subtitle-container .bcc-subtitle-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        min-height: 32px;
        transition: background-color 0.3s;
        cursor: pointer;
        border-bottom: 1px solid var(--v_line_regular, #E3E5E7);
    }

    .bcc-subtitle-container .bcc-subtitle-item:hover {
        background: var(--v_bg2, #F6F7F8);
    }

    .bcc-subtitle-container .bcc-subtitle-item.active {
        background: var(--v_bg2, #F6F7F8);
        color: var(--v_brand_blue, #00AEEC);
    }

    /* 字幕时间戳样式 */
    .bcc-subtitle-container .bcc-subtitle-time {
        width: 80px;
        color: var(--v_text3, #9499A0);
        flex-shrink: 0;
        font-size: 13px;
    }

    /* 字幕文本样式 */
    .bcc-subtitle-container .bcc-subtitle-text {
        flex: 1;
        margin: 0 12px;
        color: var(--v_text1, #18191C);
        font-size: 14px;
        line-height: 1.5;
        word-break: break-word;
    }

    /* 字幕内容包装区域 */
    .bcc-subtitle-container .bcc-subtitle-wrap {
        height: 429px;
        overflow-y: auto;
        overscroll-behavior: contain;
        background: var(--v_bg1, #FFFFFF);
        padding: 4px 0;
    }

    /* 滚动条样式 */
    .bcc-subtitle-container .bcc-subtitle-wrap::-webkit-scrollbar {
        width: 6px;
    }

    .bcc-subtitle-container .bcc-subtitle-wrap::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }

    .bcc-subtitle-container .bcc-subtitle-wrap::-webkit-scrollbar-track {
        background: transparent;
    }
`;

// 创建一个style标签并把样式添加到网页中
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

// 定义字幕显示的两种模式
const SubtitleMode = {
    SINGLE: 'single',    // 单条字幕模式：每条字幕单独显示
    FULL: 'full'        // 完整字幕模式：所有字幕连续显示
};

// 字幕获取模块 - 负责从B站服务器获取字幕数据
const SubtitleFetcher = {
    // 获取视频信息（视频ID等）
    async getVideoInfo() {
        const info = {
            aid: window.aid || window.__INITIAL_STATE__?.aid,  // 获取视频aid
            bvid: window.bvid || window.__INITIAL_STATE__?.bvid,  // 获取视频bvid
            cid: window.cid  // 获取视频cid
        };

        // 如果直接获取不到cid，尝试从其他地方获取
        if (!info.cid) {
            const state = window.__INITIAL_STATE__;
            info.cid = state?.videoData?.cid || state?.epInfo?.cid;
        }

        // 如果还是获取不到，尝试从播放器获取
        if (!info.cid && window.player) {
            try {
                const playerInfo = window.player.getVideoInfo();
                info.cid = playerInfo.cid;
                info.aid = playerInfo.aid;
                info.bvid = playerInfo.bvid;
            } catch (e) {
                console.log('获取播放器信息失败:', e);
            }
        }

        return info;
    },

    // 获取字幕配置信息
    async getSubtitleConfig(info) {
        // 尝试从多个API获取字幕信息
        const apis = [
            `//api.bilibili.com/x/player/v2?cid=${info.cid}&bvid=${info.bvid}`,
            `//api.bilibili.com/x/v2/dm/view?aid=${info.aid}&oid=${info.cid}&type=1`,
            `//api.bilibili.com/x/player/wbi/v2?cid=${info.cid}`
        ];

        // 每次尝试每个API
        for (const api of apis) {
            try {
                const res = await fetch(api);  // 发送请求
                const data = await res.json();  // 获取JSON格式的响应

                // 如果成功获取到字幕信息就返回
                if (data.code === 0 && data.data?.subtitle?.subtitles?.length > 0) {
                    return data.data.subtitle;
                }
            } catch (e) {
                console.log('API请求失败:', e);
            }
        }

        return null;  // 如果都失败了就返回null
    },

    // 获取字幕的具体内容
    async getSubtitleContent(subtitleUrl) {
        try {
            // 确保使用HTTPS协议
            const url = subtitleUrl.replace(/^http:/, 'https:');
            const res = await fetch(url);
            const data = await res.json();
            return data;
        } catch (e) {
            console.error('获取字幕内容失败:', e);
            return null;
        }
    }
};

// 时间格式化模块 - 负责把秒数转换成显示用的时间格式
const TimeFormatter = {
    // 格式化时间为 分:秒 格式
    formatTime(seconds) {
        const mm = String(Math.floor(seconds/60)).padStart(2,'0');  // 计算分钟数，不足两位补0
        const ss = String(Math.floor(seconds%60)).padStart(2,'0');  // 计算秒数，不足两位补0
        return `${mm}:${ss}`;  // 返回 "分:秒" 格式
    },
    
    // 格式化时间为 分:秒,毫秒 格式（用于SRT字幕）
    formatTimeWithMs(seconds) {
        const date = new Date(seconds * 1000);  // 转换成日期对象
        const mm = String(Math.floor(seconds/60)).padStart(2,'0');
        const ss = String(Math.floor(seconds%60)).padStart(2,'0');
        const ms = String(date.getMilliseconds()).slice(0,3).padStart(3,'0');  // 获取毫秒数
        return `${mm}:${ss},${ms}`;  // 返回 "分:秒,毫秒" 格式
    }
};

// UI渲染模块 - 负责创建和管理字幕的显示界面
const SubtitleUI = {
    currentMode: SubtitleMode.SINGLE,  // ��前的显示模式，默认是单条显示
    
    injectStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;  // 直接使用顶部定义的 styles
        document.head.appendChild(styleElement);  // 将样式添加到页面头部
    },

    // 创建字幕显示的界面
    createSubtitleUI() {
        // 创建主容器
        const container = document.createElement('div');
        container.className = 'bcc-subtitle-container';
        
        // 创建头部区域 - 包含标题和菜单按钮
        const header = document.createElement('div');
        header.className = 'bcc-collapse-header';
        header.innerHTML = `
            <div class="title-section">
                <!-- 展开/收起的箭头图标 -->
                <div class="bui-collapse-arrow">
                    <span class="bui-collapse-arrow-text">
                        <span class="arrow-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 16 16">
                                <path d="m9.188 7.999-3.359 3.359a.75.75 0 1 0 1.061 1.061l3.889-3.889a.75.75 0 0 0 0-1.061L6.89 3.58a.75.75 0 1 0-1.061 1.061l3.359 3.358z"></path>
                            </svg>
                        </span>
                    </span>
                </div>
                <span class="header-title">字幕列表</span>
            </div>
            <!-- 右侧的菜单按钮 -->
            <div class="menu-section">
                <div class="bui-dropdown-wrap">
                    <div class="bui-dropdown-display">
                        <!-- 三个点的菜单图标 -->
                        <span class="bui-dropdown-icon">
                            <svg class="icon" viewBox="0 0 1024 1024">
                                <!-- 省略具体的SVG路径... -->
                            </svg>
                        </span>
                    </div>
                    <!-- 下拉菜单选项 -->
                    <div class="bui-dropdown-items">
                        <div class="bui-dropdown-item" data-value="COPY_TEXT">复制字幕文本</div>
                        <div class="bui-dropdown-item" data-value="COPY_WITH_TIME">复制带时间戳文本</div>
                        <div class="bui-dropdown-item" data-value="EXPORT_SRT">导出SRT格式</div>
                        <div class="bui-dropdown-item" data-value="EXPORT_ASS">导出ASS格式</div>
                        <div class="bui-dropdown-item" data-value="DISPLAY_SETTINGS">显示设置</div>
                    </div>
                </div>
            </div>
        `;
        
        // 创建内容区域
        const content = document.createElement('div');
        content.className = 'bcc-subtitle-content';
        
        // 创建功能栏 - 包含时间、内容和显示模式切换按钮
        const function_bar = document.createElement('div');
        function_bar.className = 'bcc-subtitle-function';
        function_bar.innerHTML = `
            <div class="subtitle-function-left">
                <div class="subtitle-function-btn">
                    <span>时间</span>
                </div>
                <div class="subtitle-function-btn">
                    <span>字幕内容</span>
                </div>
                <div class="mode-toggle">
                    <span>切换显示模式</span>
                </div>
            </div>
        `;
        
        // 创建字幕显示区域，添加滚轮事件处理
        const wrap = document.createElement('div');
        wrap.className = 'bcc-subtitle-wrap';

        // 处理鼠标滚轮事件，让字幕区域可以独立滚动
        wrap.addEventListener('wheel', (e) => {
            e.stopPropagation();  // 阻止事件继续传递
            e.preventDefault();    // 阻止默认的滚动行为
            wrap.scrollTop += e.deltaY;  // 手动控制滚动距离
        }, { passive: false });
        
        // 组装所有部件
        content.appendChild(function_bar);
        content.appendChild(wrap);
        container.appendChild(header);
        container.appendChild(content);
        
        // 添加菜单相关的事件处理
        const dropdownWrap = header.querySelector('.bui-dropdown-wrap');
        const dropdownItems = header.querySelector('.bui-dropdown-items');
        
        // 点击三点图标时显示/隐藏菜单
        dropdownWrap.addEventListener('click', (e) => {
            e.stopPropagation();  // 阻止事件冒泡
            dropdownItems.classList.toggle('show');  // 切换菜单的显示状态
        });

        // 点击页面其他地方时关闭菜单
        document.addEventListener('click', () => {
            dropdownItems.classList.remove('show');
        });

        // 点击菜单项时阻止关闭菜单
        dropdownItems.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 返回创建的所有界面元素
        return { container, header, content: wrap, function_bar };
    }
};

// 字幕同步模块 - 负责让字幕跟随视频播放自动滚动和高亮
const SubtitleSync = {
    isVideoPlaying: true,               // 视频是否正在播放
    lastManualScrollTime: 0,            // 上次手动滚动的时间
    currentMode: SubtitleMode.SINGLE,   // 当前显示模式
    
    // 根据当前模式显示字幕
    displaySubtitles(subtitles, container) {
        // 根据当前模式选择显示方式
        if (this.currentMode === SubtitleMode.SINGLE) {
            this.displaySingleMode(subtitles, container);  // 单条显示模式
        } else {
            this.displayFullMode(subtitles, container);    // 完整显示模式
        }

        // 监视视频播放状态的变化
        if (window.player) {
            const observer = new MutationObserver(() => {
                const video = document.querySelector('video');
                if (video) {
                    this.isVideoPlaying = !video.paused;  // 更新播放状态
                }
            });

            // 观察播放器容器的变化
            observer.observe(document.querySelector('.bpx-player-container'), {
                subtree: true,
                attributes: true
            });
        }
    },

    // 单条显示模式 - 每条字幕单独成行
    displaySingleMode(subtitles, container) {
        const subtitleHtml = subtitles.body.map((item, index) => `
            <div class="bcc-subtitle-item" data-index="${index}">
                <span class="bcc-subtitle-time">${TimeFormatter.formatTime(item.from)}</span>
                <span class="bcc-subtitle-text">${item.content}</span>
            </div>
        `).join('');

        container.innerHTML = subtitleHtml;
        this.addClickEvents(subtitles, container);  // 添加点击事件
    },

    // 完整显示模式 - 所有字幕连续显示
    displayFullMode(subtitles, container) {
        const subtitleHtml = `
            <div class="bcc-subtitle-full-text">
                ${subtitles.body.map((item, index) => `
                    <span class="bcc-subtitle-segment" data-index="${index}">
                        ${item.content}
                    </span>
                `).join(' ')}
            </div>
        `;

        container.innerHTML = subtitleHtml;
        this.addClickEvents(subtitles, container);  // 添加点击事件
    },

    // 为字幕添加点击事件 - 点击时跳转到视频对应时间点
    addClickEvents(subtitles, container) {
        // 根据当前模式选择要添加事件的元素
        const elements = this.currentMode === SubtitleMode.SINGLE ? 
            container.querySelectorAll('.bcc-subtitle-item') :   // 单条模式选择整行
            container.querySelectorAll('.bcc-subtitle-segment'); // 完整模式选择单个片段

        // 为每个字幕添加点击事件
        elements.forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);  // 获取字幕序号
                const subtitle = subtitles.body[index];      // 找到对应的字幕数据
                if (window.player && subtitle) {
                    window.player.seek(subtitle.from);       // 跳转到字幕开始时间
                }
            });
        });

        // 记录手动滚动的时间
        container.addEventListener('scroll', () => {
            this.lastManualScrollTime = Date.now();
        });
    },

    // 切换显示模式（单条/完整）
    toggleMode(subtitles, container) {
        this.currentMode = this.currentMode === SubtitleMode.SINGLE ? 
            SubtitleMode.FULL : SubtitleMode.SINGLE;  // 切换模式
        this.displaySubtitles(subtitles, container);  // 重新显示字幕
    },

    // 计算元素在容器中的相对位置
    getRelativePosition(element, container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        return {
            top: elementRect.top - containerRect.top,      // 顶部相对位置
            bottom: elementRect.bottom - containerRect.top  // 底部相对位置
        };
    },

    // 检查元素是否在可视区域内
    isElementInViewport(element, container) {
        const pos = this.getRelativePosition(element, container);
        const containerHeight = container.clientHeight;
        
        const buffer = 50;  // 设置50像素的缓冲区
        // 如果元素在可视区域内（考虑缓冲区）就返回true
        return pos.top >= -buffer && pos.bottom <= containerHeight + buffer;
    },

    // 平滑滚动到指定元素
    smoothScrollToElement(element, container) {
        const pos = this.getRelativePosition(element, container);
        const containerHeight = container.clientHeight;
        // 计算目标滚动位置（让元素显示在中间）
        const targetScroll = container.scrollTop + pos.top - containerHeight / 2;
        
        // 使用平滑滚动效果
        container.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    },

    // 高亮当前正在播放的字幕
    highlightCurrentSubtitle(subtitles, container) {
        // 获取当前视频播放时间
        const currentTime = window.player?.getCurrentTime() || 0;
        
        // 移除所有字幕的高亮状态
        if (this.currentMode === SubtitleMode.SINGLE) {
            container.querySelectorAll('.bcc-subtitle-item').forEach(item => {
                item.classList.remove('active');
            });
        } else {
            container.querySelectorAll('.bcc-subtitle-segment').forEach(item => {
                item.classList.remove('active');
            });
        }

        // 找到当前时间对应的字幕
        const currentSubtitle = subtitles.body.find(item => 
            currentTime >= item.from && currentTime <= item.to
        );

        if (currentSubtitle) {
            const index = subtitles.body.indexOf(currentSubtitle);
            // 根据当前模式选择要高亮的元素
            const selector = this.currentMode === SubtitleMode.SINGLE ? 
                `.bcc-subtitle-item[data-index="${index}"]` :
                `.bcc-subtitle-segment[data-index="${index}"]`;
            const currentElement = container.querySelector(selector);
            
            if (currentElement) {
                // 添加高亮样式
                currentElement.classList.add('active');
                
                // 如果视频在播放，且最近2秒内没有手动滚动
                if (this.isVideoPlaying && Date.now() - this.lastManualScrollTime > 2000) {
                    // 如果当前字幕不在可视区域内，就滚动到它
                    if (!this.isElementInViewport(currentElement, container)) {
                        this.smoothScrollToElement(currentElement, container);
                    }
                }
            }
        }
    }
};

// 字幕导出模块 - 负责处理字幕的复制和导出功能
const SubtitleExporter = {
    // 获取视频标题（用作导出文件的文件名）
    getVideoTitle() {
        // 从页面中获取视频标题，如果获取失败则使用默认值'subtitle'
        return document.querySelector('h1.video-title')?.textContent?.trim() || 'subtitle';
    },

    // 导出为SRT格式字幕文件
    exportToSRT(subtitles) {
        return subtitles.body.map((item, index) => {
            // SRT格式: 序号 + 时间范围 + 字幕内容
            return `${index + 1}\n${TimeFormatter.formatTimeWithMs(item.from)} --> ${TimeFormatter.formatTimeWithMs(item.to)}\n${item.content}\n`;
        }).join('\n');
    },

    // 导出为TXT格式（带时间戳）
    exportToTXT(subtitles) {
        return subtitles.body.map(item => {
            // 格式: [时间] 字幕内容
            return `[${TimeFormatter.formatTime(item.from)}] ${item.content}`;
        }).join('\n');
    },

    // 下载文件的通用函数
    download(content, format) {
        const title = this.getVideoTitle();  // 获取文件名
        // 创建Blob对象（二进制大对象）
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);  // 创建临时URL
        
        // 创建一个临时的<a>标签用于下载
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.${format}`;  // 设置下载文件名
        document.body.appendChild(a);
        a.click();  // 触发下载
        
        // 清理临时元素和URL
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// 菜单处理模块 - 处理右上角菜单的所有功能
const MenuHandler = {
    // 复制纯文本 - ��复制字幕内容，不带时间戳
    copyText(subtitles) {
        // 把所有字幕内容连接成一个字符串
        const text = subtitles.body.map(item => item.content).join('\n');
        // 复制到剪贴板
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('复制成功');  // 显示提示消息
        });
    },

    // 复制带时间戳的文本
    copyTextWithTime(subtitles) {
        // 为每条字幕添加时间戳后连接
        const text = subtitles.body.map(item => 
            `[${TimeFormatter.formatTime(item.from)}] ${item.content}`
        ).join('\n');
        // 复制到剪贴板
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('复制成功');
        });
    },

    // 导出SRT格式字幕文件
    exportSRT(subtitles) {
        const content = SubtitleExporter.exportToSRT(subtitles);
        SubtitleExporter.download(content, 'srt');
    },

    // 导出ASS格式字幕文件（未实现）
    exportASS(subtitles) {
        // TODO: 实现ASS格式导出
        this.showToast('ASS格式导出功能开发中');
    },

    // 显示设置面板（未实现）
    showDisplaySettings() {
        // TODO: 实现显示设置面板
        this.showToast('显示设置功能开发中');
    },

    // 显��提示消息
    showToast(message) {
        // 创建提示框元素
        const toast = document.createElement('div');
        toast.className = 'bui-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 设置动画和自动消失
        setTimeout(() => {
            toast.classList.add('bui-toast-show');  // 显示
            setTimeout(() => {
                toast.classList.remove('bui-toast-show');  // 淡出
                setTimeout(() => {
                    document.body.removeChild(toast);  // 移除元素
                }, 200);
            }, 2000);
        }, 0);
    }
};

// 主函数 - 程序的入口点
async function main() {
    // 等待B站的弹幕列表容器加载完成
    const danmakuContainer = await new Promise(resolve => {
        const check = () => {
            const container = document.querySelector('.bui-collapse-wrap');
            if (container) {
                console.log('Found container:', container);
                resolve(container);  // 容器存在时继续
            } else {
                console.log('Waiting for container...');
                setTimeout(check, 1000);  // 否则等待1秒后重试
            }
        };
        check();
    });

    // 注入样式
    SubtitleUI.injectStyles();
    console.log('Styles injected');
    // 创建字幕显示界面
    const { container, header, content, function_bar } = SubtitleUI.createSubtitleUI();
    danmakuContainer.appendChild(container);
    
    // 添加展开/收起功能
    let isExpanded = false;  // 当前是否展开
    header.addEventListener('click', () => {
        isExpanded = !isExpanded;  // 切换状态
        // 设置内容区域的高度（展开或收起）
        container.querySelector('.bcc-subtitle-content').style.height = 
            isExpanded ? '429px' : '0';
        // 旋转箭头图标
        header.querySelector('.arrow-icon').classList.toggle('expanded', isExpanded);
    });

    // 尝试加载字幕
    try {
        // 1. 获取视频信息
        const videoInfo = await SubtitleFetcher.getVideoInfo();
        if (!videoInfo.cid) {
            throw new Error('无法获取视频信息');
        }

        // 2. 获取字幕配置
        const subtitleConfig = await SubtitleFetcher.getSubtitleConfig(videoInfo);
        if (!subtitleConfig) {
            throw new Error('该视频没有CC字幕');
        }

        // 3. 获取字幕内容
        const subtitles = await SubtitleFetcher.getSubtitleContent(subtitleConfig.subtitles[0].subtitle_url);
        if (!subtitles) {
            throw new Error('获取字幕内容失败');
        }

        // 4. 显示字幕
        SubtitleSync.displaySubtitles(subtitles, content);

        // 5. 添加模式切换功能
        const modeToggle = function_bar.querySelector('.mode-toggle');
        modeToggle.addEventListener('click', () => {
            SubtitleSync.toggleMode(subtitles, content);
            // 更新按钮文字
            modeToggle.querySelector('span').textContent = 
                SubtitleSync.currentMode === SubtitleMode.SINGLE ? 
                '切换到完整模式' : '切换到单条模式';
        });

        // 6. 启动字幕同步功能
        setInterval(() => {
            if (isExpanded) {  // 只在展开状态下更新
                SubtitleSync.highlightCurrentSubtitle(subtitles, content);
            }
        }, 100);  // 每0.1秒更新一次

        // 7. 添加菜单功能
        const dropdownItems = container.querySelector('.bui-dropdown-items');
        dropdownItems.addEventListener('click', (e) => {
            const item = e.target.closest('.bui-dropdown-item');
            if (!item) return;

            // 根据点击的菜单项执行相应功能
            const action = item.dataset.value;
            switch (action) {
                case 'COPY_TEXT':
                    MenuHandler.copyText(subtitles);
                    break;
                case 'COPY_WITH_TIME':
                    MenuHandler.copyTextWithTime(subtitles);
                    break;
                case 'EXPORT_SRT':
                    MenuHandler.exportSRT(subtitles);
                    break;
                case 'EXPORT_ASS':
                    MenuHandler.exportASS(subtitles);
                    break;
                case 'DISPLAY_SETTINGS':
                    MenuHandler.showDisplaySettings();
                    break;
            }
        });

    } catch (error) {
        // 如果出现错误，显示错误信息
        console.error('Error:', error);
        content.innerHTML = `<div class="bcc-subtitle-item">${error.message}</div>`;
    }
}

// 改进的初始化逻辑
function waitForPlayer() {
    console.log('Waiting for player...');
    if (window.player) {
        console.log('Player found, starting main function');
        main().catch(error => {
            console.error('Main function failed:', error);
        });
    } else {
        console.log('Player not found, retrying...');
        setTimeout(waitForPlayer, 1000);
    }
}

// 使用更可靠的初始化方式
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForPlayer);
} else {
    waitForPlayer();
}