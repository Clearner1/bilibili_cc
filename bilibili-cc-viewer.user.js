// ==UserScript==
// @name         Bilibili CC字幕查看器
// @namespace    https://github.com/indefined/UserScripts
// @version      0.1.0
// @description  显示Bilibili CC字幕，支持复制和导出
// @author       indefined
// @include      *://www.bilibili.com/video/*
// @include      *://www.bilibili.com/bangumi/play/*
// @grant        none
// ==/UserScript==

// 添加样式代码
const styles = `
    .subtitle-container {
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        font-size: 12px;
        line-height: normal;
        -webkit-font-smoothing: antialiased;
        margin-top: 12px;
        width: 100%;
        box-sizing: border-box;
    }

    .bui-collapse-header {
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

    .subtitle-content {
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

    .subtitle-function {
        display: flex;
        align-items: center;
        height: 40px;
        padding: 0 12px;
        border-bottom: 1px solid var(--v_line_regular, #E3E5E7);
        justify-content: space-between;
        background: var(--v_bg1, #FFFFFF);
        color: var(--v_text2, #61666D);
    }

    .subtitle-function-left {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .subtitle-function-btn {
        display: flex;
        align-items: center;
        white-space: nowrap;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .subtitle-function-btn:hover {
        background: var(--v_bg2, #F6F7F8);
    }

    .mode-toggle {
        display: flex;
        align-items: center;
        white-space: nowrap;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .mode-toggle:hover {
        background: var(--v_bg2, #F6F7F8);
    }

    .subtitle-wrap {
        height: 429px;
        overflow-y: auto;
        overscroll-behavior: contain;
        background: var(--v_bg1, #FFFFFF);
    }

    .subtitle-item {
        display: flex;
        align-items: center;
        padding: 0 12px;
        height: 32px;
        transition: background-color 0.3s;
        cursor: pointer;
    }

    .subtitle-item:hover {
        background: var(--v_bg2, #F6F7F8);
    }

    .subtitle-item.active {
        background: var(--v_bg2, #F6F7F8);
        color: var(--v_brand_blue, #00AEEC);
    }

    .subtitle-time {
        width: 80px;
        color: var(--v_text3, #9499A0);
        flex-shrink: 0;
    }

    .subtitle-text {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0 12px;
        color: var(--v_text1, #18191C);
    }

    .arrow-icon {
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s;
        margin-right: 8px;
    }

    .arrow-icon.expanded {
        transform: rotate(90deg);
    }

    .bui-dropdown-items {
        position: absolute;
        top: 100%;
        right: 0;
        min-width: 120px;
        background: var(--v_bg1, #FFFFFF);
        border: 1px solid var(--v_line_regular, #E3E5E7);
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 1000;
        margin-top: 4px;
        display: none;
    }

    .bui-dropdown-item {
        padding: 8px 16px;
        cursor: pointer;
        transition: background-color 0.3s;
        color: var(--v_text1, #18191C);
    }

    .bui-dropdown-item:hover {
        background: var(--v_brand_blue_thin, #DFF6FD);
        color: var(--v_brand_blue, #00AEEC);
    }
`;

// 注入样式
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

// 字幕显示模式枚举
const SubtitleMode = {
    SINGLE: 'single',    // 单条字幕模式
    FULL: 'full'        // 完整字幕模式
};

// 字幕获取模块
const SubtitleFetcher = {
    async getVideoInfo() {
        const info = {
            aid: window.aid || window.__INITIAL_STATE__?.aid,
            bvid: window.bvid || window.__INITIAL_STATE__?.bvid,
            cid: window.cid
        };

        if (!info.cid) {
            const state = window.__INITIAL_STATE__;
            info.cid = state?.videoData?.cid || state?.epInfo?.cid;
        }

        if (!info.cid && window.player) {
            try {
                const playerInfo = window.player.getVideoInfo();
                info.cid = playerInfo.cid;
                info.aid = playerInfo.aid;
                info.bvid = playerInfo.bvid;
            } catch (e) {
                console.log('Failed to get info from player:', e);
            }
        }

        return info;
    },

    async getSubtitleConfig(info) {
        const apis = [
            `//api.bilibili.com/x/player/v2?cid=${info.cid}&bvid=${info.bvid}`,
            `//api.bilibili.com/x/v2/dm/view?aid=${info.aid}&oid=${info.cid}&type=1`,
            `//api.bilibili.com/x/player/wbi/v2?cid=${info.cid}`
        ];

        for (const api of apis) {
            try {
                const res = await fetch(api);
                const data = await res.json();

                if (data.code === 0 && data.data?.subtitle?.subtitles?.length > 0) {
                    return data.data.subtitle;
                }
            } catch (e) {
                console.log('API failed:', e);
            }
        }

        return null;
    },

    async getSubtitleContent(subtitleUrl) {
        try {
            const url = subtitleUrl.replace(/^http:/, 'https:');
            const res = await fetch(url);
            const data = await res.json();
            return data;
        } catch (e) {
            console.error('Failed to get subtitle content:', e);
            return null;
        }
    }
};

// 时间格式化模块
const TimeFormatter = {
    formatTime(seconds) {
        const mm = String(Math.floor(seconds/60)).padStart(2,'0');
        const ss = String(Math.floor(seconds%60)).padStart(2,'0');
        return `${mm}:${ss}`;
    },
    
    formatTimeWithMs(seconds) {
        const date = new Date(seconds * 1000);
        const mm = String(Math.floor(seconds/60)).padStart(2,'0');
        const ss = String(Math.floor(seconds%60)).padStart(2,'0');
        const ms = String(date.getMilliseconds()).slice(0,3).padStart(3,'0');
        return `${mm}:${ss},${ms}`;
    }
};

// UI渲染模块
const SubtitleUI = {
    currentMode: SubtitleMode.SINGLE,
// 问题1️⃣：样式注入重复
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .subtitle-container {
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                font-size: 12px;
                line-height: normal;
                -webkit-font-smoothing: antialiased;
                margin-top: 12px;
                width: 100%;
                box-sizing: border-box;
            }
    
            .bui-collapse-header {
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
    
            .subtitle-content {
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
    
            .subtitle-function {
                display: flex;
                align-items: center;
                height: 40px;
                padding: 0 12px;
                border-bottom: 1px solid var(--v_line_regular, #E3E5E7);
                justify-content: space-between;
                background: var(--v_bg1, #FFFFFF);
                color: var(--v_text2, #61666D);
            }
    
            .subtitle-function-left {
                display: flex;
                align-items: center;
                gap: 16px;
            }
    
            .subtitle-function-btn {
                display: flex;
                align-items: center;
                white-space: nowrap;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
    
            .subtitle-function-btn:hover {
                background: var(--v_bg2, #F6F7F8);
            }
    
            .mode-toggle {
                display: flex;
                align-items: center;
                white-space: nowrap;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
    
            .mode-toggle:hover {
                background: var(--v_bg2, #F6F7F8);
            }
    
            .subtitle-wrap {
                height: 429px;
                overflow-y: auto;
                overscroll-behavior: contain;
                background: var(--v_bg1, #FFFFFF);
            }
    
            .subtitle-item {
                display: flex;
                align-items: center;
                padding: 0 12px;
                height: 32px;
                transition: background-color 0.3s;
                cursor: pointer;
            }
    
            .subtitle-item:hover {
                background: var(--v_bg2, #F6F7F8);
            }
    
            .subtitle-item.active {
                background: var(--v_bg2, #F6F7F8);
                color: var(--v_brand_blue, #00AEEC);
            }
    
            .subtitle-time {
                width: 80px;
                color: var(--v_text3, #9499A0);
                flex-shrink: 0;
            }
    
            .subtitle-text {
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin: 0 12px;
                color: var(--v_text1, #18191C);
            }
    
            .arrow-icon {
                width: 20px;
                height: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s;
                margin-right: 8px;
            }
    
            .arrow-icon.expanded {
                transform: rotate(90deg);
            }
    
            .bui-dropdown-items {
                position: absolute;
                top: 100%;
                right: 0;
                min-width: 120px;
                background: var(--v_bg1, #FFFFFF);
                border: 1px solid var(--v_line_regular, #E3E5E7);
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                z-index: 1000;
                margin-top: 4px;
                display: none;
            }
    
            .bui-dropdown-item {
                padding: 8px 16px;
                cursor: pointer;
                transition: background-color 0.3s;
                color: var(--v_text1, #18191C);
            }
    
            .bui-dropdown-item:hover {
                background: var(--v_brand_blue_thin, #DFF6FD);
                color: var(--v_brand_blue, #00AEEC);
            }
        `;
        document.head.appendChild(style);
    },
    
    createSubtitleUI() {
        const container = document.createElement('div');
        container.className = 'subtitle-container';
        
        // 头部
        const header = document.createElement('div');
        header.className = 'bui-collapse-header';
        header.innerHTML = `
            <div class="title-section">
                <div class="bui-collapse-arrow">
                    <span class="bui-collapse-arrow-text">
                        <span class="arrow-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" data-pointer="none" viewBox="0 0 16 16">
                                <path d="m9.188 7.999-3.359 3.359a.75.75 0 1 0 1.061 1.061l3.889-3.889a.75.75 0 0 0 0-1.061L6.89 3.58a.75.75 0 1 0-1.061 1.061l3.359 3.358z"></path>
                            </svg>
                        </span>
                    </span>
                </div>
                <span class="header-title">字幕列表</span>
            </div>
            <div class="menu-section">
                <div class="bui-dropdown-wrap">
                    <div class="bui-dropdown-display">
                        <span class="bui-dropdown-icon">
                            <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                <path d="M947.2 800c25.6 0 51.2 19.2 51.2 51.2s-25.6 44.8-51.2 44.8H332.8c-25.6 0-51.2-19.2-51.2-51.2s19.2-51.2 51.2-51.2h614.4z m-870.4 0c25.6 0 51.2 19.2 51.2 51.2s-19.2 44.8-51.2 44.8-51.2-19.2-51.2-51.2 25.6-44.8 51.2-44.8z m870.4-339.2c25.6 0 51.2 19.2 51.2 51.2 0 25.6-19.2 51.2-51.2 51.2H332.8c-25.6 0-44.8-25.6-44.8-51.2s19.2-51.2 51.2-51.2h608z m-870.4 0c32 0 51.2 25.6 51.2 51.2s-19.2 51.2-51.2 51.2S32 537.6 32 512s19.2-51.2 44.8-51.2zM947.2 128c25.6 0 51.2 19.2 51.2 51.2s-19.2 51.2-51.2 51.2H332.8c-25.6 0-51.2-19.2-51.2-51.2s25.6-51.2 51.2-51.2h614.4zM76.8 128c32 0 51.2 19.2 51.2 51.2s-19.2 44.8-51.2 44.8-44.8-19.2-44.8-44.8 19.2-51.2 44.8-51.2z" fill="currentColor"/>
                            </svg>
                        </span>
                    </div>
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
        
        // 内容区
        const content = document.createElement('div');
        content.className = 'subtitle-content';
        
        const function_bar = document.createElement('div');
        function_bar.className = 'subtitle-function';
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
        
        const wrap = document.createElement('div');
        wrap.className = 'subtitle-wrap';

        // 添加滚轮事件处理
        wrap.addEventListener('wheel', (e) => {
            // 阻止事件冒泡和默认行为
            e.stopPropagation();
            e.preventDefault();

            // 手动处理滚动
            wrap.scrollTop += e.deltaY;
        }, { passive: false });
        
        content.appendChild(function_bar);
        content.appendChild(wrap);
    
        container.appendChild(header);
        container.appendChild(content);
        
        // 添加菜单点击事件
        const dropdownWrap = header.querySelector('.bui-dropdown-wrap');
        const dropdownItems = header.querySelector('.bui-dropdown-items');
        
        // 点击三点图标显示/隐藏菜单
        dropdownWrap.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            dropdownItems.classList.toggle('show');
        });

        // 点击页面其他地方关闭菜单
        document.addEventListener('click', () => {
            dropdownItems.classList.remove('show');
        });

        // 点击菜单项时不关闭菜单
        dropdownItems.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        return { container, header, content: wrap, function_bar };
    }
};

// 字幕同步模块
const SubtitleSync = {
    isVideoPlaying: true,
    lastManualScrollTime: 0,
    currentMode: SubtitleMode.SINGLE,
    
    displaySubtitles(subtitles, container) {
        if (this.currentMode === SubtitleMode.SINGLE) {
            this.displaySingleMode(subtitles, container);
        } else {
            this.displayFullMode(subtitles, container);
        }

        // 监听视频播放状态
        if (window.player) {
            const observer = new MutationObserver(() => {
                const video = document.querySelector('video');
                if (video) {
                    this.isVideoPlaying = !video.paused;
                }
            });

            observer.observe(document.querySelector('.bpx-player-container'), {
                subtree: true,
                attributes: true
            });
        }
    },

    displaySingleMode(subtitles, container) {
        const subtitleHtml = subtitles.body.map((item, index) => `
            <div class="subtitle-item" data-index="${index}">
                <span class="subtitle-time">${TimeFormatter.formatTime(item.from)}</span>
                <span class="subtitle-text">${item.content}</span>
            </div>
        `).join('');

        container.innerHTML = subtitleHtml;
        this.addClickEvents(subtitles, container);
    },

    displayFullMode(subtitles, container) {
        const subtitleHtml = `
            <div class="subtitle-full-text">
                ${subtitles.body.map((item, index) => `
                    <span class="subtitle-segment" data-index="${index}">
                        ${item.content}
                    </span>
                `).join(' ')}
            </div>
        `;

        container.innerHTML = subtitleHtml;
        this.addClickEvents(subtitles, container);
    },

    addClickEvents(subtitles, container) {
        const elements = this.currentMode === SubtitleMode.SINGLE ? 
            container.querySelectorAll('.subtitle-item') :
            container.querySelectorAll('.subtitle-segment');

        elements.forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                const subtitle = subtitles.body[index];
                if (window.player && subtitle) {
                    window.player.seek(subtitle.from);
                }
            });
        });

        container.addEventListener('scroll', () => {
            this.lastManualScrollTime = Date.now();
        });
    },

    toggleMode(subtitles, container) {
        this.currentMode = this.currentMode === SubtitleMode.SINGLE ? 
            SubtitleMode.FULL : SubtitleMode.SINGLE;
        this.displaySubtitles(subtitles, container);
    },

    getRelativePosition(element, container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        return {
            top: elementRect.top - containerRect.top,
            bottom: elementRect.bottom - containerRect.top
        };
    },

    isElementInViewport(element, container) {
        const pos = this.getRelativePosition(element, container);
        const containerHeight = container.clientHeight;
        
        const buffer = 50;
        return pos.top >= -buffer && pos.bottom <= containerHeight + buffer;
    },

    smoothScrollToElement(element, container) {
        const pos = this.getRelativePosition(element, container);
        const containerHeight = container.clientHeight;
        const targetScroll = container.scrollTop + pos.top - containerHeight / 2;
        
        container.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    },

    highlightCurrentSubtitle(subtitles, container) {
        const currentTime = window.player?.getCurrentTime() || 0;
        
        if (this.currentMode === SubtitleMode.SINGLE) {
            container.querySelectorAll('.subtitle-item').forEach(item => {
                item.classList.remove('active');
            });
        } else {
            container.querySelectorAll('.subtitle-segment').forEach(item => {
                item.classList.remove('active');
            });
        }

        const currentSubtitle = subtitles.body.find(item => 
            currentTime >= item.from && currentTime <= item.to
        );

        if (currentSubtitle) {
            const index = subtitles.body.indexOf(currentSubtitle);
            const selector = this.currentMode === SubtitleMode.SINGLE ? 
                `.subtitle-item[data-index="${index}"]` :
                `.subtitle-segment[data-index="${index}"]`;
            const currentElement = container.querySelector(selector);
            
            if (currentElement) {
                currentElement.classList.add('active');
                
                if (this.isVideoPlaying && Date.now() - this.lastManualScrollTime > 2000) {
                    if (!this.isElementInViewport(currentElement, container)) {
                        this.smoothScrollToElement(currentElement, container);
                    }
                }
            }
        }
    }
};

// 字幕导出模块
const SubtitleExporter = {
    getVideoTitle() {
        return document.querySelector('h1.video-title')?.textContent?.trim() || 'subtitle';
    },

    exportToSRT(subtitles) {
        return subtitles.body.map((item, index) => {
            return `${index + 1}\n${TimeFormatter.formatTimeWithMs(item.from)} --> ${TimeFormatter.formatTimeWithMs(item.to)}\n${item.content}\n`;
        }).join('\n');
    },

    exportToTXT(subtitles) {
        return subtitles.body.map(item => {
            return `[${TimeFormatter.formatTime(item.from)}] ${item.content}`;
        }).join('\n');
    },

    download(content, format) {
        const title = this.getVideoTitle();
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// 添加菜单处理模块
const MenuHandler = {
    // 复制纯文本
    copyText(subtitles) {
        const text = subtitles.body.map(item => item.content).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('复制成功');
        });
    },

    // 复制带时间戳的文本
    copyTextWithTime(subtitles) {
        const text = subtitles.body.map(item => 
            `[${TimeFormatter.formatTime(item.from)}] ${item.content}`
        ).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('复制成功');
        });
    },

    // 导出SRT格式
    exportSRT(subtitles) {
        const content = SubtitleExporter.exportToSRT(subtitles);
        SubtitleExporter.download(content, 'srt');
    },

    // 导出ASS格式
    exportASS(subtitles) {
        // TODO: 实现ASS格式导出
        this.showToast('ASS格式导出功能开发中');
    },

    // 显示设置
    showDisplaySettings() {
        // TODO: 实现显示设置面板
        this.showToast('显示设置功能开发中');
    },

    // 显示提示
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'bui-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('bui-toast-show');
            setTimeout(() => {
                toast.classList.remove('bui-toast-show');
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 200);
            }, 2000);
        }, 0);
    }
};

// 主函数
async function main() {
    // 等待弹幕列表容器加载
    const danmakuContainer = await new Promise(resolve => {
        const check = () => {
            const container = document.querySelector('.bui-collapse-wrap');
            if (container) {
                resolve(container);
            } else {
                setTimeout(check, 1000);
            }
        };
        check();
    });

    // 注入样式
    SubtitleUI.injectStyles();
    
    // 创建UI
    const { container, header, content, function_bar } = SubtitleUI.createSubtitleUI();
    danmakuContainer.appendChild(container);
    
    // 切换展开/收起
    let isExpanded = false;
    header.addEventListener('click', () => {
        isExpanded = !isExpanded;
        container.querySelector('.subtitle-content').style.height = 
            isExpanded ? '429px' : '0';  // 36px(功能栏) + 393px(内容区)
        header.querySelector('.arrow-icon').classList.toggle('expanded', isExpanded);
    });

    // 加载字幕
    try {
        const videoInfo = await SubtitleFetcher.getVideoInfo();
        if (!videoInfo.cid) {
            throw new Error('无法获取视频信息');
        }

        const subtitleConfig = await SubtitleFetcher.getSubtitleConfig(videoInfo);
        if (!subtitleConfig) {
            throw new Error('该视频没有CC字幕');
        }

        const subtitles = await SubtitleFetcher.getSubtitleContent(subtitleConfig.subtitles[0].subtitle_url);
        if (!subtitles) {
            throw new Error('获取字幕内容失败');
        }

        // 显示字幕
        SubtitleSync.displaySubtitles(subtitles, content);

        // 添加模式切换事件
        const modeToggle = function_bar.querySelector('.mode-toggle');
        modeToggle.addEventListener('click', () => {
            SubtitleSync.toggleMode(subtitles, content);
            modeToggle.querySelector('span').textContent = 
                SubtitleSync.currentMode === SubtitleMode.SINGLE ? 
                '切换到完整模式' : '切换到单条模式';
        });

        // 启动字幕同步
        setInterval(() => {
            if (isExpanded) {
                SubtitleSync.highlightCurrentSubtitle(subtitles, content);
            }
        }, 100);

        // 添加菜单事件处理
        const dropdownItems = container.querySelector('.bui-dropdown-items');
        dropdownItems.addEventListener('click', (e) => {
            const item = e.target.closest('.bui-dropdown-item');
            if (!item) return;

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
        console.error('Error:', error);
        content.innerHTML = `<div class="subtitle-item">${error.message}</div>`;
    }
}

// 等待页面加载完成后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}